from django.db import models, transaction
from django.db.models import Sum
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils.text import slugify
from django.utils import timezone
from datetime import datetime, timedelta
import jwt
from django.conf import settings
from django.core.exceptions import FieldError
from django.contrib.auth.models import Permission
from guardian.shortcuts import assign_perm

class R:
    def __init__(self, user):
        self.user = user

def get_perm(codename):
    return Permission.objects.get(content_type__app_label='redditapp', codename=codename)

def get_model_perms():
    perms = []
    for op in ['change', 'delete']:
        for model_name in ['comment', 'post']:
            perms.append(get_perm(f'{op}_{model_name}'))
    return perms

def pluralize(value, unit):
    if value == 1:
        return f'1 {unit} ago'
    return f'{value} {unit}s ago'

def time_ago(dt):
    t = timezone.now() - dt
    if t.days == 0:
        if t.seconds < 60:
            return 'just now'
        if t.seconds < 3600:
            return pluralize(t.seconds//60, 'minute')
        if t.seconds < 3600 * 24:
            return pluralize(t.seconds//3600, 'hour')
    if t.days < 30:
        return pluralize(t.days, 'day')
    if t.days < 365:
        return pluralize(t.days//30, 'month')
    return pluralize(t.days//365, 'year')

def edited(model):
    # The text object is created first so if the comment/post is unedited
    # the last_modified will be before the created
    # Maybe created should be an attribute of the text model
    td = (model.text.last_modified - model.created)
    return td.days > -1 and td.seconds > 60 * 5

class UserManager(BaseUserManager):
    def create_user(self, username, password=None, email=None):
        if username is None:
            raise TypeError('Users must have a username')
        user = self.model(username=username, email=email)
        user.set_password(password)
        with transaction.atomic():
            user.save()
            user.user_permissions.add(*get_model_perms())
        return user

    def create_superuser(self, username, password, email=None):
        if password is None:
            raise TypeError('Superusers must have a password')

        with transaction.atomic():
            user = self.create_user(username, password, email)
            user.is_superuser = True
            user.is_staff = True
            user.save()
        return user

class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(db_index=True, max_length=20, unique=True)
    email = models.EmailField(unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.username

    def get_username(self):
        if self.is_active:
            return self.username
        return '[deleted]'

    def get_full_name(self):
        return self.username

    def get_short_name(self):
        return self.username

    @property
    def token(self):
        return self._generate_jwt_token()

    def _generate_jwt_token(self):
        dt = datetime.now() + timedelta(days=60)

        token = jwt.encode({
            'id': self.pk,
            'exp': int(dt.strftime('%s'))
        }, settings.SECRET_KEY, algorithm='HS256')

        return token.decode('utf-8')

    def save(self, *args, **kwargs):
        if self.email == '':
            self.email = None
        super(User, self).save(*args, **kwargs)

class SubredditManager(models.Manager):
    def create(self, name, creator):
        subreddit = self.model(name=name, creator=creator)
        with transaction.atomic():
            subreddit.save()
            subreddit.moderators.add(creator)
            subreddit.subscribers.add(creator)
        return subreddit

class Subreddit(models.Model):
    name = models.CharField(max_length=25, unique=True)
    subscribers = models.ManyToManyField(User, related_name='subscribers')
    moderators = models.ManyToManyField(User, related_name='moderators')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='creator')
    created = models.DateTimeField(auto_now_add=True)
    is_deleted = models.BooleanField(default=False)
    objects = SubredditManager()

    def __str__(self):
        return '/r/' + self.name

class DeletedUser(object):
    username = '[deleted]'
    def get_username(self):
        return self.username

class Text(models.Model):
    text = models.TextField(blank=True)
    last_modified = models.DateTimeField(auto_now=True)

class Post(models.Model):
    title = models.CharField(max_length=300)
    subreddit = models.ForeignKey(Subreddit, on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)
    link = models.URLField(blank=True, max_length=2000)
    text = models.OneToOneField(
        Text,
        on_delete=models.CASCADE,
        null=True
    )
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_author')
    is_deleted = models.BooleanField(default=False)
    voters = models.ManyToManyField(User, through='Vote', through_fields=('post', 'voter'), related_name='post_voters')
    votes = models.IntegerField(default=0)
    slug = models.SlugField(null=False)

    def get_author(self):
        if self.is_deleted:
            return DeletedUser()
        return self.author

    @property
    def edited(self):
        return edited(self)

    @property
    def comments(self):
        return self.comment_set.filter(parent_comment=None).order_by('-votes', 'created')

    @property
    def numComments(self):
        return self.comment_set.count()

    @property
    def created_time_ago(self):
        return time_ago(self.created)

    @property
    def edited_time_ago(self):
        return time_ago(self.last_modified)

    @property
    def edited(self):
        return edited(self.text)

    def save(self, *args, **kwargs):
        self.slug = slugify(self.title)
        new_record = self.pk is None
        with transaction.atomic():
            super(Post, self).save(*args, **kwargs)
            if new_record:
                Vote.objects.create(voter=self.author, value=1, post=self)
                assign_perm('redditapp.change_post', self.author, self)
                assign_perm('redditapp.delete_post', self.author, self)

    def __str__(self):
        return '/r/' + self.subreddit.name + ' -- ' + self.title

class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comment_author')
    parent_comment = models.ForeignKey('self', null=True, on_delete=models.CASCADE, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    text = models.OneToOneField(Text, on_delete=models.CASCADE)
    is_deleted = models.BooleanField(default=False)
    voters = models.ManyToManyField(User, through='Vote', through_fields=('comment', 'voter'), related_name='comment_voters')
    votes = models.IntegerField(default=0)

    def get_author(self):
        if self.is_deleted:
            return DeletedUser()
        return self.author

    @property
    def child_comments(self):
        return self.comment_set.all().order_by('-votes', 'created')

    @property
    def created_time_ago(self):
        return time_ago(self.created)

    @property
    def edited_time_ago(self):
        return time_ago(self.text.last_modified)

    @property
    def edited(self):
        return edited(self)

    def save(self, *args, **kwargs):
        new_record = self.pk is None
        with transaction.atomic():
            super(Comment, self).save(*args, **kwargs)
            if new_record:
                Vote.objects.create(voter=self.author, value=1, comment=self)
                assign_perm('redditapp.change_comment', self.author, self)
                assign_perm('redditapp.delete_comment', self.author, self)

    def __str__(self):
        if len(self.text.text) < 20:
            return self.text.text
        return self.text.text[:20] + '...'

class VoteManager(models.Manager):
    def create(self, voter, value, post=None, comment=None):
        vote = self.model(
            voter=voter,
            value=value,
            is_post=bool(post),
            is_comment=bool(comment),
            post=post,
            comment=comment
        )
        vote.save()
        return vote

class Vote(models.Model):
    voter = models.ForeignKey(User, on_delete=models.CASCADE)
    value = models.IntegerField() # should be -1 or 1
    is_post = models.BooleanField()
    is_comment = models.BooleanField()
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True)
    objects = VoteManager()

    def validate(self):
        if self.value not in [-1, 1]:
            raise FieldError('value must be in [-1, 1]')
        if self.post is None and self.comment is None:
            raise FieldError('post and comment cannot both be null')
        if self.post and self.comment:
            raise FieldError('cannot submit vote for both post and comment')
        if self.pk is None and self.post and self.voter in self.post.voters.all():
            raise FieldError('voter has already voted on this post')
        if self.pk is None and self.comment and self.voter in self.comment.voters.all():
            raise FieldError('voter has already voted on this comment')
        return True

    def save(self, *args, **kwargs):
        self.validate()
        with transaction.atomic():
            super(Vote, self).save(*args, **kwargs)
            if self.comment:
                value__sum = self.comment.vote_set.aggregate(Sum('value'))
                self.comment.votes = value__sum['value__sum']
                self.comment.save()
            if self.post:
                value__sum = self.post.vote_set.aggregate(Sum('value'))
                self.post.votes = value__sum['value__sum']
                self.post.save()

    def delete(self, *args, **kwargs):
        with transaction.atomic():
            if self.comment:
                self.comment.votes -= self.value
                self.comment.save()
            if self.post:
                self.post.votes -= self.value
                self.post.save()
            super(Vote, self).delete(*args, **kwargs)

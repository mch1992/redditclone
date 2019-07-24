from django.db import models
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.utils.text import slugify
from datetime import datetime, timedelta
import jwt
from django.conf import settings
from django.core.exceptions import FieldError

class UserManager(BaseUserManager):
    def create_user(self, username, password=None, email=None):
        if username is None:
            raise TypeError('Users must have a username')
        user = self.model(username=username, email=email)
        user.set_password(password)
        user.save()
        return user

    def create_superuser(self, username, password, email=None):
        if password is None:
            raise TypeError('Superusers must have a password')

        user = self.create_user(username, password, email)
        user.is_superuser = True
        user.is_staff = True
        user.save()
        return user

class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(db_index=True, max_length=20, unique=True)
    email = models.EmailField(db_index=True, unique=True, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = []

    objects = UserManager()

    def __str__(self):
        return self.username

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

class SubredditManager(models.Manager):
    def create(self, name, creator):
        subreddit = self.model(name=name, creator=creator)
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

class Post(models.Model):
    title = models.CharField(max_length=300)
    subreddit = models.ForeignKey(Subreddit, on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    is_link = models.BooleanField()
    link = models.URLField(blank=True, max_length=2000)
    text = models.TextField(blank=True)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='post_author')
    is_deleted = models.BooleanField(default=False)
    voters = models.ManyToManyField(User, through='Vote', through_fields=('post', 'voter'), related_name='post_voters')
    slug = models.SlugField(null=False)

    def save(self, *args, **kwargs):
        self.slug = slugify(self.title)
        super(Post, self).save(*args, **kwargs)

    def __str__(self):
        return '/r/' + self.subreddit.name + ' -- ' + self.title

class Comment(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE)
    author = models.ForeignKey(User, on_delete=models.CASCADE, related_name='comment_author')
    parent_comment = models.ForeignKey('self', null=True, on_delete=models.CASCADE, blank=True)
    created = models.DateTimeField(auto_now_add=True)
    last_modified = models.DateTimeField(auto_now=True)
    text = models.TextField()
    is_deleted = models.BooleanField(default=False)
    voters = models.ManyToManyField(User, through='Vote', through_fields=('comment', 'voter'), related_name='comment_voters')

    def save(self, *args, **kwargs):
        super(Comment, self).save(*args, **kwargs)
        Vote.objects.create(voter=self.author, value=1, comment=self)

    def __str__(self):
        if len(self.text) < 20:
            return self.text
        return self.text[:20] + '...'

class VoteManager(models.Manager):
    def validate(self, voter, value, post=None, comment=None):
        if value not in [-1, 1]:
            raise FieldError('value must be in [-1, 1]')
        if post is None and comment is None:
            raise FieldError('post and comment cannot both be null')
        if post and comment:
            raise FieldError('cannot submit vote for both post and comment')
        if post and voter in post.voters.all():
            raise FieldError('voter has already voted on this post')
        if comment and voter in comment.voters.all():
            raise FieldError('voter has already voted on this comment')
        return True

    def create(self, voter, value, post=None, comment=None):
        self.validate(voter, value, post, comment)
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

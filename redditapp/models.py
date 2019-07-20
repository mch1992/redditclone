from django.db import models
from django.contrib.auth.models import User
from django.utils.text import slugify

class Subreddit(models.Model):
    name = models.CharField(max_length=25)
    subscribers = models.ManyToManyField(User, related_name='subscribers')
    moderators = models.ManyToManyField(User, related_name='moderators')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='creator')
    created = models.DateTimeField(auto_now_add=True)

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
    slug = models.SlugField(unique=True, null=False)

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

    def __str__(self):
        if len(self.text) < 20:
            return self.text
        return self.text[:20] + '...'

class Vote(models.Model):
    voter = models.ForeignKey(User, on_delete=models.CASCADE)
    value = models.IntegerField() # should be -1 or 1
    is_post = models.BooleanField()
    is_comment = models.BooleanField()
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True)
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, null=True, blank=True)

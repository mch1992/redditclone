from django.contrib import admin

from .models import Subreddit, Post, Comment, Vote

class VoteAdmin(admin.ModelAdmin):
    list_display = ('voter', 'value', 'post', 'comment')

admin.site.register(Subreddit)
admin.site.register(Post)
admin.site.register(Comment)
admin.site.register(Vote, VoteAdmin)

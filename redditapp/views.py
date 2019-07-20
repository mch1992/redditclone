from django.shortcuts import render
from django.http import JsonResponse

from .models import *

def posts(request):
    post_data = []
    for p in Post.objects.all():
        post_data.append({
            'id': p.id,
            'title': p.title,
            'slug': p.slug,
            'subreddit': p.subreddit.name,
            'numComments': len(p.comment_set.all()),
            'score': sum(v.value for v in p.vote_set.all())
        })
    return JsonResponse({'posts': post_data})

def subreddit(request, subreddit_name):
    sub = Subreddit.objects.get(name=subreddit_name)
    post_data = []
    for p in sub.post_set.all():
        post_data.append({
            'id': p.id,
            'title': p.title,
            'slug': p.slug,
            'subreddit': sub.name,
            'numComments': len(p.comment_set.all()),
            'score': sum(v.value for v in p.vote_set.all())
        })
    return JsonResponse({'posts': post_data})    

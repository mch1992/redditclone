from django.shortcuts import render
from django.http import JsonResponse

from .models import *

def posts(request):
    post_data = []
    for p in Post.objects.all():
        post_data.append({
            'title': p.title,
            'subreddit': p.subreddit.name,
            'numComments': len(p.comment_set.all()),
            'score': sum(v.value for v in p.vote_set.all())
        })
    return JsonResponse({'posts': post_data})

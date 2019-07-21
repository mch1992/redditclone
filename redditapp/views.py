from django.shortcuts import render
from django.http import JsonResponse
from django.views import View
from django.contrib.auth import authenticate
import jwt

from .models import *

def posts(request):
    post_data = []
    for p in Post.objects.filter(is_deleted=False):
        post_data.append({
            'id': p.id,
            'title': p.title,
            'slug': p.slug,
            'subreddit': p.subreddit.name,
            'is_link': p.is_link,
            'link': p.link,
            'numComments': len(p.comment_set.all()),
            'score': sum(v.value for v in p.vote_set.all())
        })
    return JsonResponse({'posts': post_data})

def subreddit(request, subreddit_name):
    sub = Subreddit.objects.get(name=subreddit_name)
    post_data = []
    for p in sub.post_set.filter(is_deleted=False):
        post_data.append({
            'id': p.id,
            'title': p.title,
            'is_link': p.is_link,
            'link': p.link,
            'slug': p.slug,
            'subreddit': sub.name,
            'numComments': len(p.comment_set.all()),
            'score': sum(v.value for v in p.vote_set.all())
        })
    return JsonResponse({'posts': post_data})

def serialize_comments(comments):
    serialized_comments = []
    for c in comments:
        s = {}
        if c.is_deleted:
            s.update({
                'author': '[deleted]',
                'text': '[deleted]'
            })
        else:
            s.update({
                'author': c.author.username,
                'text': c.text
            })
        s.update({
            'created': c.created,
            'last_modified': c.last_modified,
            'score': sum(v.value for v in c.vote_set.all()),
            'child_comments': serialize_comments(c.comment_set.all())
        })
        serialized_comments.append(s)
    return serialized_comments
    

def comments_page(request, subreddit_name, post_slug):
    post = Post.objects.get(slug=post_slug, subreddit__name=subreddit_name)
    top_comments = post.comment_set.filter(parent_comment=None)
    serialized_comments = serialize_comments(top_comments)
    post_data = {
        'numComments': len(post.comment_set.all()),
        'slug': post.slug,
        'subreddit': post.subreddit.name,
        'created': post.created,
        'last_modified': post.last_modified,
        'score': sum(v.value for v in post.vote_set.all()),
        'link': post.link,
        'is_link': post.is_link,
        'comments': serialized_comments
    }
    if post.is_deleted:
        post_data.update({
            'author': '[deleted]',
            'text': '[deleted]'
        })
        if post.is_link:
            post['title'] = post.title
        else:
            post['title'] = '[deleted]'
    else:
        post_data.update({
            'author': post.author.username,
            'text': post.text,
            'title': post.title
        })
    
    return JsonResponse({'post': post_data})

class Login(View):
    def post(self, request):
        if not request.POST:
            return JsonResponse({'Error': 'Please provide username/password'}, status=400)
        username = request.POST['username']
        password = request.POST['password']
        user = authenticate(username=username, password=password)
        if user is None:
            return JsonResponse({'Error': 'Invalid username/password'}, status=400)
        payload = {
            'id': user.id,
            'username': user.username
        }
        jwt_token = {'token': jwt.encode(payload, SECRET_KEY)}
        return JsonResponse(jwt_token)


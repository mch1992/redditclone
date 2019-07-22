from django.shortcuts import render
from django.http import JsonResponse
from django.views import View
from django.contrib.auth import authenticate
import jwt
from rest_framework import status
from rest_framework.generics import RetrieveUpdateAPIView, CreateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.renderers import JSONRenderer

from .models import *
from .serializers import *
from .renderers import UserJSONRenderer

def posts(request):
    post_data = []
    for p in Post.objects.filter(is_deleted=False).order_by('-created'):
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
    for p in sub.post_set.filter(is_deleted=False).order_by('-created'):
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
    

def comments_page(request, subreddit_name, pk, post_slug):
    post = Post.objects.get(pk=pk)
    top_comments = post.comment_set.filter(parent_comment=None)
    serialized_comments = serialize_comments(top_comments)
    post_data = {
        'id': post.pk,
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

class RegistrationAPIView(APIView):
    permission_classes = (AllowAny,)
    renderer_classes = (UserJSONRenderer,)
    serializer_class = RegistrationSerializer

    def post(self, request):
        user = request.data.get('user', {})

        serializer = self.serializer_class(data=user)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return Response(serializer.data, status=status.HTTP_201_CREATED)

class LoginAPIView(APIView):
    permission_classes = (AllowAny,)
    renderer_classes = (UserJSONRenderer,)
    serializer_class = LoginSerializer

    def post(self, request):
        user = request.data.get('user', {})
        serializer = self.serializer_class(data=user)
        serializer.is_valid(raise_exception=True)

        return Response(serializer.data, status=status.HTTP_200_OK)

class UserRetrieveUpdateAPIView(RetrieveUpdateAPIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (UserJSONRenderer,)
    serializer_class = UserSerializer

    def retrieve(self, request, *args, **kwargs):
        serializer = self.serializer_class(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        serializer_data = request.data.get('user', {})
        serializer = self.serializer_class(
            request.user, data=serializer_data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

class CreateSubredditView(CreateAPIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (JSONRenderer,)
    serializer_class = CreateSubredditSerializer

    def create(self, request, *args, **kwargs):
        user = request.user
        subreddit_data = request.data.get('subreddit', {})
        serializer = self.serializer_class(data={
            'name': subreddit_data.get('name'),
            'creator': user.pk
        })
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class CreatePostView(CreateAPIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (JSONRenderer,)
    serializer_class = CreatePostSerializer

    def create(self, request, subreddit_name, *args, **kwargs):
        author = request.user
        data = request.data.get('post', {})
        subreddit = Subreddit.objects.get(name=subreddit_name)
        serializer = self.serializer_class(data={
            'title': data['title'],
            'subreddit': subreddit.pk,
            'is_link': data.get('is_link', False),
            'text': data.get('text', ''),
            'link': data.get('link', ''),
            'author': author.pk
        })
        serializer.is_valid(raise_exception=True)
        post = serializer.save()
        return Response({
            'slug': post.slug,
            'subreddit': subreddit_name,
            'id': post.pk
        }, status=status.HTTP_201_CREATED)

from django.shortcuts import render
from django.http import JsonResponse
from django.views import View
from django.contrib.auth import authenticate
import jwt
from rest_framework.decorators import api_view
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.generics import (
    RetrieveUpdateAPIView,
    CreateAPIView,
    ListAPIView,
    UpdateAPIView,
    RetrieveAPIView
)
from rest_framework.permissions import AllowAny, IsAuthenticated, DjangoObjectPermissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.renderers import JSONRenderer

from .models import *
from .serializers import *
from .renderers import UserJSONRenderer

def posts(request):
    post_data = []
    for p in Post.objects.filter(is_deleted=False).order_by('-votes', '-created'):
        post_data.append({
            'id': p.id,
            'title': p.title,
            'slug': p.slug,
            'subreddit': p.subreddit.name,
            'is_link': p.is_link,
            'link': p.link,
            'numComments': len(p.comment_set.all()),
            'score': p.votes
        })
    return JsonResponse({'posts': post_data})

def subreddit(request, subreddit_name):
    sub = Subreddit.objects.get(name=subreddit_name)
    post_data = []
    for p in sub.post_set.filter(is_deleted=False).order_by('-votes', '-created'):
        post_data.append({
            'id': p.id,
            'title': p.title,
            'is_link': p.is_link,
            'link': p.link,
            'slug': p.slug,
            'subreddit': sub.name,
            'numComments': len(p.comment_set.all()),
            'score': p.votes
        })
    return JsonResponse({'posts': post_data})

class CommentsPage(RetrieveAPIView):
    permission_classes = (AllowAny,)
    serializer_class = PostSerializer
    queryset = Post.objects.all()

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
    serializer_class = RegisterUserSerializer

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
    serializer_class = SubredditSerializer

    def create(self, request, *args, **kwargs):
        user = request.user
        subreddit_data = request.data.get('subreddit', {})
        subreddit = Subreddit.objects.create(
            subreddit_data['name'],
            user
        )
        return Response(SubredditSerializer(subreddit).data, status=status.HTTP_201_CREATED)

class CreatePostView(CreateAPIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (JSONRenderer,)
    serializer_class = PostSerializer

    def create(self, request, subreddit_name, *args, **kwargs):
        author = request.user
        data = request.data.get('post', {})
        subreddit = Subreddit.objects.get(name=subreddit_name)
        post = Post.objects.create(
            title=data['title'],
            subreddit=subreddit,
            is_link=data.get('is_link', False),
            text=data.get('text',''),
            link=data.get('link', ''),
            author=author
        )
        return Response({
            'slug': post.slug,
            'subreddit': subreddit_name,
            'id': post.pk
        }, status=status.HTTP_201_CREATED)

class CreateCommentView(CreateAPIView):
    permission_classes = (IsAuthenticated,)
    renderer_classes = (JSONRenderer,)
    serializer_class = CommentSerializer

    def create(self, request, *args, **kwargs):
        author = request.user
        data = request.data.get('comment', {})
        post_id = data['post_id']
        parent_comment_id = data.get('parent_comment_id')
        text = data.get('text')
        comment = Comment.objects.create(
            post=Post.objects.get(pk=post_id),
            author=author,
            parent_comment=parent_comment_id and Comment.objects.get(pk=parent_comment_id),
            text=text
        )
        d = CommentSerializer(comment, context={'request': request}).data
        return Response(d, status=status.HTTP_201_CREATED)

class EditCommentView(UpdateAPIView):
    permission_classes = (IsAuthenticated, DjangoObjectPermissions)
    renderer_classes = (JSONRenderer,)
    serializer_class = CommentSerializer
    queryset = Comment.objects.all()

class SubredditList(ListAPIView):
    queryset = Subreddit.objects.filter(is_deleted=False).order_by('name')
    serializer_class = SubredditSerializer

class VoteOnComment(APIView):
    permission_classes = (IsAuthenticated,)
    serializer_class = CommentSerializer
    renderer_classes = (JSONRenderer,)

    def post(self, request, *args, **kwargs):
        voter = request.user
        data = request.data.get('vote', {})
        comment = Comment.objects.get(pk=data['comment_id'])
        try:
            vote = Vote.objects.get(voter=voter, comment=comment)
        except Vote.DoesNotExist:
            vote = Vote.objects.create(voter, data['value'], comment=comment)
        else:
            if data['value'] in [-1, 1]:
                vote.value = data['value']
                vote.save()
            elif data['value'] == 0:
                vote.delete()
        return Response({
            'comment': CommentSerializer(Comment.objects.get(pk=data['comment_id']), context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

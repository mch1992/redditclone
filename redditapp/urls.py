from django.urls import path

from . import views

urlpatterns = [
    path('posts/', views.posts, name='posts'),
    path('r/<str:subreddit_name>/', views.subreddit, name='subreddit'),
    path('r/<str:subreddit_name>/<slug:post_slug>/comments/', views.comments_page, name='comments_page')
]

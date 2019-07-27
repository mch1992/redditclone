from django.test import TestCase
from django.urls import reverse
from .models import *
from .serializers import *

def create_user(username='user', password='password'):
    user = User.objects.create_superuser(username, password)
    return user

def create_post(title='Test post please ignore'):
    author = create_user()
    sub = Subreddit.objects.create('TestSubreddit', author)
    post = Post.objects.create(
        title=title,
        subreddit=sub,
        is_link=False,
        author='user'
    )
    return author, post

def create_comment(text='comment'):
    author, post = create_post()
    comment = Comment.objects.create(
        post=post,
        author=author,
        text=text
    )
    return author, post, comment

class EditCommentViewTests(TestCase):
    def test_user_must_have_jwt_token_to_edit(self):
        """
        A user can only edit their comments if an authorization header token
        is submitted
        """
        user = User.objects.create_user('user', 'password')
        sub = Subreddit.objects.create('TestSubreddit', user)
        post = Post.objects.create(
            title='Test post please ignore',
            subreddit=sub,
            is_link=False,
            author=user
        )
        original_text = 'comment'
        comment = Comment.objects.create(
            post=post,
            author=user,
            text=original_text
        )
        edited_text = 'edit'
        response = self.client.patch(
            reverse('redditapp:edit_comment', args=[comment.pk]),
            {
                'text': edited_text
            },
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 403)
        comment.refresh_from_db()
        self.assertEqual(comment.text, original_text)
        response = self.client.patch(
            reverse('redditapp:edit_comment', args=[comment.pk]),
            {
                'text': edited_text
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {user.token}'
        )
        self.assertEqual(response.status_code, 200)
        comment.refresh_from_db()
        self.assertEqual(comment.text, edited_text)

    def test_user_can_only_edit_own_comments(self):
        """
        A user can only edit comments of which they are the author.
        A user cannot edit comments of which they are not the author.
        """
        user1 = User.objects.create_user('user1', 'password1')
        user2 = User.objects.create_user('user2', 'password2')
        test_sub = Subreddit.objects.create('TestSubreddit', user1)
        test_post = Post.objects.create(
            title='Test post please ignore',
            subreddit=test_sub,
            is_link=False,
            author=user1
        )
        original_text = 'user2 should not be able to edit this comment'
        user1_comment = Comment.objects.create(
            post=test_post,
            author=user1,
            text=original_text
        )

        response = self.client.patch(
            reverse('redditapp:edit_comment', args=[user1_comment.pk]),
            {
                'text': 'user2 has edited this comment'
            },
            content_type='application/json',
            HTTP_AUTHORIZATION=f'Token {user2.token}'
        )
        self.assertEqual(response.status_code, 403)
        user1_comment.refresh_from_db()
        self.assertEqual(user1_comment.text, original_text)

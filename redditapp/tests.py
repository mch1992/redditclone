from django.test import TestCase
from django.urls import reverse
from .models import *

class EditCommentViewTests(TestCase):
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

        response = self.client.put(
            reverse('redditapp:edit_comment', args=[user1_comment.pk]),
            {
                'text': 'user2 has edited this comment'
            },
            content_type='application/json',
            AUTHORIZATION=f'Token {user2.token}'
        )
        self.assertEqual(response.status_code, 403)
        user1_comment.refresh_from_db()
        self.assertEqual(user1_comment.text, original_text)

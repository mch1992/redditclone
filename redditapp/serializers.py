from django.contrib.auth import authenticate
from rest_framework import serializers

from .models import *

class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        max_length=128,
        min_length=8,
        write_only=True
    )

    token = serializers.CharField(max_length=255, read_only=True)

    class Meta:
        model = User

        fields = ['email', 'username', 'password', 'token']

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=255)
    password = serializers.CharField(max_length=128, write_only=True)
    token = serializers.CharField(max_length=255, read_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        if username is None:
            raise serializers.ValidationError('A username is required to log in')
        if password is None:
            raise serializers.ValidationError('A password is required to log in')
        user = authenticate(username=username, password=password)
        if user is None:
            raise serializers.ValidationError('A user with this username and password was not found')
        if not user.is_active:
            raise serializers.ValidationError('This user has been deactivated')

        return {
            'username': user.username,
            'email': user.email,
            'token': user.token
        }

class RegisterUserSerializer(serializers.ModelSerializer):
    """Handles serialization and deserialization of User objects."""

    password = serializers.CharField(
        max_length=128,
        min_length=8,
        write_only=True
    )

    class Meta:
        model = User
        fields = ('email', 'username', 'password', 'token')
        read_only_fields = ('token',)

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for key, value in validated_data.items():
            setattr(instance, key, value)

        if password is not None:
            instance.set_password(password)

        instance.save()
        return instance

class DynamicFieldsModelSerializer(serializers.ModelSerializer):
    def __init__(self, *args, **kwargs):
        exclude_fields = kwargs.pop('exclude_fields', None)
        super(DynamicFieldsModelSerializer, self).__init__(*args, **kwargs)
        if exclude_fields is not None:
            for field_name in exclude_fields:
                self.fields.pop(field_name)

class UserSerializer(DynamicFieldsModelSerializer):
    username = serializers.CharField(source='get_username')
    class Meta:
        model = User
        fields = ('username',)

class SubredditSerializer(DynamicFieldsModelSerializer):
    creator = UserSerializer()
    class Meta:
        model = Subreddit
        fields = ('name', 'creator', 'created', 'is_deleted')

    def validate(self, data):
        name = data.get('name')
        creator = data.get('creator')
        if name is None:
            raise serializers.ValidationError('A name is required to create a subreddit.')
        if creator is None:
            raise serializers.ValidationError('A creator is required to create a subreddit.')

        return {
            'name': name,
            'creator': creator
        }

class TextSerializer(serializers.ModelSerializer):
    class Meta:
        model = Text
        fields = ('text',)

def voted(user, comment, value):
    return user.is_authenticated and bool(user.vote_set.filter(comment=comment, value=value))

def voted_post(user, post, value):
    return user.is_authenticated and bool(user.vote_set.filter(post=post, value=value))


class RecursiveField(serializers.Serializer):
    def to_representation(self, instance):
        serializer = self.parent.parent.__class__(instance, context=self.context)
        return serializer.data

class CommentSerializer(DynamicFieldsModelSerializer):
    author = UserSerializer(source='get_author')
    upvoted = serializers.BooleanField(default=False)
    downvoted = serializers.BooleanField(default=False)
    child_comments = RecursiveField(many=True)
    text = TextSerializer()
    class Meta:
        model = Comment
        fields = (
            'id',
            'author',
            'text',
            'created',
            'edited',
            'created_time_ago',
            'edited_time_ago',
            'is_deleted',
            'upvoted',
            'downvoted',
            'votes',
            'child_comments'
        )

    def to_representation(self, instance):
        data = super(CommentSerializer, self).to_representation(instance)
        user = self.context['request'].user
        data.update({
            'upvoted': voted(user, instance, 1),
            'downvoted': voted(user, instance, -1)
        })
        return data

    def update(self, instance, validated_data):
        with transaction.atomic():
            new_text = validated_data.get('text', {}).get('text')
            if instance.text.text != new_text:
                instance.text.text = new_text
                instance.text.save()
            validated_data.pop('text', '')
            super(CommentSerializer, self).update(instance, validated_data)
        return instance

class PostSerializer(DynamicFieldsModelSerializer):
    subreddit = SubredditSerializer()
    author = UserSerializer(source='get_author')
    upvoted = serializers.BooleanField(default=False)
    downvoted = serializers.BooleanField(default=False)
    comments = CommentSerializer(many=True)
    text = TextSerializer()
    class Meta:
        model = Post
        fields = (
            'id',
            'title',
            'subreddit',
            'text',
            'author',
            'link',
            'is_deleted',
            'numComments',
            'created',
            'slug',
            'upvoted',
            'downvoted',
            'votes',
            'comments'
        )

    def to_representation(self, instance):
        data = super(PostSerializer, self).to_representation(instance)
        user = self.context['request'].user
        data.update({
            'upvoted': voted_post(user, instance, 1),
            'downvoted': voted_post(user, instance, -1)
        })
        return data

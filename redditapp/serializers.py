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

class UserSerializer(serializers.ModelSerializer):
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

class CreateSubredditSerializer(serializers.ModelSerializer):
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

class CreatePostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Post
        fields = ('title', 'subreddit', 'is_link', 'text', 'author', 'link')

class CreateCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ('post', 'author', 'parent_comment', 'text')

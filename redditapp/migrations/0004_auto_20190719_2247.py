# Generated by Django 2.2.3 on 2019-07-20 02:47

from django.db import migrations
from django.utils.text import slugify

def slugify_title(apps, schema_editor):
    Post = apps.get_model('redditapp', 'Post')
    for post in Post.objects.all():
        post.slug = slugify(post.title)
        post.save()

class Migration(migrations.Migration):

    dependencies = [
        ('redditapp', '0003_auto_20190719_2245'),
    ]

    operations = [
        migrations.RunPython(slugify_title),
    ]
# Generated by Django 2.2.3 on 2019-07-28 00:53

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('redditapp', '0002_auto_20190727_1700'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True, unique=True),
        ),
    ]

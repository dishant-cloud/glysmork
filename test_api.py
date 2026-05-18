import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

from django.contrib.auth.models import User
from users.api.serializers import ProfileSerializer

u = User.objects.get(username='test_trust_user')
serializer = ProfileSerializer(u.profile)
print(json.dumps(serializer.data, indent=2))

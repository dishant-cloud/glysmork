import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

from django.contrib.auth.models import User
from users.models import Profile

User.objects.filter(username='test_trust_user').delete()
u = User.objects.create_user(username='test_trust_user', password='password123')
print("Trust Score:", u.profile.trust_score)

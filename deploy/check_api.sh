#!/bin/bash
# Get first username
USERNAME=$(sudo docker exec glysmork-backend-1 python manage.py shell -c "from django.contrib.auth.models import User; u=User.objects.first(); print(u.username if u else 'none')" 2>/dev/null | tail -1)
echo "Testing profile for user: $USERNAME"
# Hit the API
curl -s "https://api.glysmork.com/api/users/profile/$USERNAME/" | python3 -m json.tool | grep -E "image|persona"

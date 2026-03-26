import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat.settings')
django.setup()

try:
    import users.api.views
    print("SUCCESS")
except Exception as e:
    with open('error_out.txt', 'w', encoding='utf-8') as f:
        f.write(traceback.format_exc())
    print("ERROR")

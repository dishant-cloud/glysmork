from django.contrib.auth.models import User
u = User.objects.filter(email='ganeshmaharaj444@gmail.com').first()
if u:
    u.is_staff = True
    u.is_superuser = True
    u.save(update_fields=['is_staff', 'is_superuser'])
    print(f'SUCCESS: {u.username} is now admin!')
else:
    print('ERROR: User with that email not found')

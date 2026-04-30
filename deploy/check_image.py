from users.models import Profile
p = Profile.objects.exclude(image='default.jpg').exclude(image='').first()
if p:
    print("image field:", str(p.image))
    print("image.url:", p.image.url)
    print("persona_image_url:", p.persona_image_url)
else:
    print("no profiles with custom images")

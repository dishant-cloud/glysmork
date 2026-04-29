from rest_framework import serializers
from matchmaking.models import Loop, CallRequest, ChatNotification


def get_profile_image(profile, username=None):
    """
    Returns the best available profile image URL.
    Priority: uploaded photo > DiceBear (instant CDN avatar, deterministic by username).
    We intentionally skip persona_image_url (Pollinations) as it's too slow (~30s generation).
    """
    try:
        if profile and profile.image and not str(profile.image).endswith('default.jpg'):
            url = profile.image.url
            # Ensure https
            return url.replace('http://', 'https://')
    except Exception:
        pass
    # Fast deterministic fallback: DiceBear (CDN-hosted, <50ms)
    seed = username or (profile.user.username if profile else 'user')
    return f'https://api.dicebear.com/7.x/adventurer/png?seed={seed}&size=200'


class ChatNotificationSerializer(serializers.ModelSerializer):
    sender = serializers.CharField(source='sender.username', read_only=True)
    sender_profile_image = serializers.SerializerMethodField()

    class Meta:
        model = ChatNotification
        fields = ['id', 'sender', 'sender_profile_image', 'message', 'room_name', 'created_at']

    def get_sender_profile_image(self, obj):
        try:
            return get_profile_image(obj.sender.profile, obj.sender.username)
        except Exception:
            return f'https://api.dicebear.com/7.x/adventurer/png?seed={obj.sender.username}&size=200'



class LoopSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Loop
        fields = ['id', 'user', 'username', 'gender', 'timestamp']
        read_only_fields = ['timestamp']

class CallRequestSerializer(serializers.ModelSerializer):
    sender_username = serializers.CharField(source='sender.username', read_only=True)
    receiver_username = serializers.CharField(source='receiver.username', read_only=True)
    
    class Meta:
        model = CallRequest
        fields = ['id', 'sender', 'sender_username', 'receiver', 'receiver_username', 'status', 'room_name', 'timestamp']
        read_only_fields = ['status', 'room_name', 'timestamp']

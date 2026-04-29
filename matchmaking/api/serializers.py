from rest_framework import serializers
from matchmaking.models import Loop, CallRequest, ChatNotification

class ChatNotificationSerializer(serializers.ModelSerializer):
    sender = serializers.CharField(source='sender.username', read_only=True)
    sender_profile_image = serializers.SerializerMethodField()

    class Meta:
        model = ChatNotification
        fields = ['id', 'sender', 'sender_profile_image', 'message', 'room_name', 'created_at']

    def get_sender_profile_image(self, obj):
        try:
            profile = obj.sender.profile
            if profile.image and not str(profile.image).endswith('default.jpg'):
                return profile.image.url
            return profile.persona_image_url or None
        except Exception:
            return None


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

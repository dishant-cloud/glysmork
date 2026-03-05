from rest_framework import serializers
from room.models import Message, Room
from django.contrib.auth.models import User

class MessageSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'user', 'username', 'room', 'value', 'date', 
            'is_read', 'read_timestamp', 'deleted_for_sender', 
            'deleted_for_everyone', 'deleted_timestamp'
        ]
        read_only_fields = ['id', 'user', 'username', 'room', 'date', 'read_timestamp', 'deleted_timestamp']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        
        # Apply deletion logic for the UI view
        if instance.deleted_for_everyone:
            data['value'] = "This message was deleted."
            return data
            
        if request and instance.deleted_for_sender and instance.user == request.user:
            return None # Don't return to sender if they deleted it for themselves
            
        return data

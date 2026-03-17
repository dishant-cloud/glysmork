from django.db import models
from django.contrib.auth.models import User
# Create your models here.

class Loop(models.Model):
    user = models.OneToOneField(User, on_delete = models.CASCADE)
    gender = models.CharField(max_length = 1)
    last_seen = models.DateTimeField(auto_now = True)

    def __str__(self):
        return f'{self.user.username} ({self.gender}) - Waiting'

class CallRequest(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'), 
        ('accepted', 'Accepted'), 
        ('rejected', 'Rejected'), 
        ('connected', 'Connected'),
    ]

    sender = models.ForeignKey(User, related_name = 'sent_request', on_delete = models.CASCADE)
    receiver = models.ForeignKey(User, related_name = 'received_requests', on_delete = models.CASCADE)
    status = models.CharField(max_length = 10, choices = STATUS_CHOICES, default = 'pending')
    room_name = models.CharField(max_length = 50, blank = True)

    timestamp = models.DateTimeField(auto_now_add = True)

    def __str__(self):
        return f'{self.sender.username} -> {self.receiver.username} ({self.status})'

class Friendship(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
    ]
    from_user = models.ForeignKey(User, related_name='friendship_requests_sent', on_delete=models.CASCADE)
    to_user = models.ForeignKey(User, related_name='friendship_requests_received', on_delete=models.CASCADE)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('from_user', 'to_user')

    def __str__(self):
        return f'{self.from_user.username} -> {self.to_user.username} ({self.status})'


class ChatNotification(models.Model):
    """Notification sent when someone initiates a chat."""
    sender = models.ForeignKey(User, related_name='chat_notifs_sent', on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name='chat_notifs_received', on_delete=models.CASCADE)
    room_name = models.CharField(max_length=200, blank=True)
    message = models.CharField(max_length=500, default='wants to chat with you')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.sender.username} → {self.receiver.username} ({"read" if self.is_read else "unread"})'

class MatchHistory(models.Model):
    """Logs history between users to prevent repeat matches."""
    user1 = models.ForeignKey(User, related_name='history_as_user1', on_delete=models.CASCADE)
    user2 = models.ForeignKey(User, related_name='history_as_user2', on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['user1', 'user2']),
        ]

    def __str__(self):
        return f'{self.user1.username} & {self.user2.username} matched at {self.timestamp}'


class OfflineSearch(models.Model):
    """Tracking node for users seeking matches while offline."""
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    intent = models.TextField()
    mode = models.CharField(max_length=10, default='chat') # chat or video
    gender_filter = models.CharField(max_length=1, default='A') # M(ale), F(emale), A(ny)
    location_filter = models.CharField(max_length=100, blank=True)
    
    daily_refresh_timestamp = models.DateTimeField(auto_now=True)
    matches_found = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f'Offline Search: {self.user.username} (Matches: {self.matches_found}/4)'

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

import uuid
from django.db import models
from django.contrib.auth.models import User


class CallLog(models.Model):
    MODE_CHOICES = [('voice', 'Voice'), ('video', 'Video')]
    STATUS_CHOICES = [
        ('ended', 'Ended'),
        ('declined', 'Declined'),
        ('no_answer', 'No Answer'),
        ('unavailable', 'Unavailable'),
        ('cancelled', 'Cancelled')
    ]

    call_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    caller = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='calls_made')
    receiver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='calls_received')
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='video')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ended')
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        caller_name = self.caller.username if self.caller else 'Unknown'
        receiver_name = self.receiver.username if self.receiver else 'Unknown'
        return f"{caller_name} → {receiver_name} ({self.mode}, {self.status}, {self.duration_seconds}s)"

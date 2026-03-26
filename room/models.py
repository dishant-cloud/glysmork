from django.db import models
from django.contrib.auth.models import User


CHAT_TYPE_SESSION = 'session'
CHAT_TYPE_FRIEND  = 'friend'

CHAT_TYPE_CHOICES = [
    (CHAT_TYPE_SESSION, 'Discovery Session'),
    (CHAT_TYPE_FRIEND,  'Friend Chat'),
]

MSG_SENT      = 'sent'
MSG_DELIVERED = 'delivered'
MSG_READ      = 'read'

MSG_STATUS_CHOICES = [
    (MSG_SENT,      'Sent'),
    (MSG_DELIVERED, 'Delivered'),
    (MSG_READ,      'Read'),
]


class Room(models.Model):
    name               = models.CharField(max_length=128)
    created_at         = models.DateTimeField(auto_now_add=True, null=True)
    users              = models.ManyToManyField(User, related_name='rooms')
    is_active          = models.BooleanField(default=True)
    chat_type          = models.CharField(
        max_length=10,
        choices=CHAT_TYPE_CHOICES,
        default=CHAT_TYPE_FRIEND,
    )
    # For session-type rooms: when should the room expire (set on creation)
    session_expires_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return self.name


class Message(models.Model):
    value              = models.CharField(max_length=1_000_000)
    date               = models.DateTimeField(auto_now_add=True)
    user               = models.ForeignKey(User, on_delete=models.CASCADE)
    room               = models.ForeignKey(Room, on_delete=models.CASCADE)

    # Status tick system
    status             = models.CharField(
        max_length=10,
        choices=MSG_STATUS_CHOICES,
        default=MSG_SENT,
    )
    read_timestamp     = models.DateTimeField(null=True, blank=True)

    # Soft-delete flags
    is_read            = models.BooleanField(default=False)   # kept for compat
    deleted_for_sender    = models.BooleanField(default=False)
    deleted_for_everyone  = models.BooleanField(default=False)
    deleted_timestamp     = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f'{self.user.username}: {self.value[:30]}…'
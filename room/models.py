from django.db import models
from django.contrib.auth.models import User  # <--- Make sure this is imported!

class Room(models.Model):
    name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True, null=True)
    users = models.ManyToManyField(User, related_name="rooms")

class Message(models.Model):
    value = models.CharField(max_length=1000000)
    date = models.DateTimeField(auto_now_add=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(Room, on_delete=models.CASCADE) # <--- Link to Room, not User!
    
    # Advanced Chat Features
    is_read = models.BooleanField(default=False)
    read_timestamp = models.DateTimeField(null=True, blank=True)
    deleted_for_sender = models.BooleanField(default=False)
    deleted_for_everyone = models.BooleanField(default=False)
    deleted_timestamp = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.user.username}: {self.value[:20]}..."
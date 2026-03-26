from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from PIL import Image
# Create your models here.


class Profile(models.Model):
    GENDER_CHOICES = [
        ('M', 'Male'), 
        ('F', 'Female'), 
        ('O', 'Other')
    ]
    user = models.OneToOneField(User, on_delete = models.CASCADE)
    image = models.ImageField(default = 'default.jpg', upload_to = 'profile_pics')
    bio = models.TextField(max_length = 500, blank = True)
    gender = models.CharField(max_length = 1, choices = GENDER_CHOICES, default = 'O')
    location = models.CharField(max_length = 100, blank = True) # Deprecated, keeping for fallback
    
    from django_countries.fields import CountryField
    country = CountryField(blank=True)
    state = models.CharField(max_length=100, blank=True)
    
    diamonds = models.IntegerField(default = 20)
    age = models.PositiveIntegerField(default = 18)
    call_price = models.IntegerField(default = 0)
    last_seen = models.DateTimeField(default = timezone.now)

    # Verification
    verification_code = models.CharField(max_length=6, blank=True, null=True)
    is_verified = models.BooleanField(default=False)
    
    # Profound AI Profiling
    psychological_profile = models.JSONField(default=dict, blank=True, help_text="AI generated deep psychological profile")
    self_reported_traits = models.JSONField(default=dict, blank=True, help_text="User's answers to the onboarding quiz")
    connection_preferences = models.JSONField(default=dict, blank=True, help_text="What kind of people and conversations the user seeks")
    last_quiz_taken = models.DateTimeField(null=True, blank=True)
    
    # Knowledge & Interest Graph (The AI uses these to match people)
    interests = models.JSONField(default=list, blank=True, help_text="Topics the user is interested in")
    expertise_areas = models.JSONField(default=list, blank=True, help_text="Topics the user has deep knowledge in")
    conversation_topics = models.JSONField(default=list, blank=True, help_text="AI-extracted topics from past conversations")
    current_intent = models.TextField(blank=True, help_text="Freeform: what the user wants to talk about right now")
    
    # Phase 3: AI Visual Assets & Trust Core
    persona_image_url = models.URLField(max_length=500, blank=True, null=True, help_text="AI generated conceptual avatar")
    chat_status_image_url = models.URLField(max_length=500, blank=True, null=True, help_text="Live AI generated status/warning image during chat")
    trust_score = models.IntegerField(default=100, help_text="Dynamic AI-adjusted trust score based on chat intent (0-100)")
    
    # Privacy Settings
    is_profile_public = models.BooleanField(default=True)
    show_ai_analysis = models.BooleanField(default=True)
    hidden_data_fields = models.JSONField(default=list, blank=True, help_text="List of keys in profile to hide from public")

    # Push Notifications
    fcm_token = models.CharField(max_length=255, blank=True, null=True, help_text="Firebase Cloud Messaging device token")

    # Moderation
    reports_received = models.IntegerField(default=0)
    is_banned = models.BooleanField(default=False)
    
    # Verification (Voting)
    male_votes = models.IntegerField(default=0)
    female_votes = models.IntegerField(default=0)

    @property
    def is_gender_locked(self):
        return (self.male_votes + self.female_votes) > 0

    def __str__(self):
        return f'{self.user.username}'
    
    def is_online(self):
        from django.core.cache import cache
        # Check high-performance Redis cache first (updated by NotificationConsumer)
        if cache.get(f'user_online_{self.user.id}'):
            return True
        # Fallback to database last_seen
        return timezone.now() - self.last_seen < timezone.timedelta(minutes = 5)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        try:
            img = Image.open(self.image.path)
            if img.height > 300 or img.width > 300:
                output_size = (300, 300)
                img.thumbnail(output_size)
                img.save(self.image.path)
        except:
             # Handle cases where image path is not accessible or other errors
             pass

class Report(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('reviewed', 'Reviewed'),
        ('action_taken', 'Action Taken'),
    ]
    reporter = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_sent')
    reported_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reports_received_incidents')
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    timestamp = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.reporter} reported {self.reported_user}"
        

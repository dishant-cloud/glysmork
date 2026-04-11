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
    languages = models.JSONField(default=list, blank=True, help_text="Languages the user speaks, e.g. ['en', 'hi']")
    latitude = models.FloatField(null=True, blank=True, help_text="GPS latitude for distance-based matching")
    longitude = models.FloatField(null=True, blank=True, help_text="GPS longitude for distance-based matching")
    geohash = models.CharField(max_length=12, blank=True, null=True, db_index=True, help_text="High-performance spatial index")
    
    # Verification & Identity
    is_verified = models.BooleanField(default=False, help_text="User has verified their identity (e.g. via Google)")
    auth_provider = models.CharField(max_length=50, default='email', help_text="The method used for authentication")
    
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
    interests_embedding = models.JSONField(default=list, blank=True, help_text="Mathematical vector embedding of interests")
    expertise_areas = models.JSONField(default=list, blank=True, help_text="Topics the user has deep knowledge in")
    expertise_embedding = models.JSONField(default=list, blank=True, help_text="Mathematical vector embedding of expertise")
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
    
    # Trust Score Tracking
    TRUST_TIER_CHOICES = [
        ('trusted', 'Trusted'),
        ('established', 'Established'),
        ('new', 'New'),
        ('flagged', 'Flagged')
    ]
    trust_tier = models.CharField(max_length=20, choices=TRUST_TIER_CHOICES, default='new')
    
    phone_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    has_profile_photo = models.BooleanField(default=False)
    has_face_in_photo = models.BooleanField(default=False)
    
    total_sessions = models.IntegerField(default=0)
    qualifying_sessions = models.IntegerField(default=0)  # over 2min with messages
    successful_searches = models.IntegerField(default=0, help_text="Number of successful live searches yielding potential users")
    friendships_made = models.IntegerField(default=0)
    
    calls_received = models.IntegerField(default=0)
    calls_answered = models.IntegerField(default=0)
    
    blocks_received = models.IntegerField(default=0)
    device_fingerprint = models.CharField(max_length=255, blank=True, null=True)
    flagged_for_review = models.BooleanField(default=False)
    trust_last_calculated_at = models.DateTimeField(default=timezone.now)

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
        # Tightened from 5m to 1m for more accurate 'live' feel
        return timezone.now() - self.last_seen < timezone.timedelta(minutes = 1)

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

class Block(models.Model):
    blocker = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocking')
    blocked_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blocked_by')
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('blocker', 'blocked_user')

    def __str__(self):
        return f"{self.blocker} blocked {self.blocked_user}"

class TrustEvent(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='trust_events')
    event_type = models.CharField(max_length=50) # e.g., 'report_received', 'friendship', 'session_end'
    points_change = models.IntegerField()
    reason = models.CharField(max_length=255)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.user.username} {self.event_type} ({self.points_change})"

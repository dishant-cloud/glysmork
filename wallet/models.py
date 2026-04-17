from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
import uuid

class SubscriptionPlan(models.Model):
    name = models.CharField(max_length=50) # Weekly, Monthly, 3 Months, 6 Months, Yearly
    duration_days = models.IntegerField()
    price_inr = models.DecimalField(max_digits=10, decimal_places=2)
    features = models.JSONField(default=list)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.name} - ₹{self.price_inr}"



class UserSubscription(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='subscription')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True)
    start_date = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    
    def is_valid(self):
        return self.is_active and self.expires_at > timezone.now()

class Transaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='transactions')
    amount_inr = models.DecimalField(max_digits=10, decimal_places=2)
    item_type = models.CharField(max_length=20, choices=[('SUBSCRIPTION', 'Subscription')])
    
    # Can be either a SubscriptionPlan ID or GemPackage ID
    item_id = models.IntegerField() 
    
    razorpay_order_id = models.CharField(max_length=100, unique=True, null=True, blank=True)
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True)
    razorpay_signature = models.CharField(max_length=200, null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=[('PENDING', 'Pending'), ('SUCCESS', 'Success'), ('FAILED', 'Failed')], default='PENDING')
    created_at = models.DateTimeField(default=timezone.now)
    
    def __str__(self):
        return f"{self.user.username} - {self.item_type} - {self.status}"

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

class Payment(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='payments')
    product_type = models.CharField(max_length=50) # gems, subscription
    razorpay_payment_id = models.CharField(max_length=100, null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.username} - {self.product_type} - {self.status}"

class Subscription(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='wallet_subscriptions')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.SET_NULL, null=True)
    razorpay_subscription_id = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50)
    next_billing_date = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - {self.plan.name if self.plan else 'Unknown'} - {self.status}"

class GemLedger(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='gem_ledger')
    gems_added = models.IntegerField(default=0)
    gems_used = models.IntegerField(default=0)
    source = models.CharField(max_length=50) # purchase, reward
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} - +{self.gems_added}/-{self.gems_used} ({self.source})"

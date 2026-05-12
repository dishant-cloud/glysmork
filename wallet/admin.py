from django.contrib import admin
from .models import SubscriptionPlan, Payment, Subscription, GemLedger

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'duration_days', 'price_inr', 'is_active')

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'product_type', 'amount', 'status', 'created_at')
    list_filter = ('status', 'product_type')

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ('user', 'plan', 'status', 'next_billing_date', 'created_at')
    list_filter = ('status',)

@admin.register(GemLedger)
class GemLedgerAdmin(admin.ModelAdmin):
    list_display = ('user', 'gems_added', 'gems_used', 'source', 'created_at')
    list_filter = ('source',)

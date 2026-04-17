from django.contrib import admin
from .models import SubscriptionPlan, UserSubscription, Transaction

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'duration_days', 'price_inr', 'is_active')


admin.site.register(UserSubscription)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'item_type', 'amount_inr', 'status', 'created_at')
    list_filter = ('status', 'item_type')

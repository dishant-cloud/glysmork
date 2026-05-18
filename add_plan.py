from wallet.models import SubscriptionPlan

SubscriptionPlan.objects.get_or_create(
    id=6,
    defaults={
        'name': '1 Day Test',
        'duration_days': 1,
        'price_inr': 9.00,
        'features': ['1 Day Trial', 'Full Premium Access']
    }
)
print("Added 1 Day Test plan")

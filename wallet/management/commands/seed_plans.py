from django.core.management.base import BaseCommand
from wallet.models import SubscriptionPlan

class Command(BaseCommand):
    help = 'Seeds the database with default subscription plans'

    def handle(self, *args, **kwargs):
        plans = [
            {'id': 1, 'name': 'Weekly', 'duration_days': 7, 'price_inr': 99},
            {'id': 2, 'name': 'Monthly', 'duration_days': 30, 'price_inr': 299},
            {'id': 3, 'name': '3 Months', 'duration_days': 90, 'price_inr': 699},
            {'id': 4, 'name': '6 Months', 'duration_days': 180, 'price_inr': 1199},
            {'id': 5, 'name': 'Yearly', 'duration_days': 365, 'price_inr': 1999}
        ]
        
        for p in plans:
            plan, created = SubscriptionPlan.objects.update_or_create(
                id=p['id'],
                defaults=p
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created Plan: {plan.name}"))
            else:
                self.stdout.write(self.style.SUCCESS(f"Updated Plan: {plan.name}"))
                
        self.stdout.write(self.style.SUCCESS('Successfully seeded all plans!'))

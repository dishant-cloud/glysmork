"""
Management command to seed SubscriptionPlan and GemPackage data.
Run: python manage.py seed_wallet
"""
from django.core.management.base import BaseCommand
from wallet.models import SubscriptionPlan, GemPackage

PLANS = [
    {"name": "Weekly",    "duration_days": 7,   "price_inr": 99,   "features": ["Unlimited Roulette", "40 AI searches/day", "100 standard searches/day"]},
    {"name": "Monthly",   "duration_days": 30,  "price_inr": 299,  "features": ["Unlimited Roulette", "40 AI searches/day", "100 standard searches/day", "Priority matching"]},
    {"name": "3 Months",  "duration_days": 90,  "price_inr": 699,  "features": ["Unlimited Roulette", "40 AI searches/day", "100 standard searches/day", "Priority matching"]},
    {"name": "6 Months",  "duration_days": 180, "price_inr": 1199, "features": ["Unlimited Roulette", "40 AI searches/day", "100 standard searches/day", "Priority matching", "Profile badge"]},
    {"name": "Yearly",    "duration_days": 365, "price_inr": 1999, "features": ["Unlimited Roulette", "40 AI searches/day", "100 standard searches/day", "Priority matching", "Profile badge", "Exclusive yearly badge"]},
]

GEMS = [
    {"name": "Small Pack",  "gem_amount": 50,   "price_inr": 99},
    {"name": "Medium Pack", "gem_amount": 150,  "price_inr": 249},
    {"name": "Large Pack",  "gem_amount": 500,  "price_inr": 799},
    {"name": "Mega Stash",  "gem_amount": 1500, "price_inr": 1999},
]

class Command(BaseCommand):
    help = "Seed SubscriptionPlan and GemPackage tables with default data"

    def handle(self, *args, **options):
        self.stdout.write("Seeding Subscription Plans...")
        for i, plan in enumerate(PLANS, start=1):
            obj, created = SubscriptionPlan.objects.update_or_create(
                id=i,
                defaults={**plan, "is_active": True}
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action}: {obj.name} (Rs.{obj.price_inr})")

        self.stdout.write("Seeding Gem Packages...")
        for i, gem in enumerate(GEMS, start=1):
            obj, created = GemPackage.objects.update_or_create(
                id=i,
                defaults={**gem, "is_active": True}
            )
            action = "Created" if created else "Updated"
            self.stdout.write(f"  {action}: {obj.name} ({obj.gem_amount} Gems @ Rs.{obj.price_inr})")

        self.stdout.write(self.style.SUCCESS("Done! Wallet data seeded successfully."))

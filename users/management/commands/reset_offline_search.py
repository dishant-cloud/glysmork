from django.core.management.base import BaseCommand
from users.models import Profile

class Command(BaseCommand):
    help = 'Resets available_for_offline_search to False for all profiles. Run via cron daily at 12 PM GMT.'

    def handle(self, *args, **options):
        updated_count = Profile.objects.filter(available_for_offline_search=True).update(available_for_offline_search=False)
        self.stdout.write(self.style.SUCCESS(f'Successfully reset offline search for {updated_count} profiles.'))

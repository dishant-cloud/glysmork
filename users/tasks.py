from celery import shared_task
from django.contrib.auth.models import User
from users.trust import calculate_trust_score

@shared_task
def hourly_trust_recalculation():
    """
    Background job that runs every hour to handle decay, streak recovery, and cleanup.
    """
    users = User.objects.filter(is_active=True)
    for user in users:
        calculate_trust_score(user.id)
    return f"Recalculated trust scores for {users.count()} users."

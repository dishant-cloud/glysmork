import firebase_admin
from firebase_admin import credentials, messaging
from users.models import Profile

# Initialize Firebase on load if not already initialized
if not firebase_admin._apps:
    try:
        # This defaults to the GOOGLE_APPLICATION_CREDENTIALS environment variable
        # Required for firebase-admin auth.
        default_app = firebase_admin.initialize_app()
    except Exception as e:
        print(f"Firebase Admin SDK initialization failed (Normal in test environments without credentials): {e}")

def send_fcm_push(user_id, title, body, data_payload=None):
    """
    Sends an FCM push notification to the specified user's device.
    If the device token is invalid or unregistered, it cleanly removes it from the database.
    """
    if data_payload is None:
        data_payload = {}
        
    try:
        profile = Profile.objects.get(user__id=user_id)
        token = profile.fcm_token
    except Profile.DoesNotExist:
        return False
        
    if not token:
        # User has no token to receive pushes
        return False
        
    # Ensure all data_payload values are strings (FCM limitation)
    stringified_data = {str(k): str(v) for k, v in data_payload.items()}
        
    try:
        message = messaging.Message(
            notification=messaging.Notification(
                title=title,
                body=body,
            ),
            data=stringified_data,
            token=token,
        )
        response = messaging.send(message)
        print(f"Successfully sent FCM push to {user_id}: {response}")
        return True
    
    except messaging.UnregisteredError:
        # The token is no longer valid, clear it
        profile.fcm_token = None
        profile.save(update_fields=['fcm_token'])
        print(f"FCM Token for user {user_id} was unregistered. Cleared from DB.")
        return False
    except messaging.SenderIdMismatchError:
        # The token doesn't belong to this sender ID
        profile.fcm_token = None
        profile.save(update_fields=['fcm_token'])
        print(f"FCM Token mismatch for user {user_id}. Cleared from DB.")
        return False
    except ValueError as ve:
        # Triggers if the token format is wildly incorrect before sending
        print(f"FCM Token format invalid for user {user_id}. Cleared from DB.")
        profile.fcm_token = None
        profile.save(update_fields=['fcm_token'])
        return False
    except Exception as e:
        print(f"Error sending FCM Push to {user_id}: {e}")
        return False

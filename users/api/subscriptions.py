import stripe
import os
from datetime import timedelta
from django.utils import timezone
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.http import HttpResponse
from users.models import Profile, Subscription

stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

class StripeCheckoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_type = request.data.get('plan_type') # 'weekly' or 'monthly'
        
        if plan_type not in ['weekly', 'monthly']:
            return Response({"error": "Invalid plan type. Use 'weekly' or 'monthly'."}, status=status.HTTP_400_BAD_REQUEST)

        # In a real app, these Price IDs come from your Stripe Dashboard
        # For development, we can use the product names or look them up
        # We will assume the frontend handles the redirection to the returned URL
        
        prices = {
            'weekly': os.environ.get('STRIPE_WEEKLY_PRICE_ID'),
            'monthly': os.environ.get('STRIPE_MONTHLY_PRICE_ID')
        }

        price_id = prices.get(plan_type)
        if not price_id:
            return Response({"error": f"Stripe Price ID for {plan_type} not configured in backend."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        try:
            profile = request.user.profile
            checkout_session = stripe.checkout.Session.create(
                customer_email=request.user.email,
                payment_method_types=['card'],
                line_items=[
                    {
                        'price': price_id,
                        'quantity': 1,
                    },
                ],
                mode='subscription',
                success_url=os.environ.get('FRONTEND_URL', 'https://www.glysmork.com') + '/pricing/success?session_id={CHECKOUT_SESSION_ID}',
                cancel_url=os.environ.get('FRONTEND_URL', 'https://www.glysmork.com') + '/pricing/cancel',
                metadata={
                    'user_id': request.user.id,
                    'plan_type': plan_type
                }
            )
            return Response({'checkout_url': checkout_session.url})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@method_decorator(csrf_exempt, name='dispatch')
class StripeWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        payload = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE')
        endpoint_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')

        event = None

        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, endpoint_secret
            )
        except ValueError as e:
            return HttpResponse(status=400)
        except stripe.error.SignatureVerificationError as e:
            return HttpResponse(status=400)

        # Handle the event
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            self.handle_checkout_completed(session)
        
        elif event['type'] == 'customer.subscription.deleted':
            subscription = event['data']['object']
            self.handle_subscription_canceled(subscription)

        return HttpResponse(status=200)

    def handle_checkout_completed(self, session):
        from django.contrib.auth.models import User
        user_id = session.get('metadata', {}).get('user_id')
        plan_type = session.get('metadata', {}).get('plan_type')
        stripe_sub_id = session.get('subscription')
        
        if not user_id:
            return

        try:
            user = User.objects.get(id=user_id)
            profile = user.profile
            
            # Calculate expiry
            expiry_date = timezone.now()
            if plan_type == 'weekly':
                expiry_date += timedelta(days=7)
            else:
                expiry_date += timedelta(days=30)

            profile.subscription_tier = plan_type
            profile.subscription_expiry = expiry_date
            profile.stripe_customer_id = session.get('customer')
            profile.save()

            # Log the subscription
            Subscription.objects.create(
                user=user,
                plan_type=plan_type,
                stripe_subscription_id=stripe_sub_id,
                status='active',
                amount=session.get('amount_total', 0) / 100,
                currency=session.get('currency', 'usd'),
                ends_at=expiry_date
            )
            print(f"SUCCESS: User {user.username} upgraded to {plan_type}")
        except Exception as e:
            print(f"ERROR in Webhook: {str(e)}")

    def handle_subscription_canceled(self, subscription):
        stripe_sub_id = subscription.get('id')
        try:
            sub_record = Subscription.objects.get(stripe_subscription_id=stripe_sub_id)
            profile = sub_record.user.profile
            profile.subscription_tier = 'free'
            # We keep subscription_expiry as is (user might still have days left), 
            # but usually canceling stripe sub means they lose access at end of period.
            profile.save()
            sub_record.status = 'canceled'
            sub_record.save()
        except:
            pass

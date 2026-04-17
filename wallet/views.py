from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings
from .models import Transaction, UserSubscription, SubscriptionPlan
import razorpay
from django.utils import timezone

# Mock Razorpay Client for testing
razorpay_client = razorpay.Client(auth=("rzp_test_mock_key_123", "rzp_test_mock_secret_123"))

class CreateOrderView(APIView):
    def post(self, request):
        user = request.user
        item_type = request.data.get('item_type') # 'SUBSCRIPTION' or 'GEMS'
        item_id = request.data.get('item_id')
        
        if item_type == 'SUBSCRIPTION':
            try:
                item = SubscriptionPlan.objects.get(id=item_id, is_active=True)
            except SubscriptionPlan.DoesNotExist:
                return Response({"error": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({"error": "Invalid item type"}, status=status.HTTP_400_BAD_REQUEST)
            
        amount = int(item.price_inr * 100) # Razorpay expects paise
        
        # Create Razorpay Order
        payment_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"receipt_{user.id}_{item_type}_{item_id}"
        }
        
        try:
            order = razorpay_client.order.create(data=payment_data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        # Create DB Transaction record
        transaction = Transaction.objects.create(
            user=user,
            amount_inr=item.price_inr,
            item_type=item_type,
            item_id=item_id,
            razorpay_order_id=order['id']
        )
        
        return Response({
            "order_id": order['id'],
            "amount": amount,
            "currency": order['currency'],
            "transaction_id": transaction.id
        })

class VerifyPaymentView(APIView):
    def post(self, request):
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature = request.data.get('razorpay_signature')
        
        try:
            transaction = Transaction.objects.get(razorpay_order_id=razorpay_order_id)
        except Transaction.DoesNotExist:
            return Response({"error": "Transaction not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # Verify Signature
        try:
            razorpay_client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            })
        except razorpay.errors.SignatureVerificationError:
            transaction.status = 'FAILED'
            transaction.save()
            return Response({"error": "Signature verification failed"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Payment is successful
        transaction.status = 'SUCCESS'
        transaction.razorpay_payment_id = razorpay_payment_id
        transaction.razorpay_signature = razorpay_signature
        transaction.save()
        
        # Fulfill Order
        if transaction.item_type == 'SUBSCRIPTION':
            plan = SubscriptionPlan.objects.get(id=transaction.item_id)
            sub, created = UserSubscription.objects.get_or_create(user=transaction.user)
            sub.plan = plan
            sub.is_active = True
            
            # If already subscribed, extend it. Else from now.
            start = sub.expires_at if (not created and sub.is_valid()) else timezone.now()
            sub.expires_at = start + timezone.timedelta(days=plan.duration_days)
            sub.save()
            

        return Response({"status": "Payment verified and item fulfilled"})

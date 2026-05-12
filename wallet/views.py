from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from django.conf import settings
from .models import Payment, Subscription, SubscriptionPlan, GemLedger
import razorpay
from django.utils import timezone
from datetime import timedelta

# Razorpay Client
razorpay_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

class PlanListView(APIView):
    permission_classes = [permissions.AllowAny]
    def get(self, request):
        plans = SubscriptionPlan.objects.filter(is_active=True).order_by('price_inr')
        data = [{
            "id": p.id,
            "name": p.name,
            "price": float(p.price_inr),
            "duration_days": p.duration_days,
            "features": p.features
        } for p in plans]
        return Response(data)

class CreateOrderView(APIView):
    def post(self, request):
        user = request.user
        product_type = request.data.get('product_type') # 'subscription', 'gems', 'mitoforge'
        item_id = request.data.get('item_id')
        
        if product_type == 'subscription':
            try:
                item = SubscriptionPlan.objects.get(id=item_id, is_active=True)
                amount = int(item.price_inr * 100)
            except SubscriptionPlan.DoesNotExist:
                return Response({"error": "Plan not found"}, status=status.HTTP_404_NOT_FOUND)
        elif product_type == 'gems':
            amount = int(request.data.get('amount', 0)) * 100
        elif product_type == 'mitoforge':
            amount = int(request.data.get('amount', 0)) * 100
        else:
            return Response({"error": "Invalid product type"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Create Razorpay Order
        payment_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"receipt_{user.id}_{product_type}_{item_id}"
        }
        
        try:
            order = razorpay_client.order.create(data=payment_data)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
        # Create DB Payment record
        payment = Payment.objects.create(
            user=user,
            amount=amount / 100,
            product_type=product_type,
            status='pending',
            razorpay_payment_id=order['id'] # Store order ID here temporarily until verified
        )
        
        return Response({
            "order_id": order['id'],
            "amount": amount,
            "currency": order['currency'],
            "payment_id": payment.id
        })

class VerifyPaymentView(APIView):
    def post(self, request):
        razorpay_order_id = request.data.get('razorpay_order_id')
        razorpay_payment_id = request.data.get('razorpay_payment_id')
        razorpay_signature = request.data.get('razorpay_signature')
        
        try:
            payment = Payment.objects.get(razorpay_payment_id=razorpay_order_id)
        except Payment.DoesNotExist:
            return Response({"error": "Payment not found"}, status=status.HTTP_404_NOT_FOUND)
            
        # Verify Signature
        try:
            razorpay_client.utility.verify_payment_signature({
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            })
        except razorpay.errors.SignatureVerificationError:
            payment.status = 'failed'
            payment.save()
            return Response({"error": "Signature verification failed"}, status=status.HTTP_400_BAD_REQUEST)
            
        # Payment is successful
        payment.status = 'success'
        payment.razorpay_payment_id = razorpay_payment_id
        payment.save()
        
        # Fulfill Order
        if payment.product_type == 'subscription':
            plan_id = request.data.get('item_id')
            try:
                plan = SubscriptionPlan.objects.get(id=plan_id)
                Subscription.objects.update_or_create(
                    user=payment.user,
                    defaults={
                        'plan': plan,
                        'status': 'active',
                        'next_billing_date': timezone.now() + timedelta(days=plan.duration_days)
                    }
                )
            except SubscriptionPlan.DoesNotExist:
                pass
        elif payment.product_type == 'gems':
            gems_amount = int(request.data.get('gems_amount', 0))
            GemLedger.objects.create(
                user=payment.user,
                gems_added=gems_amount,
                source='purchase'
            )
            
        return Response({"status": "success", "message": "Payment verified and order fulfilled"})

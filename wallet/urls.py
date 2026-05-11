from django.urls import path
from .views import CreateOrderView, VerifyPaymentView, PlanListView

urlpatterns = [
    path('plans/', PlanListView.as_view(), name='plan-list'),
    path('order/create/', CreateOrderView.as_view(), name='create-order'),
    path('order/verify/', VerifyPaymentView.as_view(), name='verify-payment'),
]

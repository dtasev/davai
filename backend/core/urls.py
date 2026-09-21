from django.contrib import admin
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from tracker.api import api
from strawberry.django.views import AsyncGraphQLView
from tracker.schema import schema
from mozilla_django_oidc.views import OIDCAuthenticationRequestView, OIDCAuthenticationCallbackView
from tracker.views import oidc_logout

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login', OIDCAuthenticationRequestView.as_view(), name='oidc_authentication_init'),
    path('api/auth/oidc/login', OIDCAuthenticationRequestView.as_view(), name='login'),
    path('api/auth/oidc/callback', OIDCAuthenticationCallbackView.as_view(), name='oidc_authentication_callback'),
    path('api/auth/logout', csrf_exempt(oidc_logout), name='logout'),
    path('api/auth/oidc/logout', csrf_exempt(oidc_logout), name='oidc_logout'),
    path('api/', api.urls),
    path('graphql', csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
    path('graphql/', csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
]

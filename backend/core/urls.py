from django.contrib import admin
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from tracker.api import api
from strawberry.django.views import AsyncGraphQLView
from tracker.schema import schema
from tracker.views import oidc_login, oidc_callback, oidc_logout

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login', oidc_login, name='login'),
    path('api/auth/oidc/login', oidc_login, name='oidc_login'),
    path('api/auth/oidc/callback', oidc_callback, name='oidc_callback'),
    path('api/auth/logout', csrf_exempt(oidc_logout), name='logout'),
    path('api/auth/oidc/logout', csrf_exempt(oidc_logout), name='oidc_logout'),
    path('api/', api.urls),
    path('graphql', csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
    path('graphql/', csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
]

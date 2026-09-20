from django.contrib import admin
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from tracker.api import api
from strawberry.django.views import AsyncGraphQLView
from tracker.schema import schema

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', api.urls),
    path('graphql', csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
    path('graphql/', csrf_exempt(AsyncGraphQLView.as_view(schema=schema))),
]

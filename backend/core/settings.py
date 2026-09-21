import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-dev-key-change-in-production-6477')
DEBUG = os.getenv('DEBUG', '1') == '1'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'corsheaders',
    'ninja',
    'strawberry_django',
    'mozilla_django_oidc',
    # Local apps
    'tracker',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core.wsgi.application'
ASGI_APPLICATION = 'core.asgi.application'

# Database: PostgreSQL 18 (default) with optional SQLite fallback
use_sqlite = os.getenv('USE_SQLITE', '0') == '1' or not os.getenv('POSTGRES_HOST')

if use_sqlite:
    db_path_env = os.getenv('SQLITE_DB_PATH', '/app/data/db.sqlite3')
    db_path = Path(db_path_env)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': db_path,
            'TEST': {
                'NAME': db_path.parent / (f"test_{db_path.name}" if not db_path.name.startswith("test_") else db_path.name),
            },
        }
    }
else:
    postgres_db = os.getenv('POSTGRES_DB', 'davai')
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': postgres_db,
            'USER': os.getenv('POSTGRES_USER', 'davai'),
            'PASSWORD': os.getenv('POSTGRES_PASSWORD', 'davai_dev_secret_password_6477'),
            'HOST': os.getenv('POSTGRES_HOST', 'postgres'),
            'PORT': os.getenv('POSTGRES_PORT', '5432'),
            'TEST': {
                'NAME': f'test_{postgres_db}',
            },
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS configuration
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

CSRF_TRUSTED_ORIGINS = [
    'https://davai-dev.ecmwf.int',
    'https://davai.ecmwf.int',
    'https://davai.dtasev.co.uk',
    'http://127.0.0.1:6477',
    'http://localhost:6477',
]

AUTHELIA_AUTH_URL = os.environ.get(
    "AUTHELIA_AUTH_URL",
    "http://authelia:9091/api/authz/auth-request"
)

OIDC_ISSUER_URL = os.environ.get(
    "OIDC_ISSUER_URL",
    "http://authelia:9091/authelia"
).rstrip("/")

OIDC_AUDIENCE = os.environ.get("OIDC_AUDIENCE", "davai")
OIDC_JWKS_URL = os.environ.get("OIDC_JWKS_URL", f"{OIDC_ISSUER_URL}/jwks.json")
OIDC_USERINFO_URL = os.environ.get("OIDC_USERINFO_URL", f"{OIDC_ISSUER_URL}/api/oidc/userinfo")
OIDC_FORWARDED_HOST = os.environ.get("OIDC_FORWARDED_HOST", "davai-dev.ecmwf.int")

# Session Cookie configuration
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_AGE = 86400 * 7  # 7 days

# OIDC Client settings for Backend-driven flow (mozilla-django-oidc & custom views)
OIDC_CLIENT_ID = os.environ.get("OIDC_CLIENT_ID", "davai")
OIDC_CLIENT_SECRET = os.environ.get("OIDC_CLIENT_SECRET", "davai_oidc_client_secret_dev_key_40_chars_min")
OIDC_TOKEN_URL = os.environ.get("OIDC_TOKEN_URL", f"{OIDC_ISSUER_URL}/api/oidc/token")
OIDC_AUTHORIZATION_URL = os.environ.get("OIDC_AUTHORIZATION_URL", f"{OIDC_ISSUER_URL}/api/oidc/authorization")
OIDC_REDIRECT_URI = os.environ.get("OIDC_REDIRECT_URI", "")
OIDC_SCOPES = os.environ.get("OIDC_SCOPES", "openid email")

# mozilla-django-oidc settings
OIDC_RP_CLIENT_ID = OIDC_CLIENT_ID
OIDC_RP_CLIENT_SECRET = OIDC_CLIENT_SECRET
OIDC_RP_SCOPES = OIDC_SCOPES
OIDC_RP_SIGN_ALGO = "RS256"
OIDC_OP_AUTHORIZATION_ENDPOINT = OIDC_AUTHORIZATION_URL
OIDC_OP_TOKEN_ENDPOINT = OIDC_TOKEN_URL
OIDC_OP_USER_ENDPOINT = OIDC_USERINFO_URL
OIDC_OP_JWKS_ENDPOINT = OIDC_JWKS_URL
OIDC_USE_PKCE = True
OIDC_PKCE_CODE_CHALLENGE_METHOD = "S256"
LOGIN_REDIRECT_URL = "/"
LOGOUT_REDIRECT_URL = "/"

AUTHENTICATION_BACKENDS = [
    'tracker.auth.DavaiOIDCAuthenticationBackend',
    'django.contrib.auth.backends.ModelBackend',
]

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{asctime} [{levelname}] {name}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'tracker': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

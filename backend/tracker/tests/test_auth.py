import pytest
from tracker.auth import generate_api_key, verify_api_key, hash_key
from tracker.models import APIKey

@pytest.mark.django_db
class TestAuth:
    def test_generate_api_key_format(self, test_user):
        api_key, raw_key = generate_api_key(test_user, name="CLI Key")

        assert raw_key.startswith("dav_live_")
        assert len(raw_key) > 30
        assert api_key.name == "CLI Key"
        assert api_key.user == test_user
        assert api_key.is_active is True
        assert api_key.prefix == raw_key[:14]
        assert api_key.key_hash == hash_key(raw_key)
        assert api_key.last_used_at is None

    def test_verify_valid_api_key(self, test_user):
        _, raw_key = generate_api_key(test_user, name="Valid Key")

        authenticated_user = verify_api_key(raw_key)
        assert authenticated_user is not None
        assert authenticated_user.id == test_user.id
        assert authenticated_user.username == test_user.username

        # Verify last_used_at was updated
        key_record = APIKey.objects.get(user=test_user, name="Valid Key")
        assert key_record.last_used_at is not None

    def test_verify_revoked_api_key(self, test_user):
        api_key, raw_key = generate_api_key(test_user, name="Revoked Key")
        api_key.is_active = False
        api_key.save()

        assert verify_api_key(raw_key) is None

    def test_verify_invalid_key(self, test_user):
        assert verify_api_key("dav_live_doesnotexist123456789") is None
        assert verify_api_key("") is None
        assert verify_api_key(None) is None

    def test_extract_oidc_user_details_priority(self):
        from tracker.auth import extract_oidc_user_details

        # 1. preferred_username takes top precedence
        u1, e1, n1, g1 = extract_oidc_user_details({
            "preferred_username": "dimitar",
            "email": "dimitar@ecmwf.int",
            "nickname": "d_nick",
            "sub": "7cfeb968-6cb8-4d1f-8a21-00fadee4ce14",
            "groups": ["dev", "ecmwf"],
        })
        assert u1 == "dimitar"
        assert e1 == "dimitar@ecmwf.int"
        assert g1 == "dev,ecmwf"

        # 2. nickname when preferred_username missing
        u2, _, _, _ = extract_oidc_user_details({
            "nickname": "d_nick",
            "email": "dimitar@ecmwf.int",
            "sub": "7cfeb968-6cb8-4d1f-8a21-00fadee4ce14",
        })
        assert u2 == "d_nick"

        # 3. email prefix fallback when neither preferred_username nor nickname
        u3, _, _, _ = extract_oidc_user_details({
            "email": "dtasev@ecmwf.int",
            "sub": "7cfeb968-6cb8-4d1f-8a21-00fadee4ce14",
        })
        assert u3 == "dtasev"

        # 4. name when single word
        u4, _, _, _ = extract_oidc_user_details({
            "name": "dimitar",
            "sub": "7cfeb968-6cb8-4d1f-8a21-00fadee4ce14",
        })
        assert u4 == "dimitar"

        # 5. sub fallback when no readable fields exist
        u5, _, _, _ = extract_oidc_user_details({
            "sub": "7cfeb968-6cb8-4d1f-8a21-00fadee4ce14",
        })
        assert u5 == "7cfeb968-6cb8-4d1f-8a21-00fadee4ce14"

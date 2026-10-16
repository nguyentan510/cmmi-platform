from urllib.parse import parse_qs, urlparse

import boto3
from botocore.config import Config
from botocore.stub import Stubber

from app.core.config import Settings
from app.core.r2_client import R2Storage


def adapter():
    settings = Settings(_env_file=None, r2_bucket_name="fixture-bucket")
    client = boto3.client(
        "s3",
        endpoint_url="https://r2.example.test",
        region_name="auto",
        aws_access_key_id="fixture-access-id",
        aws_secret_access_key="fixture-secret-not-real",
        config=Config(signature_version="s3v4"),
    )
    return R2Storage(settings, client), client


async def test_real_sdk_signs_staging_put_with_content_type_and_expiry():
    storage, _ = adapter()
    url = await storage.presign("staging/user/asset", "image/png")
    query = parse_qs(urlparse(url).query)
    assert urlparse(url).path == "/fixture-bucket/staging/user/asset"
    assert query["X-Amz-Expires"] == ["900"]
    assert "content-type" in query["X-Amz-SignedHeaders"][0]


async def test_real_sdk_copy_is_conditioned_on_verified_etag():
    storage, client = adapter()
    with Stubber(client) as stub:
        stub.add_response(
            "copy_object",
            {"CopyObjectResult": {"ETag": '"new-etag"'}},
            {
                "Bucket": "fixture-bucket",
                "Key": "user/asset",
                "CopySource": {"Bucket": "fixture-bucket", "Key": "staging/user/asset"},
                "CopySourceIfMatch": '"verified-etag"',
            },
        )
        response = await storage.promote("staging/user/asset", "user/asset", '"verified-etag"')
        assert response["CopyObjectResult"]["ETag"] == '"new-etag"'


async def test_delete_respects_s3_batch_limit_and_partial_failure():
    storage, client = adapter()
    keys = [f"asset-{index}" for index in range(1001)]
    with Stubber(client) as stub:
        stub.add_response(
            "delete_objects",
            {
                "Deleted": [{"Key": key} for key in keys[:999]],
                "Errors": [{"Key": keys[999], "Code": "AccessDenied", "Message": "Denied"}],
            },
            {
                "Bucket": "fixture-bucket",
                "Delete": {"Objects": [{"Key": key} for key in keys[:1000]], "Quiet": False},
            },
        )
        stub.add_response(
            "delete_objects",
            {"Deleted": [{"Key": keys[1000]}]},
            {"Bucket": "fixture-bucket", "Delete": {"Objects": [{"Key": keys[1000]}], "Quiet": False}},
        )
        deleted = await storage.delete(keys)
        assert len(deleted) == 1000
        assert keys[999] not in deleted and keys[1000] in deleted

import asyncio
from functools import cached_property

import boto3
from botocore.config import Config


class R2Storage:
    def __init__(self, settings, client=None):
        self.settings = settings
        self._client = client

    @cached_property
    def client(self):
        if self._client is not None:
            return self._client
        if not all(
            [
                self.settings.r2_endpoint_url,
                self.settings.r2_access_key_id,
                self.settings.r2_secret_access_key,
                self.settings.r2_bucket_name,
            ]
        ):
            raise OSError("R2 is not configured")
        return boto3.client(
            "s3",
            endpoint_url=self.settings.r2_endpoint_url,
            aws_access_key_id=self.settings.r2_access_key_id,
            aws_secret_access_key=self.settings.r2_secret_access_key,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                connect_timeout=5,
                read_timeout=30,
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    async def presign(self, key: str, mime: str) -> str:
        return await asyncio.to_thread(
            self.client.generate_presigned_url,
            "put_object",
            Params={"Bucket": self.settings.r2_bucket_name, "Key": key, "ContentType": mime},
            ExpiresIn=900,
            HttpMethod="PUT",
        )

    async def head(self, key: str) -> dict:
        return await asyncio.to_thread(self.client.head_object, Bucket=self.settings.r2_bucket_name, Key=key)

    async def promote(self, source: str, target: str, etag: str):
        # The browser's signed URL can never write the canonical object.
        return await asyncio.to_thread(
            self.client.copy_object,
            Bucket=self.settings.r2_bucket_name,
            Key=target,
            CopySource={"Bucket": self.settings.r2_bucket_name, "Key": source},
            CopySourceIfMatch=etag,
        )

    async def delete(self, keys: list[str]) -> set[str]:
        deleted = set()
        for offset in range(0, len(keys), 1000):
            batch = keys[offset : offset + 1000]
            response = await asyncio.to_thread(
                self.client.delete_objects,
                Bucket=self.settings.r2_bucket_name,
                Delete={"Objects": [{"Key": key} for key in batch], "Quiet": False},
            )
            errors = {item["Key"] for item in response.get("Errors", [])}
            deleted.update(item["Key"] for item in response.get("Deleted", []) if item["Key"] not in errors)
        return deleted

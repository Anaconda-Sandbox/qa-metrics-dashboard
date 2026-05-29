import json
import logging
import os
from typing import Any

import redis

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
DEFAULT_TTL = 600  # 10 minutes

_redis_client: redis.Redis | None = None


def get_redis() -> redis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def cache_get(key: str) -> Any | None:
    try:
        client = get_redis()
        data = client.get(key)
        if data:
            return json.loads(data)
        return None
    except redis.RedisError as e:
        logger.warning(f"Redis GET error for {key}: {e}")
        return None


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> bool:
    try:
        client = get_redis()
        client.setex(key, ttl, json.dumps(value))
        return True
    except redis.RedisError as e:
        logger.warning(f"Redis SET error for {key}: {e}")
        return False


def cache_keys(pattern: str) -> list[str]:
    try:
        client = get_redis()
        return list(client.keys(pattern))
    except redis.RedisError as e:
        logger.warning(f"Redis KEYS error for {pattern}: {e}")
        return []


def is_redis_available() -> bool:
    try:
        client = get_redis()
        client.ping()
        return True
    except redis.RedisError:
        return False

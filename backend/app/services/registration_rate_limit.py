import hashlib

from redis.asyncio import Redis

from app.config import settings

IP_PER_MINUTE_LIMIT = 5
IP_PER_HOUR_LIMIT = 20
GLOBAL_PER_MINUTE_LIMIT = 120

_RATE_LIMIT_SCRIPT = """
local now = tonumber(redis.call('TIME')[1])
local minute_bucket = math.floor(now / 60)
local hour_bucket = math.floor(now / 3600)
local keys = {
    KEYS[1] .. ':m:' .. minute_bucket,
    KEYS[1] .. ':h:' .. hour_bucket,
    KEYS[2] .. ':m:' .. minute_bucket
}
local limits = {
    tonumber(ARGV[1]),
    tonumber(ARGV[2]),
    tonumber(ARGV[3])
}
local ttls = {120, 7200, 120}
local retries = {
    60 - (now % 60),
    3600 - (now % 3600),
    60 - (now % 60)
}
local allowed = 1
local retry_after = 1

for i = 1, 3 do
    local count = redis.call('INCR', keys[i])
    if count == 1 then
        redis.call('EXPIRE', keys[i], ttls[i])
    end
    if count > limits[i] then
        allowed = 0
        retry_after = math.max(retry_after, retries[i])
    end
end

return {allowed, retry_after}
"""

_redis = Redis.from_url(
    settings.REDIS_URL,
    decode_responses=True,
    socket_connect_timeout=1,
    socket_timeout=1,
)


async def check_registration_rate_limit(client_address: str) -> tuple[bool, int]:
    client_hash = hashlib.sha256(client_address.encode("utf-8")).hexdigest()
    result = await _redis.eval(
        _RATE_LIMIT_SCRIPT,
        2,
        f"millex:rate:registration:ip:{client_hash}",
        "millex:rate:registration:global",
        IP_PER_MINUTE_LIMIT,
        IP_PER_HOUR_LIMIT,
        GLOBAL_PER_MINUTE_LIMIT,
    )
    return bool(result[0]), int(result[1])


async def close_registration_rate_limiter() -> None:
    await _redis.aclose()

"""Shared in-process TTL cache for expensive async endpoints.

Single-worker, hackathon-scale. Not Redis — we don't need multi-worker coherence.

Usage:
    from app.core.cache import async_cached, invalidate, invalidate_prefix

    @async_cached(namespace="rider_claims", ttl=60, key=lambda rider, **kw: rider.id)
    async def list_claims(rider, db): ...

    # After a write that affects rider 42:
    invalidate("rider_claims", 42)

    # Or bust every rider-scoped cache for rider 42 in one call:
    invalidate_prefix("rider:42")
"""

from __future__ import annotations

import asyncio
import time
from functools import wraps
from typing import Any, Awaitable, Callable


# key = (namespace, key_repr) -> (expires_at_monotonic, value)
_store: dict[tuple[str, str], tuple[float, Any]] = {}
_lock = asyncio.Lock()


def _make_key(namespace: str, key: Any) -> tuple[str, str]:
    return (namespace, repr(key))


async def _get(namespace: str, key: Any) -> Any | None:
    now = time.monotonic()
    entry = _store.get(_make_key(namespace, key))
    if entry and entry[0] > now:
        return entry[1]
    return None


async def _set(namespace: str, key: Any, value: Any, ttl: float) -> None:
    async with _lock:
        _store[_make_key(namespace, key)] = (time.monotonic() + ttl, value)


def invalidate(namespace: str, key: Any) -> None:
    """Remove one cache entry. Safe to call without an event loop."""
    _store.pop(_make_key(namespace, key), None)


def invalidate_namespace(namespace: str) -> None:
    """Drop every entry in a namespace — used for 'bust everything' writes."""
    dead = [k for k in _store if k[0] == namespace]
    for k in dead:
        _store.pop(k, None)


def invalidate_prefix(prefix: str) -> None:
    """Drop every entry whose key-repr starts with `prefix`.
    Use when a mutation affects multiple namespaces for the same entity.
    """
    dead = [k for k in _store if k[1].startswith(prefix) or k[0].startswith(prefix)]
    for k in dead:
        _store.pop(k, None)


def async_cached(
    *,
    namespace: str,
    ttl: float,
    key: Callable[..., Any] | None = None,
) -> Callable[[Callable[..., Awaitable[Any]]], Callable[..., Awaitable[Any]]]:
    """Decorator — memoize an async function for `ttl` seconds.

    `key` receives the same args/kwargs as the wrapped function and returns a
    hashable cache key. If omitted, the cache key is the positional args tuple
    (works for functions with no params, or simple value-type args).
    """
    def decorator(fn: Callable[..., Awaitable[Any]]) -> Callable[..., Awaitable[Any]]:
        @wraps(fn)
        async def wrapper(*args, **kwargs):
            k = key(*args, **kwargs) if key is not None else args
            cached = await _get(namespace, k)
            if cached is not None:
                return cached
            result = await fn(*args, **kwargs)
            if result is not None:
                await _set(namespace, k, result, ttl)
            return result
        return wrapper
    return decorator

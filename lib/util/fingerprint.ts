import { type Hash, createHash } from 'node:crypto';

// Returns true when `value` would appear in the canonical JSON produced by
// `safe-stable-stringify`. We pre-check before emitting because objects must
// drop keys whose value resolves to nothing (incl. via toJSON → undefined),
// and incremental hashing can't roll back already-emitted bytes.
//
// `cache` memoizes the result per object reference so callers that invoke
// isEmittable just before recursing don't re-walk the toJSON chain twice.
function isEmittable(value: unknown, cache: WeakMap<object, boolean>): boolean {
  if (
    value === undefined ||
    typeof value === 'function' ||
    typeof value === 'symbol'
  ) {
    return false;
  }
  if (value === null || typeof value !== 'object') {
    return true;
  }
  const cached = cache.get(value);
  if (cached !== undefined) {
    return cached;
  }
  const obj = value as { toJSON?: () => unknown };
  const result =
    typeof obj.toJSON === 'function' ? isEmittable(obj.toJSON(), cache) : true;
  cache.set(value, result);
  return result;
}

// Walks `value` and emits canonical JSON chunks directly into `h`,
// matching `safe-stable-stringify` (deterministic mode) byte-for-byte
// without materializing the full string. Required to avoid V8's max
// string length when the input is large (e.g. a PR carrying upgrades
// across hundreds of manifest files).
function fingerprintInto(
  h: Hash,
  value: unknown,
  seen: WeakSet<object>,
  emittableCache: WeakMap<object, boolean>,
): void {
  if (value === null || typeof value !== 'object') {
    h.update(JSON.stringify(value));
    return;
  }

  const obj = value as { toJSON?: () => unknown };
  if (typeof obj.toJSON === 'function') {
    fingerprintInto(h, obj.toJSON(), seen, emittableCache);
    return;
  }

  if (seen.has(value)) {
    h.update('"[Circular]"');
    return;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    h.update('[');
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        h.update(',');
      }
      const item: unknown = value[i];
      if (isEmittable(item, emittableCache)) {
        fingerprintInto(h, item, seen, emittableCache);
      } else {
        h.update('null');
      }
    }
    h.update(']');
  } else {
    const entries = value as Record<string, unknown>;
    const keys = Object.keys(entries).sort();
    h.update('{');
    let first = true;
    for (const k of keys) {
      const v = entries[k];
      if (!isEmittable(v, emittableCache)) {
        continue;
      }
      if (!first) {
        h.update(',');
      }
      first = false;
      h.update(JSON.stringify(k));
      h.update(':');
      fingerprintInto(h, v, seen, emittableCache);
    }
    h.update('}');
  }
  seen.delete(value);
}

export function fingerprint(input: unknown): string {
  const emittableCache = new WeakMap<object, boolean>();
  if (!isEmittable(input, emittableCache)) {
    return '';
  }
  const h = createHash('sha512');
  fingerprintInto(h, input, new WeakSet(), emittableCache);
  return h.digest('hex');
}

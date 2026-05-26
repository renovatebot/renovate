import { type Hash, createHash } from 'node:crypto';

// Returns true when `value` would appear in the canonical JSON produced by
// `safe-stable-stringify`. We pre-check before emitting because objects must
// drop keys whose value resolves to nothing (incl. via toJSON → undefined),
// and incremental hashing can't roll back already-emitted bytes.
function isEmittable(value: unknown): boolean {
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
  const obj = value as { toJSON?: () => unknown };
  if (typeof obj.toJSON === 'function') {
    return isEmittable(obj.toJSON());
  }
  return true;
}

// Walks `value` and emits canonical JSON chunks directly into `h`,
// matching `safe-stable-stringify` (deterministic mode) byte-for-byte
// without materializing the full string. Required to avoid V8's max
// string length when the input is large (e.g. a PR carrying upgrades
// across hundreds of manifest files).
function fingerprintInto(h: Hash, value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== 'object') {
    h.update(JSON.stringify(value)!);
    return;
  }

  const obj = value as { toJSON?: () => unknown };
  if (typeof obj.toJSON === 'function') {
    fingerprintInto(h, obj.toJSON(), seen);
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
      if (isEmittable(item)) {
        fingerprintInto(h, item, seen);
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
      if (!isEmittable(v)) {
        continue;
      }
      if (!first) {
        h.update(',');
      }
      first = false;
      h.update(JSON.stringify(k));
      h.update(':');
      fingerprintInto(h, v, seen);
    }
    h.update('}');
  }
  seen.delete(value);
}

export function fingerprint(input: unknown): string {
  if (!isEmittable(input)) {
    return '';
  }
  const h = createHash('sha512');
  fingerprintInto(h, input, new WeakSet());
  return h.digest('hex');
}

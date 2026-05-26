import { createHash, type Hash } from 'node:crypto';

// Walks `value` and emits deterministic JSON chunks directly into `h`,
// matching `safe-stable-stringify` (deterministic mode) byte-for-byte
// without materializing the full string. Required to avoid V8's max
// string length when the input is large (e.g. a PR carrying upgrades
// across hundreds of manifest files).
function fingerprintInto(h: Hash, value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== 'object') {
    const s = JSON.stringify(value);
    h.update(s ?? 'null');
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
      if (
        item === undefined ||
        typeof item === 'function' ||
        typeof item === 'symbol'
      ) {
        h.update('null');
      } else {
        fingerprintInto(h, item, seen);
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
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') {
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
  // Preserve the prior `safeStringify(input) ? ... : ''` short-circuit:
  // root undefined/function/symbol returns an empty fingerprint.
  if (
    input === undefined ||
    typeof input === 'function' ||
    typeof input === 'symbol'
  ) {
    return '';
  }
  const h = createHash('sha512');
  fingerprintInto(h, input, new WeakSet());
  return h.digest('hex');
}

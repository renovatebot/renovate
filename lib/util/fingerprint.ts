import { createHash, type Hash } from 'node:crypto';

// Canonicalize `value` into `h` as deterministic JSON chunks. Matches
// the output of `safeStringify` from `./stringify.ts` (i.e. `safe-stable-stringify`
// in deterministic mode) without ever materializing the full string in memory.
//
// This avoids `RangeError: Invalid string length` in monorepos where the
// fingerprint input grows large (e.g. one PR carrying upgrades and advisory
// notes across hundreds of manifest files exceeds V8's max string length).
function fingerprintInto(
  h: Hash,
  value: unknown,
  seen: WeakSet<object>,
): void {
  if (value === null || typeof value !== 'object') {
    // JSON.stringify handles primitive escapes, numbers, booleans, and
    // returns undefined for functions/symbols/undefined (caller already
    // filtered those out for object/array members).
    const s = JSON.stringify(value);
    h.update(s ?? 'null');
    return;
  }

  // Match JSON.stringify semantics: respect toJSON() on objects (Date etc.).
  const obj = value as { toJSON?: () => unknown };
  if (typeof obj.toJSON === 'function') {
    fingerprintInto(h, obj.toJSON(), seen);
    return;
  }

  if (seen.has(value as object)) {
    h.update('"[Circular]"');
    return;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    h.update('[');
    for (let i = 0; i < value.length; i++) {
      if (i > 0) {
        h.update(',');
      }
      const item = value[i] as unknown;
      // safe-stable-stringify: undefined/function/symbol in arrays → null
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
      // safe-stable-stringify: undefined/function/symbol values in objects are dropped
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
  seen.delete(value as object);
}

export function fingerprint(input: unknown): string {
  // Match prior behavior: inputs that would stringify to `undefined`
  // (i.e. root undefined/function/symbol) return an empty fingerprint.
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

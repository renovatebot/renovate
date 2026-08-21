import { fingerprint } from './fingerprint.ts';
import { hash } from './hash.ts';
import { safeStringify } from './stringify.ts';

// Compute the fingerprint via the prior `safeStringify` + `hash` approach so
// the new incremental implementation can be asserted byte-identical for
// inputs that fit in a single V8 string (existing stored fingerprints stay
// valid across the upgrade).
function legacyFingerprint(input: unknown): string {
  const s = safeStringify(input);
  return s ? hash(s) : '';
}

describe('util/fingerprint', () => {
  const obj: any = {
    name: 'object',
    type: 'object',
    isObject: true,
  };

  const obj2: any = {
    type: 'object',
    name: 'object',
    isObject: true,
  };

  it('returns empty string', () => {
    const res = fingerprint(undefined);
    expect(res).toBeEmptyString();
  });

  it('maintains deterministic order', () => {
    const res = fingerprint(obj);
    const res2 = fingerprint(obj2);
    expect(res).not.toEqual(JSON.stringify(obj)); // shows that the canonical form differs from the original order
    expect(res).toEqual(res2);
  });

  it.each([
    null,
    true,
    false,
    0,
    42,
    -1.5,
    '',
    'string with "quotes" and \\backslashes\n',
    [],
    [1, 2, 3, 'a', null, true],
    {},
    { a: 1, b: [1, 2, { c: 'x' }] },
    { z: 1, a: 2, m: { y: 1, b: 2 } },
    new Date(0),
  ])('matches legacy safeStringify+hash output for %p', (input) => {
    expect(fingerprint(input)).toEqual(legacyFingerprint(input));
  });

  it('returns empty string for root function/symbol', () => {
    expect(fingerprint(() => 1)).toBeEmptyString();
    expect(fingerprint(Symbol('s'))).toBeEmptyString();
  });

  it('drops undefined/function/symbol object values like JSON.stringify', () => {
    const sym = Symbol('s');
    const input = {
      keep: 1,
      dropU: undefined,
      dropF: () => 1,
      dropS: sym,
    };
    expect(fingerprint(input)).toEqual(legacyFingerprint(input));
  });

  it('replaces undefined/function/symbol with null in arrays', () => {
    const input = [1, undefined, () => 1, Symbol('s'), 'x'];
    expect(fingerprint(input)).toEqual(legacyFingerprint(input));
  });

  it('drops object keys whose toJSON resolves to undefined', () => {
    const input = { x: { toJSON: () => undefined }, y: 1 };
    expect(fingerprint(input)).toEqual(legacyFingerprint(input));
  });

  it('renders array items whose toJSON resolves to undefined as null', () => {
    const input = [{ toJSON: () => undefined }, 1];
    expect(fingerprint(input)).toEqual(legacyFingerprint(input));
  });

  it('handles circular references', () => {
    const a: any = { name: 'a' };
    a.self = a;
    const res1 = fingerprint(a);
    const res2 = fingerprint(a);
    expect(res1).toEqual(res2);
    expect(res1).toEqual(legacyFingerprint(a));
  });

  it('handles many entries without stack overflow', () => {
    const wide = Array.from({ length: 10_000 }, (_, i) => ({
      id: i,
      body: 'x'.repeat(100),
    }));
    expect(fingerprint(wide)).toEqual(legacyFingerprint(wide));
  });
});

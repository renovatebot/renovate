import { fingerprint } from './fingerprint';

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
    expect(res).not.toEqual(JSON.stringify(obj)); // shows that safeStringify changes the original order
    expect(res).toEqual(res2);
  });
});

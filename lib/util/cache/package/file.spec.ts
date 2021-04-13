import os from 'os';
import { getName } from '../../../../test/util';
import { get, init, set } from './file';

describe(getName(__filename), () => {
  it('returns if uninitiated', async () => {
    await set('test', 'key', 1234);
    expect(await get('test', 'key')).toBeUndefined();
  });
  it('gets null', async () => {
    init(os.tmpdir());
    expect(await get('test', 'missing-key')).toBeUndefined();
  });

  it('sets and gets', async () => {
    init(os.tmpdir());
    await set('test', 'key', 1234);
    expect(await get('test', 'key')).toBe(1234);
  });

  it('expires', async () => {
    init(os.tmpdir());
    await set('test', 'key', 1234, -5);
    expect(await get('test', 'key')).toBeUndefined();
  });
});

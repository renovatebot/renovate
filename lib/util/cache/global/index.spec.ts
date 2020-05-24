import { getName } from '../../../../test/util';
import { get, set } from '.';

jest.mock('./file');

describe(getName(__filename), () => {
  it('returns undefined if not initialized', async () => {
    expect(await get('test', 'missing-key')).toBeUndefined();
    expect(await set('test', 'some-key', 'some-value', 5)).toBeUndefined();
  });
});

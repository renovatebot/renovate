import { getName } from '../../../test/util';
import { getQueue } from './queue';

describe(getName(), () => {
  it('returns null for invalid URL', () => {
    expect(getQueue(null)).toBeNull();
  });
});

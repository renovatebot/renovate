import { getName } from '../../../test/util';
import { getQueue } from './queue';

describe(getName(__filename), () => {
  it('returns null for invalid URL', () => {
    expect(getQueue(null)).toBeNull();
  });
});

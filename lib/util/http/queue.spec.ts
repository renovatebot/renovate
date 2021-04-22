import { testName } from '../../../test/util';
import { getQueue } from './queue';

describe(testName(), () => {
  it('returns null for invalid URL', () => {
    expect(getQueue(null)).toBeNull();
  });
});

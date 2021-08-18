import { getQueue } from './queue';

describe('util/http/queue', () => {
  it('returns null for invalid URL', () => {
    expect(getQueue(null)).toBeNull();
  });
});

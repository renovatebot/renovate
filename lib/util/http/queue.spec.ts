import * as hostRules from '../host-rules';
import { clear, getQueue } from './queue';

describe('util/http/queue', () => {
  beforeEach(() => {
    clear();
    hostRules.clear();
    hostRules.add({
      matchHost: 'https://example.com',
      concurrentRequestLimit: 143,
    });
  });

  it('returns null for invalid URL', () => {
    expect(getQueue('$#@!')).toBeNull();
  });

  it('returns queue for valid url', () => {
    const q1a = getQueue('https://example.com');
    const q1b = getQueue('https://example.com');

    const q2a = getQueue('https://example.com:8080');
    const q2b = getQueue('https://example.com:8080');

    expect(q1a).not.toBeNull();
    expect(q1a).toBe(q1b);

    expect(q2a).not.toBeNull();
    expect(q2a).toBe(q2b);

    expect(q1a).not.toBe(q2a);
    expect(q1a).not.toBe(q2b);
    expect(q1b).not.toBe(q2a);
    expect(q1b).not.toBe(q2b);
  });
});

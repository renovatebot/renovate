import * as hostRules from '../host-rules';
import { clear, getThrottle } from './throttle';

describe('util/http/throttle', () => {
  beforeEach(() => {
    clear();
    hostRules.clear();
    hostRules.add({
      matchHost: 'https://example.com',
      maxRequestsPerSecond: 143,
    });
  });

  it('returns null for invalid URL', () => {
    expect(getThrottle('$#@!')).toBeNull();
  });

  it('returns throttle for valid url', () => {
    const t1a = getThrottle('https://example.com');
    const t1b = getThrottle('https://example.com');

    const t2a = getThrottle('https://example.com:8080');
    const t2b = getThrottle('https://example.com:8080');

    expect(t1a).not.toBeNull();
    expect(t1a).toBe(t1b);

    expect(t2a).not.toBeNull();
    expect(t2a).toBe(t2b);

    expect(t1a).not.toBe(t2a);
    expect(t1a).not.toBe(t2b);
    expect(t1b).not.toBe(t2a);
    expect(t1b).not.toBe(t2b);
  });
});

import * as globalLimits from './limits';
import { isLimitReached } from './limits';

describe('lib/workers/global/limits', () => {
  beforeEach(() => {
    globalLimits.reset();
  });

  it('incrementLimit', () => {
    const config = { prCommitsPerRunLimit: 3 };
    globalLimits.init(config);

    expect(isLimitReached('prCommitsPerRunLimit')).toBe(false);

    globalLimits.incrementLimit('prCommitsPerRunLimit');
    expect(isLimitReached('prCommitsPerRunLimit')).toBe(false);

    globalLimits.incrementLimit('prCommitsPerRunLimit');
    expect(isLimitReached('prCommitsPerRunLimit')).toBe(false);

    globalLimits.incrementLimit('prCommitsPerRunLimit');
    expect(isLimitReached('prCommitsPerRunLimit')).toBe(true);

    globalLimits.incrementLimit('prCommitsPerRunLimit');
    expect(isLimitReached('prCommitsPerRunLimit')).toBe(true);
  });

  it('defaults to unlimited', () => {
    expect(isLimitReached('foobar')).toBe(false);
  });
});

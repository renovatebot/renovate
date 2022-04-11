import { trimTrailingApiPath } from './utils';

describe('modules/platform/gitea/utils', () => {
  it('trimTrailingApiPath', () => {
    expect(trimTrailingApiPath('https://gitea.renovatebot.com/api/v1')).toBe(
      'https://gitea.renovatebot.com/'
    );
    expect(trimTrailingApiPath('https://gitea.renovatebot.com/api/v1/')).toBe(
      'https://gitea.renovatebot.com/'
    );
    expect(trimTrailingApiPath('https://gitea.renovatebot.com/')).toBe(
      'https://gitea.renovatebot.com/'
    );
    expect(trimTrailingApiPath('https://gitea.renovatebot.com')).toBe(
      'https://gitea.renovatebot.com'
    );
    expect(
      trimTrailingApiPath('https://gitea.renovatebot.com/api/gitea/api/v1')
    ).toBe('https://gitea.renovatebot.com/api/gitea/');
  });
});

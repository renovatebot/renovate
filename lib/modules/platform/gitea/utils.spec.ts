import { partial } from '../../../../test/util';
import { CONFIG_GIT_URL_UNAVAILABLE } from '../../../constants/error-messages';
import type { Repo } from './gitea-helper';
import { getRepoUrl, trimTrailingApiPath } from './utils';

describe('modules/platform/gitea/utils', () => {
  const mockRepo = partial<Repo>({
    allow_rebase: true,
    clone_url: 'https://gitea.renovatebot.com/some/repo.git',
    ssh_url: 'git@gitea.renovatebot.com/some/repo.git',
    default_branch: 'master',
    full_name: 'some/repo',
    permissions: {
      pull: true,
      push: true,
      admin: false,
    },
  });

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

  describe('getRepoUrl', () => {
    it('should abort when endpoint is not valid', () => {
      expect.assertions(1);
      expect(() => getRepoUrl(mockRepo, 'endpoint', 'abc')).toThrow(
        CONFIG_GIT_URL_UNAVAILABLE
      );
    });
  });
});

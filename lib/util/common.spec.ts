import { detectPlatform } from './common';
import * as hostRules from './host-rules';

describe('util/common', () => {
  beforeEach(() => hostRules.clear());

  describe('detectPlatform', () => {
    it.each`
      url                                                                    | hostType
      ${'some-invalid@url:::'}                                               | ${null}
      ${'https://enterprise.example.com/chalk/chalk'}                        | ${null}
      ${'https://dev.azure.com/my-organization/my-project/_git/my-repo.git'} | ${'azure'}
      ${'https://myorg.visualstudio.com/my-project/_git/my-repo.git'}        | ${'azure'}
      ${'https://bitbucket.org/some-org/some-repo'}                          | ${'bitbucket'}
      ${'https://bitbucket.com/some-org/some-repo'}                          | ${'bitbucket'}
      ${'https://github.com/semantic-release/gitlab'}                        | ${'github'}
      ${'https://github-enterprise.example.com/chalk/chalk'}                 | ${'github'}
      ${'https://gitlab.com/chalk/chalk'}                                    | ${'gitlab'}
      ${'https://gitlab-enterprise.example.com/chalk/chalk'}                 | ${'gitlab'}
    `('("$url") === $hostType', ({ url, hostType }) => {
      expect(detectPlatform(url)).toBe(hostType);
    });

    it('uses host rules', () => {
      hostRules.add({
        hostType: 'bitbucket',
        matchHost: 'bb.example.com',
      });
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'gt.example.com',
      });
      hostRules.add({
        hostType: 'github-changelog',
        matchHost: 'gh.example.com',
      });
      hostRules.add({
        hostType: 'gitlab-changelog',
        matchHost: 'gl.example.com',
      });

      expect(detectPlatform('https://bb.example.com/chalk/chalk')).toBe(
        'bitbucket'
      );
      expect(detectPlatform('https://gh.example.com/chalk/chalk')).toBe(
        'github'
      );
      expect(detectPlatform('https://gl.example.com/chalk/chalk')).toBe(
        'gitlab'
      );
      expect(detectPlatform('https://gt.example.com/chalk/chalk')).toBeNull();
    });
  });
});

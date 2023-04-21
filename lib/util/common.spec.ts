import { detectPlatform } from './common';
import * as hostRules from './host-rules';

describe('util/common', () => {
  beforeEach(() => hostRules.clear());

  describe('detectPlatform', () => {
    it.each`
      url                                                    | hostType
      ${'some-invalid@url:::'}                               | ${null}
      ${'https://enterprise.example.com/chalk/chalk'}        | ${null}
      ${'https://github.com/semantic-release/gitlab'}        | ${'github'}
      ${'https://github-enterprise.example.com/chalk/chalk'} | ${'github'}
      ${'https://gitlab.com/chalk/chalk'}                    | ${'gitlab'}
      ${'https://gitlab-enterprise.example.com/chalk/chalk'} | ${'gitlab'}
    `('("$url") === $hostType', ({ url, hostType }) => {
      expect(detectPlatform(url)).toBe(hostType);
    });

    it('uses host rules', () => {
      hostRules.add({
        hostType: 'gitlab-changelog',
        matchHost: 'gl.example.com',
      });
      hostRules.add({
        hostType: 'github-changelog',
        matchHost: 'gh.example.com',
      });
      hostRules.add({
        hostType: 'gitea',
        matchHost: 'gt.example.com',
      });
      expect(detectPlatform('https://gl.example.com/chalk/chalk')).toBe(
        'gitlab'
      );
      expect(detectPlatform('https://gh.example.com/chalk/chalk')).toBe(
        'github'
      );
      expect(detectPlatform('https://gt.example.com/chalk/chalk')).toBeNull();
    });
  });
});

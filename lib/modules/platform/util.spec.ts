import * as hostRules from '../../util/host-rules';
import { detectPlatform } from './util';

describe('modules/platform/util', () => {
  beforeEach(() => hostRules.clear());

  describe('getHostType', () => {
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
        matchHost: 'https://gl.example.com',
      });
      hostRules.add({
        hostType: 'github-changelog',
        matchHost: 'https://gh.example.com',
      });
      expect(detectPlatform('https://gl.example.com/chalk/chalk')).toBe(
        'gitlab'
      );
      expect(detectPlatform('https://gh.example.com/chalk/chalk')).toBe(
        'github'
      );
    });
  });
});

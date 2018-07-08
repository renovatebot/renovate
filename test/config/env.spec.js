const env = require('../../lib/config/env.js');

describe('config/env', () => {
  describe('.getConfig(env)', () => {
    it('returns empty env', () => {
      expect(env.getConfig({})).toEqual({ endpoints: [] });
    });
    it('supports boolean true', () => {
      const envParam = { RENOVATE_RECREATE_CLOSED: 'true' };
      expect(env.getConfig(envParam).recreateClosed).toBe(true);
    });
    it('supports boolean false', () => {
      const envParam = { RENOVATE_RECREATE_CLOSED: 'false' };
      expect(env.getConfig(envParam).recreateClosed).toBe(false);
    });
    it('supports boolean nonsense as false', () => {
      const envParam = { RENOVATE_RECREATE_CLOSED: 'foo' };
      expect(env.getConfig(envParam).recreateClosed).toBe(false);
    });
    delete process.env.RENOVATE_RECREATE_CLOSED;
    it('supports list single', () => {
      const envParam = { RENOVATE_LABELS: 'a' };
      expect(env.getConfig(envParam).labels).toEqual(['a']);
    });
    it('supports list multiple', () => {
      const envParam = { RENOVATE_LABELS: 'a,b,c' };
      expect(env.getConfig(envParam).labels).toEqual(['a', 'b', 'c']);
    });
    it('supports string', () => {
      const envParam = { RENOVATE_TOKEN: 'a' };
      expect(env.getConfig(envParam).token).toBe('a');
    });
    it('supports json', () => {
      const envParam = { RENOVATE_LOCK_FILE_MAINTENANCE: '{}' };
      expect(env.getConfig(envParam).lockFileMaintenance).toEqual({});
    });
    it('supports GitHub token', () => {
      const envParam = { GITHUB_TOKEN: 'token' };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitHub custom endpoint', () => {
      const envParam = { GITHUB_ENDPOINT: 'endpoint' };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });

    it('supports GitHub custom endpoint and github.com', () => {
      const envParam = {
        GITHUB_COM_TOKEN: 'public',
        GITHUB_ENDPOINT: 'endpoint',
        GITHUB_TOKEN: 'token',
      };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitLab token', () => {
      const envParam = { GITLAB_TOKEN: 'token' };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports GitLab custom endpoint', () => {
      const envParam = { GITLAB_TOKEN: 'token', GITLAB_ENDPOINT: 'endpoint' };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
    it('supports VSTS', () => {
      const envParam = { VSTS_TOKEN: 'token', VSTS_ENDPOINT: 'endpoint' };
      expect(env.getConfig(envParam)).toMatchSnapshot();
    });
  });
  describe('.getEnvName(definition)', () => {
    it('returns empty', () => {
      const option = {
        name: 'foo',
        env: false,
      };
      env.getEnvName(option).should.eql('');
    });
    it('returns existing env', () => {
      const option = {
        name: 'foo',
        env: 'FOO',
      };
      env.getEnvName(option).should.eql('FOO');
    });
    it('generates RENOVATE_ env', () => {
      const option = {
        name: 'oneTwoThree',
      };
      env.getEnvName(option).should.eql('RENOVATE_ONE_TWO_THREE');
    });
  });
});

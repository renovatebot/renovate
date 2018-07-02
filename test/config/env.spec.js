const env = require('../../lib/config/env.js');

describe('config/env', () => {
  describe('.getConfig(env)', () => {
    it('returns empty env', () => {
      env.getConfig({}).should.eql({});
    });
    it('supports boolean true', () => {
      const envParam = { RENOVATE_RECREATE_CLOSED: 'true' };
      env.getConfig(envParam).should.eql({ recreateClosed: true });
    });
    it('supports boolean false', () => {
      const envParam = { RENOVATE_RECREATE_CLOSED: 'false' };
      env.getConfig(envParam).should.eql({ recreateClosed: false });
    });
    it('supports boolean nonsense as false', () => {
      const envParam = { RENOVATE_RECREATE_CLOSED: 'foo' };
      env.getConfig(envParam).should.eql({ recreateClosed: false });
    });
    delete process.env.RENOVATE_RECREATE_CLOSED;
    it('supports list single', () => {
      const envParam = { RENOVATE_LABELS: 'a' };
      env.getConfig(envParam).should.eql({ labels: ['a'] });
    });
    it('supports list multiple', () => {
      const envParam = { RENOVATE_LABELS: 'a,b,c' };
      env.getConfig(envParam).should.eql({ labels: ['a', 'b', 'c'] });
    });
    it('supports string', () => {
      const envParam = { RENOVATE_TOKEN: 'a' };
      env.getConfig(envParam).should.eql({ token: 'a' });
    });
    it('supports json', () => {
      const envParam = { RENOVATE_LOCK_FILE_MAINTENANCE: '{}' };
      expect(env.getConfig(envParam)).toEqual({ lockFileMaintenance: {} });
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

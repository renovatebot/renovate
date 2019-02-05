const { update, find, clear } = require('../../lib/util/host-rules');

describe('util/host-rules', () => {
  beforeEach(() => {
    clear();
  });
  describe('update()', () => {
    it('throws if no platform ', () => {
      expect(() => update({})).toThrow(
        'Failed to set configuration: no platform or endpoint specified'
      );
    });
    it('throws if no endpoint ', () => {
      expect(() => update({ platform: 'azure' })).toThrow(
        `Failed to configure platform 'azure': no endpoint defined`
      );
    });

    it('throws if invalid endpoint ', () => {
      expect(() =>
        update({ platform: 'azure', endpoint: '/some/path' })
      ).toThrow(
        `Failed to configure platform 'azure': no host for endpoint '/some/path'`
      );
    });
    it('supports endpoint-only', () => {
      update({
        endpoint: 'https://some.endpoint',
        username: 'user1',
        password: 'pass1',
      });
      expect(find({ host: 'some.endpoint' })).toMatchSnapshot();
    });
    it('uses default endpoint', () => {
      update({
        platform: 'github',
        token: 'token',
        other: 'data',
      });
      expect(find({ platform: 'github' })).toMatchSnapshot();
      expect(
        find({ platform: 'github', host: 'api.github.com' })
      ).toMatchSnapshot();
      expect(find({ platform: 'github', host: 'example.com' })).toBe(null);
    });
  });
  describe('find()', () => {
    it('allows overrides', () => {
      update({
        platform: 'github',
        endpoint: 'endpoint',
        token: 'token',
        other: 'data',
      });
      const overrides = {
        token: 'secret',
        other: null,
        foo: undefined,
      };
      expect(find({ platform: 'github' }, overrides)).toMatchSnapshot();
      expect(
        find({ platform: 'github', host: 'api.github.com' }, overrides)
      ).toMatchSnapshot();
      expect(
        find({ platform: 'github', host: 'example.com' }, overrides)
      ).toMatchSnapshot();
    });
  });
});

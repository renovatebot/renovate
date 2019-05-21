const { update, find, clear } = require('../../lib/util/host-rules');

describe('util/host-rules', () => {
  beforeEach(() => {
    clear();
  });
  describe('update()', () => {
    it('throws if no hostType ', () => {
      expect(() => update({})).toThrow(
        'Failed to set configuration: no hostType or endpoint specified'
      );
    });
    it('throws if no endpoint ', () => {
      expect(() => update({ hostType: 'azure' })).toThrow(
        `Failed to configure hostType 'azure': no endpoint defined`
      );
    });

    it('throws if invalid endpoint ', () => {
      expect(() =>
        update({ hostType: 'azure', endpoint: '/some/path' })
      ).toThrow(
        `Failed to configure hostType 'azure': no host for endpoint '/some/path'`
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
  });
  describe('find()', () => {
    it('needs exact host matches', () => {
      update({
        hostType: 'nuget',
        endpoint: 'endpoint',
        host: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
      });
      expect(find({ hostType: 'nuget' })).toMatchSnapshot();
      expect(find({ hostType: 'nuget', host: 'nuget.org' })).toMatchSnapshot();
      expect(
        find({ hostType: 'nuget', host: 'not.nuget.org' })
      ).toMatchSnapshot();
      expect(
        find({ hostType: 'nuget', host: 'not-nuget.org' })
      ).toMatchSnapshot();
    });
    it('matches on endpoint', () => {
      update({
        hostType: 'nuget',
        endpoint: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({ hostType: 'nuget', endpoint: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on endpoint subresource', () => {
      update({
        hostType: 'nuget',
        endpoint: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({
          hostType: 'nuget',
          endpoint: 'https://nuget.local/api/sub-resource',
        })
      ).toMatchSnapshot();
    });
  });
});

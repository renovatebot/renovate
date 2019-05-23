const { add, find, clear, hosts } = require('../../lib/util/host-rules');

describe('util/host-rules', () => {
  beforeEach(() => {
    clear();
  });
  describe('add()', () => {
    it('throws if both domainName and hostName', () => {
      expect(() =>
        add({
          hostType: 'azure',
          domainName: 'github.com',
          hostName: 'api.github.com',
        })
      ).toThrow('hostRules cannot contain both a domainName and hostName');
    });
    it('throws if both domainName and baseUrl', () => {
      expect(() =>
        add({
          hostType: 'azure',
          domainName: 'github.com',
          baseUrl: 'https://api.github.com',
        })
      ).toThrow('hostRules cannot contain both a domainName and baseUrl');
    });
    it('throws if both hostName and baseUrl', () => {
      expect(() =>
        add({
          hostType: 'azure',
          hostName: 'api.github.com',
          baseUrl: 'https://api.github.com',
        })
      ).toThrow('hostRules cannot contain both a hostName and baseUrl');
    });
    it('supports baseUrl-only', () => {
      add({
        baseUrl: 'https://some.endpoint',
        username: 'user1',
        password: 'pass1',
      });
      expect(find({ url: 'https://some.endpoint/v3/' })).toMatchSnapshot();
    });
  });
  describe('find()', () => {
    it('warns and returns null for bad search', () => {
      expect(find({ abc: 'def' })).toBeNull();
    });
    it('needs exact host matches', () => {
      add({
        hostType: 'nuget',
        hostName: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: undefined,
      });
      expect(find({ hostType: 'nuget' })).toMatchSnapshot();
      expect(find({ hostType: 'nuget', url: 'https://nuget.org' })).not.toEqual(
        {}
      );
      expect(find({ hostType: 'nuget', url: 'https://not.nuget.org' })).toEqual(
        {}
      );
      expect(find({ hostType: 'nuget', url: 'https://not-nuget.org' })).toEqual(
        {}
      );
    });
    it('matches on empty rules', () => {
      add({
        json: true,
      });
      expect(
        find({ hostType: 'nuget', url: 'https://api.github.com' })
      ).toEqual({ json: true });
    });
    it('matches on hostType', () => {
      add({
        hostType: 'nuget',
        token: 'abc',
      });
      expect(
        find({ hostType: 'nuget', url: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on domainName', () => {
      add({
        domainName: 'github.com',
        token: 'def',
      });
      expect(
        find({ hostType: 'nuget', url: 'https://api.github.com' }).token
      ).toEqual('def');
    });
    it('matches on hostName', () => {
      add({
        hostName: 'nuget.local',
        token: 'abc',
      });
      expect(
        find({ hostType: 'nuget', url: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on hostType and endpoint', () => {
      add({
        hostType: 'nuget',
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({ hostType: 'nuget', url: 'https://nuget.local/api' }).token
      ).toEqual('abc');
    });
    it('matches on endpoint subresource', () => {
      add({
        hostType: 'nuget',
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({
          hostType: 'nuget',
          url: 'https://nuget.local/api/sub-resource',
        })
      ).toMatchSnapshot();
    });
    it('returns hosts', () => {
      add({
        hostType: 'nuget',
        token: 'aaaaaa',
      });
      add({
        hostType: 'nuget',
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      add({
        hostType: 'nuget',
        hostName: 'my.local.registry',
        token: 'def',
      });
      const res = hosts({
        hostType: 'nuget',
      });
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
  });
});

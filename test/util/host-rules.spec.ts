import { add, find, findAll, clear, hosts } from '../../lib/util/host-rules';
import { DATASOURCE_NUGET } from '../../lib/constants/data-binary-source';
import { PLATFORM_TYPE_AZURE } from '../../lib/constants/platforms';

describe('util/host-rules', () => {
  beforeEach(() => {
    clear();
  });
  describe('add()', () => {
    it('throws if both domainName and hostName', () => {
      expect(() =>
        add({
          hostType: PLATFORM_TYPE_AZURE,
          domainName: 'github.com',
          hostName: 'api.github.com',
        })
      ).toThrow('hostRules cannot contain both a domainName and hostName');
    });
    it('throws if both domainName and baseUrl', () => {
      expect(() =>
        add({
          hostType: PLATFORM_TYPE_AZURE,
          domainName: 'github.com',
          baseUrl: 'https://api.github.com',
        })
      ).toThrow('hostRules cannot contain both a domainName and baseUrl');
    });
    it('throws if both hostName and baseUrl', () => {
      expect(() =>
        add({
          hostType: PLATFORM_TYPE_AZURE,
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
    it('warns and returns empty for bad search', () => {
      expect(find({ abc: 'def' } as any)).toEqual({});
    });
    it('needs exact host matches', () => {
      add({
        hostType: DATASOURCE_NUGET,
        hostName: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: undefined,
      });
      expect(find({ hostType: DATASOURCE_NUGET })).toMatchSnapshot();
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://nuget.org' })
      ).not.toEqual({});
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://not.nuget.org' })
      ).toEqual({});
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://not-nuget.org' })
      ).toEqual({});
    });
    it('matches on empty rules', () => {
      add({
        json: true,
      });
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://api.github.com' })
      ).toEqual({ json: true });
    });
    it('matches on hostType', () => {
      add({
        hostType: DATASOURCE_NUGET,
        token: 'abc',
      });
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on domainName', () => {
      add({
        domainName: 'github.com',
        token: 'def',
      });
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://api.github.com' })
          .token
      ).toEqual('def');
    });
    it('matches on hostName', () => {
      add({
        hostName: 'nuget.local',
        token: 'abc',
      });
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on hostType and endpoint', () => {
      add({
        hostType: DATASOURCE_NUGET,
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({ hostType: DATASOURCE_NUGET, url: 'https://nuget.local/api' })
          .token
      ).toEqual('abc');
    });
    it('matches on endpoint subresource', () => {
      add({
        hostType: DATASOURCE_NUGET,
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({
          hostType: DATASOURCE_NUGET,
          url: 'https://nuget.local/api/sub-resource',
        })
      ).toMatchSnapshot();
    });
    it('returns hosts', () => {
      add({
        hostType: DATASOURCE_NUGET,
        token: 'aaaaaa',
      });
      add({
        hostType: DATASOURCE_NUGET,
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      add({
        hostType: DATASOURCE_NUGET,
        hostName: 'my.local.registry',
        token: 'def',
      });
      const res = hosts({
        hostType: DATASOURCE_NUGET,
      });
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
  });
  describe('findAll()', () => {
    it('warns and returns empty for bad search', () => {
      expect(findAll({ abc: 'def' } as any)).toEqual([]);
    });
    it('needs exact host matches', () => {
      const hostRule = {
        hostType: 'nuget',
        hostName: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: undefined,
      };
      add(hostRule);
      expect(findAll({ hostType: 'nuget' })).toHaveLength(1);
      expect(findAll({ hostType: 'nuget' })[0]).toEqual(hostRule);
    });
  });
});

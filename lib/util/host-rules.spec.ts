import { getName } from '../../test/util';
import { PLATFORM_TYPE_AZURE } from '../constants/platforms';
import * as datasourceNuget from '../datasource/nuget';
import { add, clear, find, findAll, hosts } from './host-rules';

describe(getName(), () => {
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
        } as any)
      ).toThrow();
    });
    it('throws if both domainName and baseUrl', () => {
      expect(() =>
        add({
          hostType: PLATFORM_TYPE_AZURE,
          domainName: 'github.com',
          matchHost: 'https://api.github.com',
        } as any)
      ).toThrow();
    });
    it('throws if both hostName and baseUrl', () => {
      expect(() =>
        add({
          hostType: PLATFORM_TYPE_AZURE,
          hostName: 'api.github.com',
          matchHost: 'https://api.github.com',
        } as any)
      ).toThrow();
    });
    it('supports baseUrl-only', () => {
      add({
        matchHost: 'https://some.endpoint',
        username: 'user1',
        password: 'pass1',
      } as any);
      expect(find({ url: 'https://some.endpoint/v3/' })).toMatchSnapshot();
    });
  });
  describe('find()', () => {
    beforeEach(() => {
      clear();
    });
    it('warns and returns empty for bad search', () => {
      expect(find({ abc: 'def' } as any)).toEqual({});
    });
    it('needs exact host matches', () => {
      add({
        hostType: datasourceNuget.id,
        hostName: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: undefined,
      } as any);
      expect(find({ hostType: datasourceNuget.id })).toMatchSnapshot();
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://nuget.org' })
      ).not.toEqual({});
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://not.nuget.org' })
      ).not.toEqual({});
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://not-nuget.org' })
      ).toEqual({});
    });
    it('matches on empty rules', () => {
      add({
        enabled: true,
      });
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://api.github.com' })
      ).toEqual({ enabled: true });
    });
    it('matches on hostType', () => {
      add({
        hostType: datasourceNuget.id,
        token: 'abc',
      });
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on domainName', () => {
      add({
        domainName: 'github.com',
        token: 'def',
      } as any);
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://api.github.com' })
          .token
      ).toEqual('def');
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://github.com' }).token
      ).toEqual('def');
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://apigithub.com' })
          .token
      ).toBeUndefined();
    });
    it('matches on hostName', () => {
      add({
        hostName: 'nuget.local',
        token: 'abc',
      } as any);
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on matchHost with protocol', () => {
      add({
        matchHost: 'https://domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toBeUndefined();
      expect(find({ url: 'https://domain.com' }).token).toEqual('def');
      expect(
        find({
          hostType: datasourceNuget.id,
          url: 'https://domain.com/renovatebot',
        }).token
      ).toEqual('def');
    });
    it('matches on matchHost without protocol', () => {
      add({
        matchHost: 'domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toEqual('def');
      expect(find({ url: 'https://domain.com' }).token).toEqual('def');
      expect(find({ url: 'httpsdomain.com' }).token).toBeUndefined();
    });
    it('matches on hostType and endpoint', () => {
      add({
        hostType: datasourceNuget.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      } as any);
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://nuget.local/api' })
          .token
      ).toEqual('abc');
    });
    it('matches on endpoint subresource', () => {
      add({
        hostType: datasourceNuget.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      } as any);
      expect(
        find({
          hostType: datasourceNuget.id,
          url: 'https://nuget.local/api/sub-resource',
        })
      ).toMatchSnapshot();
    });
    it('returns hosts', () => {
      add({
        hostType: datasourceNuget.id,
        token: 'aaaaaa',
      });
      add({
        hostType: datasourceNuget.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      } as any);
      add({
        hostType: datasourceNuget.id,
        hostName: 'my.local.registry',
        token: 'def',
      } as any);
      add({
        hostType: datasourceNuget.id,
        matchHost: 'another.local.registry',
        token: 'xyz',
      });
      add({
        hostType: datasourceNuget.id,
        matchHost: 'https://yet.another.local.registry',
        token: '123',
      });
      const res = hosts({
        hostType: datasourceNuget.id,
      });
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
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
      };
      add(hostRule);
      expect(findAll({ hostType: 'nuget' })).toHaveLength(1);
      expect(findAll({ hostType: 'nuget' })[0]).toMatchSnapshot();
    });
  });
});

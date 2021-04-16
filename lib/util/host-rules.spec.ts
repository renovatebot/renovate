import { getName } from '../../test/util';
import { PLATFORM_TYPE_AZURE } from '../constants/platforms';
import * as datasourceNuget from '../datasource/nuget';
import { add, clear, find, findAll, hosts } from './host-rules';

describe(getName(__filename), () => {
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
        hostType: datasourceNuget.id,
        hostName: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: undefined,
      });
      expect(find({ hostType: datasourceNuget.id })).toMatchSnapshot();
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://nuget.org' })
      ).not.toEqual({});
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://not.nuget.org' })
      ).toEqual({});
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://not-nuget.org' })
      ).toEqual({});
    });
    it('matches on empty rules', () => {
      add({
        json: true,
      });
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://api.github.com' })
      ).toEqual({ json: true });
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
      });
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://api.github.com' })
          .token
      ).toEqual('def');
    });
    it('matches on hostName', () => {
      add({
        hostName: 'nuget.local',
        token: 'abc',
      });
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://nuget.local/api' })
      ).toMatchSnapshot();
    });
    it('matches on hostType and endpoint', () => {
      add({
        hostType: datasourceNuget.id,
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({ hostType: datasourceNuget.id, url: 'https://nuget.local/api' })
          .token
      ).toEqual('abc');
    });
    it('matches on endpoint subresource', () => {
      add({
        hostType: datasourceNuget.id,
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
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
        baseUrl: 'https://nuget.local/api',
        token: 'abc',
      });
      add({
        hostType: datasourceNuget.id,
        hostName: 'my.local.registry',
        token: 'def',
      });
      const res = hosts({
        hostType: datasourceNuget.id,
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

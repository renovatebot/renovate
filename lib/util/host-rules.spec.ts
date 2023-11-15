import { NugetDatasource } from '../modules/datasource/nuget';
import {
  add,
  clear,
  find,
  findAll,
  getAll,
  hostType,
  hosts,
} from './host-rules';

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
        } as never),
      ).toThrow();
    });

    it('throws if both domainName and baseUrl', () => {
      expect(() =>
        add({
          hostType: 'azure',
          domainName: 'github.com',
          matchHost: 'https://api.github.com',
        } as never),
      ).toThrow();
    });

    it('throws if both hostName and baseUrl', () => {
      expect(() =>
        add({
          hostType: 'azure',
          hostName: 'api.github.com',
          matchHost: 'https://api.github.com',
        } as never),
      ).toThrow();
    });

    it('supports baseUrl-only', () => {
      add({
        matchHost: 'https://some.endpoint',
        username: 'user1',
        password: 'pass1',
      });
      expect(find({ url: 'https://some.endpoint/v3/' })).toEqual({
        password: 'pass1',
        username: 'user1',
      });
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
        hostType: NugetDatasource.id,
        hostName: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
        token: undefined,
      } as never);
      expect(find({ hostType: NugetDatasource.id })).toEqual({});
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.org' }),
      ).not.toEqual({});
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://not.nuget.org' }),
      ).not.toEqual({});
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://not-nuget.org' }),
      ).toEqual({});
    });

    it('matches on empty rules', () => {
      add({
        enabled: true,
      });
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://api.github.com' }),
      ).toEqual({ enabled: true });
    });

    it('matches on hostType', () => {
      add({
        hostType: NugetDatasource.id,
        token: 'abc',
      });
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.local/api' }),
      ).toEqual({ token: 'abc' });
    });

    it('matches on domainName', () => {
      add({
        domainName: 'github.com',
        token: 'def',
      } as never);
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://api.github.com' })
          .token,
      ).toBe('def');
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://github.com' }).token,
      ).toBe('def');
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://apigithub.com' })
          .token,
      ).toBeUndefined();
    });

    it('matches on specific path', () => {
      // Initialized platform holst rule
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      // specific host rule for using other token in different org
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com/repos/org-b/',
        token: 'def',
      });
      // Initialized generic host rule for github platform
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      expect(
        find({
          hostType: 'github',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('def');
    });

    it('matches for several hostTypes when no hostType rule is configured', () => {
      add({
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      expect(
        find({
          hostType: 'github',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('abc');
      expect(
        find({
          hostType: 'github-releases',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('abc');
    });

    it('matches if hostType is configured and host rule is filtered with datasource', () => {
      add({
        hostType: 'github',
        matchHost: 'https://api.github.com',
        token: 'abc',
      });
      add({
        hostType: 'github-tags',
        matchHost: 'https://api.github.com/repos/org-b/',
        token: 'def',
      });
      expect(
        find({
          hostType: 'github-tags',
          url: 'https://api.github.com/repos/org-b/someRepo/tags?per_page=100',
        }).token,
      ).toBe('def');
    });

    it('matches on hostName', () => {
      add({
        hostName: 'nuget.local',
        token: 'abc',
      } as never);
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.local/api' }),
      ).toEqual({ token: 'abc' });
    });

    it('matches on matchHost with protocol', () => {
      add({
        matchHost: 'https://domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toBeUndefined();
      expect(find({ url: 'https://domain.com' }).token).toBe('def');
      expect(
        find({
          hostType: NugetDatasource.id,
          url: 'https://domain.com/renovatebot',
        }).token,
      ).toBe('def');
    });

    it('matches on matchHost without protocol', () => {
      add({
        matchHost: 'domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toBe('def');
      expect(find({ url: 'https://domain.com' }).token).toBe('def');
      expect(find({ url: 'httpsdomain.com' }).token).toBeUndefined();
    });

    it('matches on matchHost with dot prefix', () => {
      add({
        matchHost: '.domain.com',
        token: 'def',
      });
      expect(find({ url: 'https://api.domain.com' }).token).toBe('def');
      expect(find({ url: 'https://domain.com' }).token).toBeUndefined();
      expect(find({ url: 'httpsdomain.com' }).token).toBeUndefined();
    });

    it('matches on matchHost with port', () => {
      add({
        matchHost: 'https://domain.com:9118',
        token: 'def',
      });
      expect(find({ url: 'https://domain.com:9118' }).token).toBe('def');
      expect(find({ url: 'https://domain.com' }).token).toBeUndefined();
      expect(find({ url: 'httpsdomain.com' }).token).toBeUndefined();
    });

    it('host with port is interpreted as empty', () => {
      add({
        matchHost: 'domain.com:9118',
        token: 'def',
      });
      expect(find({ url: 'https://domain.com:9118' }).token).toBe('def');
      expect(find({ url: 'https://domain.com' }).token).toBe('def');
      expect(find({ url: 'httpsdomain.com' }).token).toBe('def');
    });

    it('matches on hostType and endpoint', () => {
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({ hostType: NugetDatasource.id, url: 'https://nuget.local/api' })
          .token,
      ).toBe('abc');
    });

    it('matches on endpoint subresource', () => {
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      });
      expect(
        find({
          hostType: NugetDatasource.id,
          url: 'https://nuget.local/api/sub-resource',
        }),
      ).toEqual({ token: 'abc' });
    });

    it('matches shortest matchHost first', () => {
      add({
        matchHost: 'https://nuget.local/api',
        token: 'longest',
      });
      add({
        matchHost: 'https://nuget.local/',
        token: 'shortest',
      });
      expect(
        find({
          url: 'https://nuget.local/api/sub-resource',
        }),
      ).toEqual({ token: 'longest' });
    });
  });

  describe('hosts()', () => {
    it('returns hosts', () => {
      add({
        hostType: NugetDatasource.id,
        token: 'aaaaaa',
      });
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://nuget.local/api',
        token: 'abc',
      });
      add({
        hostType: NugetDatasource.id,
        hostName: 'my.local.registry',
        token: 'def',
      } as never);
      add({
        hostType: NugetDatasource.id,
        matchHost: 'another.local.registry',
        token: 'xyz',
      });
      add({
        hostType: NugetDatasource.id,
        matchHost: 'https://yet.another.local.registry',
        token: '123',
      });
      const res = hosts({
        hostType: NugetDatasource.id,
      });
      expect(res).toEqual([
        'nuget.local',
        'my.local.registry',
        'another.local.registry',
        'yet.another.local.registry',
      ]);
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
      expect(findAll({ hostType: 'nuget' })).toEqual([
        {
          hostType: 'nuget',
          password: 'p4$$w0rd',
          resolvedHost: 'nuget.org',
          username: 'root',
          matchHost: 'nuget.org',
        },
      ]);
    });
  });

  describe('getAll()', () => {
    it('returns all host rules', () => {
      const hostRule1 = {
        hostType: 'nuget',
        matchHost: 'nuget.org',
        username: 'root',
        password: 'p4$$w0rd',
      };
      const hostRule2 = {
        hostType: 'github',
        matchHost: 'github.com',
        token: 'token',
      };
      add(hostRule1);
      add(hostRule2);
      expect(getAll()).toMatchObject([hostRule1, hostRule2]);
    });
  });

  describe('hostType()', () => {
    it('return hostType', () => {
      add({
        hostType: 'github',
        token: 'aaaaaa',
      });
      add({
        hostType: 'github',
        matchHost: 'github.example.com',
        token: 'abc',
      });
      add({
        hostType: 'github-changelog',
        matchHost: 'https://github.example.com/chalk/chalk',
        token: 'def',
      });
      expect(
        hostType({
          url: 'https://github.example.com/chalk/chalk',
        }),
      ).toBe('github-changelog');
    });

    it('returns null', () => {
      add({
        hostType: 'github',
        token: 'aaaaaa',
      });
      add({
        hostType: 'github',
        matchHost: 'github.example.com',
        token: 'abc',
      });
      add({
        hostType: 'github-changelog',
        matchHost: 'https://github.example.com/chalk/chalk',
        token: 'def',
      });
      expect(
        hostType({
          url: 'https://github.example.com/chalk/chalk',
        }),
      ).toBe('github-changelog');
      expect(
        hostType({
          url: 'https://gitlab.example.com/chalk/chalk',
        }),
      ).toBeNull();
    });
  });
});

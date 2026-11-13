import * as httpMock from '~test/http-mock.ts';
import { fs } from '~test/util.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import {
  CACHE_KEY,
  CACHE_NAMESPACE,
  expandForgeAlias,
  extractLockfileUrls,
  getLockfileRegistry,
  getNimbleRegistry,
  parseNimbleRegistry,
  resolvePackageUrl,
} from './registry.ts';

vi.mock('../../../util/cache/package/index.ts');
vi.mock('../../../util/fs/index.ts');

describe('modules/manager/nimble/registry', () => {
  const baseUrl = 'https://raw.githubusercontent.com';
  const path = '/nim-lang/packages/master/packages.json';

  describe('expandForgeAlias', () => {
    it('expands github / gh aliases', () => {
      expect(expandForgeAlias('github:nim-lang/cmark')).toBe(
        'https://github.com/nim-lang/cmark',
      );
      expect(expandForgeAlias('gh:nim-lang/cmark.git')).toBe(
        'https://github.com/nim-lang/cmark',
      );
    });

    it('expands gitlab / gl aliases', () => {
      expect(expandForgeAlias('gitlab:user/repo')).toBe(
        'https://gitlab.com/user/repo',
      );
      expect(expandForgeAlias('gl:user/repo')).toBe(
        'https://gitlab.com/user/repo',
      );
    });

    it('expands codeberg / cb / cberg and sourcehut / srht / shart aliases', () => {
      expect(expandForgeAlias('codeberg:user/repo')).toBe(
        'https://codeberg.org/user/repo',
      );
      expect(expandForgeAlias('cb:user/repo')).toBe(
        'https://codeberg.org/user/repo',
      );
      expect(expandForgeAlias('cberg:user/repo')).toBe(
        'https://codeberg.org/user/repo',
      );
      expect(expandForgeAlias('sourcehut:user/repo')).toBe(
        'https://git.sr.ht/~user/repo',
      );
      expect(expandForgeAlias('srht:~user/repo')).toBe(
        'https://git.sr.ht/~user/repo',
      );
      expect(expandForgeAlias('shart:user/repo')).toBe(
        'https://git.sr.ht/~user/repo',
      );
    });

    it('returns undefined for non-aliases or invalid formats', () => {
      expect(expandForgeAlias('https://github.com/foo/bar')).toBeUndefined();
      expect(expandForgeAlias('plain-name')).toBeUndefined();
      expect(expandForgeAlias('unknownforge:user/repo')).toBeUndefined();
      expect(expandForgeAlias('gh:')).toBeUndefined();
      expect(expandForgeAlias('gh:onlyuser')).toBeUndefined();
      expect(expandForgeAlias('gh:/repo')).toBeUndefined();
      expect(expandForgeAlias('gh:user/')).toBeUndefined();
    });
  });

  describe('extractLockfileUrls', () => {
    it('extracts URLs from nimble.lock v2 (packages and tasks) and atlas.lock (items)', () => {
      const nimbleLock = JSON.stringify({
        version: 2,
        packages: {
          typestates: {
            version: '0.14.0',
            vcsRevision: '086c236a77e759bf9186d32f3f375b8818833f11',
            url: 'https://github.com/elijahr/nim-typestates',
            downloadMethod: 'git',
            dependencies: [],
            checksums: { sha1: '1970b216cd995276d09951f23c31cdcb7bd2e7ae' },
          },
          invalidPkg: 'not-an-object',
          emptyUrlPkg: { url: '' },
        },
        tasks: {
          test: {
            unittest2: {
              version: '0.2.4',
              url: 'https://github.com/status-im/nim-unittest2',
            },
          },
          invalidTask: 'not-an-object',
        },
      });

      const res = extractLockfileUrls(nimbleLock);
      expect(res.get('typestates')).toBe(
        'https://github.com/elijahr/nim-typestates',
      );
      expect(res.get('unittest2')).toBe(
        'https://github.com/status-im/nim-unittest2',
      );

      const atlasLock = JSON.stringify({
        items: {
          jester: {
            dir: '$deps/jester',
            url: 'https://github.com/dom96/jester',
            commit: '2dfac077170c62cd6ffc73e3dcfa29c641dcf',
            version: '',
          },
        },
      });
      const atlasRes = extractLockfileUrls(atlasLock);
      expect(atlasRes.get('jester')).toBe('https://github.com/dom96/jester');
    });

    it('handles invalid JSON or non-object JSON gracefully', () => {
      expect(extractLockfileUrls('invalid-json').size).toBe(0);
      expect(extractLockfileUrls('null').size).toBe(0);
    });
  });

  describe('getLockfileRegistry', () => {
    it('returns empty map when packageFile is undefined', async () => {
      const res = await getLockfileRegistry(undefined);
      expect(res.size).toBe(0);
    });

    it('reads nimble.lock and atlas.lock from root or nested directories', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(
          JSON.stringify({
            version: 2,
            packages: {
              typestates: { url: 'https://github.com/elijahr/nim-typestates' },
            },
          }),
        )
        .mockResolvedValueOnce(
          JSON.stringify({
            items: {
              typestates: { url: 'https://github.com/other/typestates' },
              jester: { url: 'https://github.com/dom96/jester' },
            },
          }),
        );

      const res = await getLockfileRegistry('sub/pkg.nimble');
      expect(res.get('typestates')).toBe(
        'https://github.com/elijahr/nim-typestates',
      );
      expect(res.get('jester')).toBe('https://github.com/dom96/jester');
    });

    it('handles read errors gracefully', async () => {
      fs.readLocalFile.mockRejectedValue(new Error('disk error'));
      const res = await getLockfileRegistry('pkg.nimble');
      expect(res.size).toBe(0);
    });
  });

  describe('parseNimbleRegistry', () => {
    it('handles empty entries or entries missing names or url', () => {
      const res = parseNimbleRegistry([
        { name: '', url: 'https://github.com/foo/bar' },
        { name: 'nourl', url: '' },
        { name: 'chronos', url: 'https://github.com/status-im/nim-chronos' },
      ]);
      expect(res.size).toBe(1);
      expect(res.get('chronos')).toBe(
        'https://github.com/status-im/nim-chronos',
      );
    });

    it('resolves aliases and prevents circular redirect loops', () => {
      const res = parseNimbleRegistry([
        { name: 'canonical', url: 'https://github.com/foo/canonical' },
        { name: 'alias1', url: '', alias: 'canonical' },
        { name: 'alias2', url: '', alias: 'alias1' },
        // Loop of depth 2: cycleA -> cycleB -> cycleA
        { name: 'cycleA', url: '', alias: 'cycleB' },
        { name: 'cycleB', url: '', alias: 'cycleA' },
        // Chain exceeding max depth 3: deep1 -> deep2 -> deep3 -> deep4 -> canonical
        { name: 'deep1', url: '', alias: 'deep2' },
        { name: 'deep2', url: '', alias: 'deep3' },
        { name: 'deep3', url: '', alias: 'deep4' },
        { name: 'deep4', url: '', alias: 'canonical' },
      ]);

      expect(res.get('canonical')).toBe('https://github.com/foo/canonical');
      expect(res.get('alias1')).toBe('https://github.com/foo/canonical');
      expect(res.get('alias2')).toBe('https://github.com/foo/canonical');
      expect(res.has('cycleA')).toBeFalse();
    });
  });

  describe('getNimbleRegistry', () => {
    it('returns cached registry when available', async () => {
      vi.mocked(packageCache.get).mockResolvedValueOnce({
        chronos: 'https://github.com/status-im/nim-chronos',
      });

      const res = await getNimbleRegistry();
      expect(res.get('chronos')).toBe(
        'https://github.com/status-im/nim-chronos',
      );
      expect(packageCache.get).toHaveBeenCalledWith(CACHE_NAMESPACE, CACHE_KEY);
    });

    it('handles cache read error gracefully and fetches from network', async () => {
      vi.mocked(packageCache.get).mockRejectedValueOnce(
        new Error('cache read error'),
      );
      httpMock
        .scope(baseUrl)
        .get(path)
        .reply(200, [
          {
            name: 'chronos',
            url: 'https://github.com/status-im/nim-chronos',
          },
        ]);

      const res = await getNimbleRegistry();
      expect(res.get('chronos')).toBe(
        'https://github.com/status-im/nim-chronos',
      );
      expect(packageCache.set).toHaveBeenCalled();
    });

    it('handles cache set error gracefully', async () => {
      vi.mocked(packageCache.get).mockResolvedValueOnce(null);
      vi.mocked(packageCache.set).mockRejectedValueOnce(
        new Error('cache set error'),
      );
      httpMock
        .scope(baseUrl)
        .get(path)
        .reply(200, [
          {
            name: 'chronos',
            url: 'https://github.com/status-im/nim-chronos',
          },
        ]);

      const res = await getNimbleRegistry();
      expect(res.get('chronos')).toBe(
        'https://github.com/status-im/nim-chronos',
      );
    });

    it('handles network failure (HTTP 500) gracefully and returns empty map', async () => {
      vi.mocked(packageCache.get).mockResolvedValueOnce(null);
      httpMock.scope(baseUrl).get(path).reply(500);

      const res = await getNimbleRegistry();
      expect(res.size).toBe(0);
    });

    it('handles non-array response gracefully', async () => {
      vi.mocked(packageCache.get).mockResolvedValueOnce(null);
      httpMock.scope(baseUrl).get(path).reply(200, { notAnArray: true });

      const res = await getNimbleRegistry();
      expect(res.size).toBe(0);
    });
  });

  describe('resolvePackageUrl', () => {
    it('returns undefined for empty depName', async () => {
      await expect(resolvePackageUrl('')).resolves.toBeUndefined();
      await expect(resolvePackageUrl('   ')).resolves.toBeUndefined();
    });

    it('returns canonical URL for nim compiler and compiler aliases', async () => {
      await expect(resolvePackageUrl('nim')).resolves.toBe(
        'https://github.com/nim-lang/Nim',
      );
      await expect(resolvePackageUrl('Nim')).resolves.toBe(
        'https://github.com/nim-lang/Nim',
      );
      await expect(resolvePackageUrl('nimrod')).resolves.toBe(
        'https://github.com/nim-lang/Nim',
      );
      await expect(resolvePackageUrl('compiler')).resolves.toBe(
        'https://github.com/nim-lang/Nim',
      );
    });

    it('returns direct Git / HTTP URLs unchanged', async () => {
      await expect(
        resolvePackageUrl('https://github.com/status-im/nim-chronos'),
      ).resolves.toBe('https://github.com/status-im/nim-chronos');
      await expect(
        resolvePackageUrl('http://github.com/status-im/nim-chronos'),
      ).resolves.toBe('http://github.com/status-im/nim-chronos');
      await expect(
        resolvePackageUrl('git@github.com:status-im/nim-chronos.git'),
      ).resolves.toBe('git@github.com:status-im/nim-chronos.git');
    });

    it('expands forge aliases to full HTTPS URLs', async () => {
      await expect(resolvePackageUrl('github:nim-lang/cmark')).resolves.toBe(
        'https://github.com/nim-lang/cmark',
      );
      await expect(resolvePackageUrl('gh:nim-lang/cmark')).resolves.toBe(
        'https://github.com/nim-lang/cmark',
      );
      await expect(resolvePackageUrl('gitlab:user/repo')).resolves.toBe(
        'https://gitlab.com/user/repo',
      );
    });

    it('resolves from companion lockfile (Tier 1) before querying registry', async () => {
      fs.readLocalFile.mockResolvedValueOnce(
        JSON.stringify({
          version: 2,
          packages: {
            typestates: { url: 'https://github.com/elijahr/nim-typestates' },
          },
        }),
      );
      fs.readLocalFile.mockResolvedValueOnce(null);

      const res = await resolvePackageUrl(
        'typestates',
        'lockfreequeues.nimble',
      );
      expect(res).toBe('https://github.com/elijahr/nim-typestates');
    });

    it('resolves from upstream registry (Tier 2) when package is listed', async () => {
      fs.readLocalFile.mockResolvedValue(null);
      vi.mocked(packageCache.get).mockResolvedValueOnce({
        chronos: 'https://github.com/status-im/nim-chronos',
      });

      const res = await resolvePackageUrl('chronos', 'pkg.nimble');
      expect(res).toBe('https://github.com/status-im/nim-chronos');
    });

    it('returns undefined if not found anywhere', async () => {
      fs.readLocalFile.mockResolvedValue(null);
      vi.mocked(packageCache.get).mockResolvedValueOnce({});

      const res = await resolvePackageUrl('unknown-pkg');
      expect(res).toBeUndefined();
    });
  });
});

import * as httpMock from '~test/http-mock.ts';
import { fs } from '~test/util.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import {
  CACHE_KEY,
  CACHE_NAMESPACE,
  getNimbleRegistry,
  parseNimbleRegistry,
  resolvePackageUrl,
} from './registry.ts';

vi.mock('../../../util/fs/index.ts');
vi.mock('../../../util/cache/package/index.ts');

describe('modules/manager/nimble/registry', () => {
  const baseUrl = 'https://raw.githubusercontent.com';
  const path = '/nim-lang/packages/master/packages.json';

  beforeEach(() => {
    fs.getSiblingFileName.mockImplementation(
      (_file: string, sibling: string) => sibling,
    );
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

    it('returns canonical URL for nim compiler', async () => {
      await expect(resolvePackageUrl('nim')).resolves.toBe(
        'https://github.com/nim-lang/Nim',
      );
      await expect(resolvePackageUrl('Nim')).resolves.toBe(
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

    it('resolves from companion nimble.lock (Tier 1)', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'nimble.lock') {
          return Promise.resolve(
            JSON.stringify({
              packages: {
                chronos: {
                  url: 'https://github.com/status-im/nim-chronos',
                },
              },
            }),
          );
        }
        return Promise.resolve(null);
      });

      const res = await resolvePackageUrl('chronos', 'project.nimble');
      expect(res).toBe('https://github.com/status-im/nim-chronos');
    });

    it('resolves from companion atlas.lock (Tier 1)', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'atlas.lock') {
          return Promise.resolve(
            JSON.stringify({
              packages: {
                zippy: {
                  url: 'https://github.com/guzba/zippy',
                },
              },
            }),
          );
        }
        return Promise.resolve(null);
      });

      const res = await resolvePackageUrl('zippy', 'project.nimble');
      expect(res).toBe('https://github.com/guzba/zippy');
    });

    it('ignores package entries in lockfile with no url or non-matching dep', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'nimble.lock') {
          return Promise.resolve(
            JSON.stringify({
              packages: {
                other: { url: 'https://github.com/other/other' },
                chronos: {},
              },
            }),
          );
        }
        return Promise.resolve(null);
      });

      vi.mocked(packageCache.get).mockResolvedValueOnce({
        chronos: 'https://github.com/status-im/nim-chronos',
      });

      const res = await resolvePackageUrl('chronos', 'project.nimble');
      expect(res).toBe('https://github.com/status-im/nim-chronos');
    });

    it('ignores corrupted lockfile JSON gracefully and falls back to Tier 2', async () => {
      fs.readLocalFile.mockImplementation((file: string) => {
        if (file === 'nimble.lock') {
          return Promise.resolve('corrupted json {{{');
        }
        return Promise.resolve(null);
      });

      vi.mocked(packageCache.get).mockResolvedValueOnce({
        chronos: 'https://github.com/status-im/nim-chronos',
      });

      const res = await resolvePackageUrl('chronos', 'project.nimble');
      expect(res).toBe('https://github.com/status-im/nim-chronos');
    });

    it('resolves from upstream registry when lockfile is absent (Tier 2)', async () => {
      fs.readLocalFile.mockResolvedValue(null);
      vi.mocked(packageCache.get).mockResolvedValueOnce({
        chronos: 'https://github.com/status-im/nim-chronos',
      });

      const res = await resolvePackageUrl('chronos');
      expect(res).toBe('https://github.com/status-im/nim-chronos');
    });

    it('returns undefined if not found anywhere (Tier 3)', async () => {
      fs.readLocalFile.mockResolvedValue(null);
      vi.mocked(packageCache.get).mockResolvedValueOnce({});

      const res = await resolvePackageUrl('unknown-pkg');
      expect(res).toBeUndefined();
    });
  });
});

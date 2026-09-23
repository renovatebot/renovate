import { GlobalConfig } from '../../../config/global.ts';
import * as _packageCache from '../../../util/cache/package/index.ts';
import type { Timestamp } from '../../../util/timestamp.ts';
import { GoVersionTimestampCache } from './timestamp-cache.ts';

vi.mock('../../../util/cache/package/index.ts');
const packageCache = vi.mocked(_packageCache);

describe('modules/datasource/go/timestamp-cache', () => {
  const baseUrl = 'https://proxy.golang.org';
  const packageName = 'github.com/foo/bar';
  const cacheKey = 'https://proxy.golang.org@@github.com/foo/bar';
  const ttlMinutes = 100 * 24 * 60;

  const v1 = '2018-01-01T00:00:00.000Z' as Timestamp;
  const v2 = '2019-01-01T00:00:00.000Z' as Timestamp;

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('stores newly fetched timestamps', async () => {
    const cache = await GoVersionTimestampCache.init(baseUrl, packageName);
    expect(cache.get('v1.0.0')).toBeUndefined();

    cache.set('v1.0.0', v1);
    await cache.save();

    expect(packageCache.set).toHaveBeenCalledWith(
      'datasource-go-proxy-timestamps',
      cacheKey,
      { 'v1.0.0': v1 },
      ttlMinutes,
    );
  });

  it('serves known timestamps without writing again', async () => {
    packageCache.get.mockResolvedValue({ 'v1.0.0': v1 });

    const cache = await GoVersionTimestampCache.init(baseUrl, packageName);

    expect(cache.get('v1.0.0')).toBe(v1);
    await cache.save();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('merges with timestamps written while it was fetching', async () => {
    packageCache.get
      .mockResolvedValueOnce({ 'v1.0.0': v1 })
      .mockResolvedValueOnce({ 'v1.0.0': v1, 'v3.0.0': v2 });

    const cache = await GoVersionTimestampCache.init(baseUrl, packageName);
    cache.set('v2.0.0', v2);
    await cache.save();

    expect(packageCache.set).toHaveBeenCalledWith(
      'datasource-go-proxy-timestamps',
      cacheKey,
      { 'v1.0.0': v1, 'v2.0.0': v2, 'v3.0.0': v2 },
      ttlMinutes,
    );
  });

  it('ignores cached data which is not a map of timestamps', async () => {
    packageCache.get.mockResolvedValue({ 'v1.0.0': { not: 'a timestamp' } });

    const cache = await GoVersionTimestampCache.init(baseUrl, packageName);

    expect(cache.get('v1.0.0')).toBeUndefined();
  });

  it('keys on the proxy, without its credentials', async () => {
    const cache = await GoVersionTimestampCache.init(
      'https://user:pass@artifactory.example.com/api/go/go/',
      packageName,
    );
    cache.set('v1.0.0', v1);
    await cache.save();

    expect(packageCache.set).toHaveBeenCalledWith(
      'datasource-go-proxy-timestamps',
      'https://artifactory.example.com/api/go/go@@github.com/foo/bar',
      { 'v1.0.0': v1 },
      ttlMinutes,
    );
  });

  it('does not cache private modules', async () => {
    vi.stubEnv('GOPRIVATE', 'github.com/foo/*');
    packageCache.get.mockResolvedValue({ 'v1.0.0': v1 });

    const cache = await GoVersionTimestampCache.init(baseUrl, packageName);
    cache.set('v2.0.0', v2);
    await cache.save();

    expect(cache.get('v1.0.0')).toBeUndefined();
    expect(packageCache.get).not.toHaveBeenCalled();
    expect(packageCache.set).not.toHaveBeenCalled();
  });

  it('caches private modules if cachePrivatePackages is enabled', async () => {
    GlobalConfig.set({ cachePrivatePackages: true });
    vi.stubEnv('GOPRIVATE', 'github.com/foo/*');

    const cache = await GoVersionTimestampCache.init(baseUrl, packageName);
    cache.set('v1.0.0', v1);
    await cache.save();

    expect(packageCache.set).toHaveBeenCalledWith(
      'datasource-go-proxy-timestamps',
      cacheKey,
      { 'v1.0.0': v1 },
      ttlMinutes,
    );
  });

  it('does not cache if the proxy URL cannot be parsed', async () => {
    const cache = await GoVersionTimestampCache.init('not-a-url', packageName);
    cache.set('v1.0.0', v1);
    await cache.save();

    expect(packageCache.get).not.toHaveBeenCalled();
    expect(packageCache.set).not.toHaveBeenCalled();
  });
});

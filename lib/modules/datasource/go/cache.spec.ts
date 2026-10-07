import { codeBlock } from 'common-tags';
import { dir as tmpDir } from 'tmp-promise';
import { getConfig } from '../../../config/defaults.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import { normalizeDepNames } from '../../../workers/repository/extract/manager-files.ts';
import { fetchUpdates } from '../../../workers/repository/process/fetch.ts';
import { flattenUpdates } from '../../../workers/repository/updates/flatten.ts';
import { extractPackageFile } from '../../manager/gomod/extract.ts';
import { GithubTagsDatasource } from '../github-tags/index.ts';
import { GoDatasource } from './index.ts';
import { GoProxyDatasource } from './releases-goproxy.ts';

const packageName = 'github.com/foo/bar';
const releases = [
  { version: 'v1.0.0' },
  { version: 'v1.1.0' },
  { version: 'v1.2.0' },
];
const legacyKeys = [
  ['datasource-go', `cache-decorator:getReleases:${packageName}@@`],
  ['datasource-go-proxy', `cache-decorator:${packageName}@@direct@@undefined`],
  ['datasource-go-direct', `cache-decorator:${packageName}`],
] as const;

async function lookupUpdates() {
  const config = getConfig();
  config.baseBranch = 'main';
  config.semanticCommits = 'disabled';
  config.packageRules = [
    {
      matchJsonata: ["effectiveDatasource = 'github-tags'"],
      allowedVersions: '<1.2.0',
    },
  ];
  const extracted = extractPackageFile(codeBlock`
    module example.com/test

    require github.com/foo/bar v1.0.0
  `)!;
  for (const dep of extracted.deps) {
    normalizeDepNames(dep);
  }
  const files = { gomod: [{ ...extracted, packageFile: 'go.mod' }] };
  await fetchUpdates(config, files);
  const updates = await flattenUpdates(config, files);
  return updates;
}

describe('modules/datasource/go/cache', () => {
  let dirResult: Awaited<ReturnType<typeof tmpDir>>;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime('2026-01-01T00:00:00Z');
    vi.stubEnv('GOPROXY', 'direct');
    vi.stubEnv('GONOPROXY', '');
    vi.stubEnv('GOPRIVATE', '');
    memCache.init();
    GlobalConfig.set({ cachePrivatePackages: true });
    dirResult = await tmpDir({ unsafeCleanup: true });
    await packageCache.init({ cacheDir: dirResult.path });
    vi.spyOn(GithubTagsDatasource.prototype, 'getReleases').mockResolvedValue({
      sourceUrl: 'https://github.com/foo/bar',
      releases: releases.map((release) => ({ ...release })),
    });
  });

  afterEach(async () => {
    await packageCache.cleanup({});
    await dirResult.cleanup();
    memCache.reset();
    GlobalConfig.reset();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it.each(legacyKeys)(
    'refreshes legacy %s releases before applying effectiveDatasource rules',
    async (namespace, key) => {
      await packageCache.setWithRawTtl(
        namespace,
        key,
        {
          cachedAt: new Date().toISOString(),
          value: { sourceUrl: 'https://github.com/foo/bar', releases },
        },
        10080,
      );
      memCache.init();

      const updates = await lookupUpdates();

      expect(updates[0]).toMatchObject({
        effectiveDatasource: 'github-tags',
        newValue: 'v1.1.0',
      });
      expect(GithubTagsDatasource.prototype.getReleases).toHaveBeenCalledOnce();
    },
  );

  it.each(legacyKeys)(
    'does not return legacy %s releases through stale fallback',
    async (namespace, key) => {
      await packageCache.setWithRawTtl(
        namespace,
        key,
        {
          cachedAt: '2025-12-31T23:00:00Z',
          value: { sourceUrl: 'https://github.com/foo/bar', releases },
        },
        10080,
      );
      memCache.init();
      vi.mocked(GithubTagsDatasource.prototype.getReleases).mockRejectedValue(
        new Error('upstream unavailable'),
      );

      await expect(
        new GoDatasource().getReleases({ packageName }),
      ).rejects.toThrow('upstream unavailable');
    },
  );

  it('reuses new persistent cache entries with delegation metadata', async () => {
    await lookupUpdates();
    memCache.init();

    const updates = await lookupUpdates();

    expect(updates[0]).toMatchObject({
      effectiveDatasource: 'github-tags',
      newValue: 'v1.1.0',
    });
    expect(GithubTagsDatasource.prototype.getReleases).toHaveBeenCalledOnce();
  });

  it('keeps valid proxy results cacheable without effectiveDatasource', async () => {
    vi.stubEnv('GOPROXY', 'https://proxy.golang.org');
    const getVersions = vi
      .spyOn(GoProxyDatasource.prototype, 'getVersionsWithInfo')
      .mockResolvedValue({ sourceUrl: 'https://github.com/foo/bar', releases });
    vi.spyOn(
      GoProxyDatasource.prototype,
      'addGithubTimestamps',
    ).mockResolvedValue();
    const datasource = new GoDatasource();
    await datasource.getReleases({ packageName });
    memCache.init();

    const result = await datasource.getReleases({ packageName });
    const updates = await lookupUpdates();

    expect(result?.effectiveDatasource).toBeUndefined();
    expect(updates[0].newValue).toBe('v1.2.0');
    expect(getVersions).toHaveBeenCalledOnce();
    expect(GithubTagsDatasource.prototype.getReleases).not.toHaveBeenCalled();
  });

  it('preserves namespace TTL overrides and new-result stale fallback', async () => {
    GlobalConfig.set({
      cachePrivatePackages: true,
      cacheTtlOverride: { 'datasource-go*': 60 },
    });
    await lookupUpdates();
    vi.setSystemTime('2026-01-01T00:45:00Z');
    memCache.init();
    await lookupUpdates();
    expect(GithubTagsDatasource.prototype.getReleases).toHaveBeenCalledOnce();
    vi.setSystemTime('2026-01-01T01:01:00Z');
    memCache.init();
    vi.mocked(GithubTagsDatasource.prototype.getReleases).mockRejectedValue(
      new Error('upstream unavailable'),
    );

    const updates = await lookupUpdates();

    expect(updates[0]).toMatchObject({
      effectiveDatasource: 'github-tags',
      newValue: 'v1.1.0',
    });
    expect(GithubTagsDatasource.prototype.getReleases).toHaveBeenCalledTimes(2);
  });

  it('reuses existing digest and Go directive cache entries', async () => {
    await packageCache.setWithRawTtl(
      'datasource-go',
      `cache-decorator:getDigest:${packageName}:v1.2.0`,
      { cachedAt: new Date().toISOString(), value: '0123456789ab' },
      10080,
    );
    await packageCache.setWithRawTtl(
      'datasource-go-proxy',
      `cache-decorator:${packageName}@@v1.2.0@@direct@@undefined`,
      { cachedAt: new Date().toISOString(), value: '1.20' },
      144000,
    );
    memCache.init();

    const digest = await new GoDatasource().getDigest(
      { packageName },
      'v1.2.0',
    );
    const directive =
      await new GoProxyDatasource().retrieveGoDirectiveForModule(
        'https://proxy.golang.org',
        packageName,
        'v1.2.0',
      );

    expect(digest).toBe('0123456789ab');
    expect(directive).toBe('1.20');
    expect(GithubTagsDatasource.prototype.getReleases).not.toHaveBeenCalled();
  });
});

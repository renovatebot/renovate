import { codeBlock } from 'common-tags';
import { fakeSha, fs, logger, partial, scm } from '~test/util.ts';
import { mergeChildConfig } from '../../../config/utils.ts';
import { extractPackageFile as extractRegexPackageFile } from '../../../modules/manager/custom/regex/index.ts';
import { hashMap } from '../../../modules/manager/index.ts';
import * as npmrc from '../../../modules/manager/npmrc.ts';
import type {
  NpmrcPackageFile,
  PackageFile,
} from '../../../modules/manager/types.ts';
import * as _repositoryCache from '../../../util/cache/repository/index.ts';
import type {
  BaseBranchCache,
  RepoCacheData,
} from '../../../util/cache/repository/types.ts';
import { fingerprint } from '../../../util/fingerprint.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { sanitize } from '../../../util/sanitize.ts';
import { generateFingerprintConfig } from '../extract/extract-fingerprint-config.ts';
import * as _extractAll from '../extract/index.ts';
import * as _branchify from '../updates/branchify.ts';
import {
  EXTRACT_CACHE_REVISION,
  extract,
  isCacheExtractValid,
  lookup,
  update,
} from './extract-update.ts';
import * as _fetch from './fetch.ts';
import * as _write from './write.ts';

const createVulnerabilitiesMock = vi.fn();

vi.mock('./write.ts');
vi.mock('./sort.ts');
vi.mock('./fetch.ts');
vi.mock('./vulnerabilities.ts', () => {
  return {
    __esModule: true,
    Vulnerabilities: class {
      static create() {
        return createVulnerabilitiesMock();
      }
    },
  };
});
vi.mock('../updates/branchify.ts');
vi.mock('../extract/index.ts');
vi.mock('../../../util/cache/repository/index.ts');
vi.mock('../../../util/fs/index.ts');

const branchify = vi.mocked(_branchify);
const extractAll = vi.mocked(_extractAll);
const repositoryCache = vi.mocked(_repositoryCache);
const fetch = vi.mocked(_fetch);
const write = vi.mocked(_write);

describe('workers/repository/process/extract-update', () => {
  const branchSha = fakeSha('123test');

  beforeEach(() => {
    branchify.branchifyUpgrades.mockResolvedValue({
      branches: [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          baseBranch: 'base',
          upgrades: [],
        },
      ],
      branchList: ['branchName'],
    });
  });

  describe('extract()', () => {
    afterEach(() => {
      hostRules.clear();
    });

    it('runs with no baseBranchPatterns', async () => {
      const config = {
        repoIsOnboarded: true,
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      const packageFiles = await extract(config);
      const res = await lookup(config, packageFiles);
      expect(res).toEqual({
        branchList: ['branchName'],
        branches: [
          {
            branchName: 'some-branch',
            manager: 'some-manager',
            baseBranch: 'base',
            upgrades: [],
          },
        ],
        packageFiles: undefined,
      });
    });

    it('runs with baseBranchPatterns', async () => {
      const config = {
        baseBranchPatterns: ['master', 'dev'],
        baseBranches: ['master', 'dev'],
        repoIsOnboarded: true,
        enabledManagers: ['npm'],
        javascript: {
          labels: ['js'],
        },
        npm: {
          addLabels: 'npm',
        },
      };
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      const packageFiles = await extract(config);
      expect(packageFiles).toBeUndefined();
    });

    it('leaves the cache alone when not overwriting it', async () => {
      const config = { repoIsOnboarded: true };
      const cache = { scan: {} };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);

      await extract(config, false);

      expect(cache.scan).toEqual({});
    });

    it('keeps cached scans for branches that are still configured', async () => {
      const config = {
        baseBranch: 'master',
        baseBranches: ['master'],
        repoIsOnboarded: true,
      };
      const cache = {
        scan: {
          master: { sha: 'old' },
          stale: { sha: 'old' },
        },
      };
      repositoryCache.getCache.mockReturnValueOnce(cache as never);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);

      await extract(config);

      expect(Object.keys(cache.scan)).toEqual(['master']);
    });

    it('caches package files without URL credentials', async () => {
      const config = { baseBranch: 'master', repoIsOnboarded: true };
      const packageFiles: Record<string, PackageFile[]> = {
        regex: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'foo',
                registryUrls: [
                  'https://oauth2accesstoken@region-docker.pkg.dev/p/',
                ],
                replaceString: 'foo 1.0.0 https://registry.example.com/',
              },
            ],
          },
        ],
      };
      const cache: RepoCacheData = { scan: {} };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      const res = await extract(config);

      expect(res).toBe(packageFiles);
      expect(cache.scan?.master).toEqual({
        revision: EXTRACT_CACHE_REVISION,
        sha: branchSha,
        configHash: fingerprint(generateFingerprintConfig(config)),
        extractionFingerprints: {},
        packageFiles,
      });
    });

    it('does not cache package files with URL credentials', async () => {
      const config = { baseBranch: 'master', repoIsOnboarded: true };
      const packageFiles: Record<string, PackageFile[]> = {
        regex: [
          {
            packageFile: 'Dockerfile',
            deps: [
              {
                depName: 'foo',
                replaceString:
                  'foo 1.0.0 https://user:token@registry.example.com/',
              },
            ],
          },
        ],
      };
      const cache: RepoCacheData = {
        scan: { master: partial<BaseBranchCache>({ sha: 'old' }) },
      };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      const res = await extract(config);

      expect(res).toBe(packageFiles);
      expect(cache.scan).toEqual({});
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { baseBranch: 'master' },
        'The package files contain URLs with credentials, so the extract result is not cached: configure the credentials through hostRules instead',
      );
    });

    it('does not cache a regex manager extract with credentials in a matched URL', async () => {
      const config = { baseBranch: 'master', repoIsOnboarded: true };
      const content = codeBlock`
        FROM alpine
        # renovate: registry=https://user:token@registry.example.com/
        ENV FOO_VERSION=1.0.0
      `;
      const regexPackageFile = await extractRegexPackageFile(
        content,
        'Dockerfile',
        {
          matchStrings: [
            '# renovate: registry=(?<registryUrl>\\S+)\\s+ENV FOO_VERSION=(?<currentValue>\\S+)',
          ],
          depNameTemplate: 'foo',
          datasourceTemplate: 'npm',
          registryUrlTemplate: '{{{registryUrl}}}',
        },
      );
      const packageFiles: Record<string, PackageFile[]> = {
        regex: [{ ...regexPackageFile!, packageFile: 'Dockerfile' }],
      };
      const cache: RepoCacheData = { scan: {} };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      await extract(config);

      expect(packageFiles.regex[0].deps[0].replaceString).toContain(
        'https://user:token@registry.example.com/',
      );
      expect(cache.scan).toEqual({});
    });

    it('uses repository cache', async () => {
      const packageFiles: Record<string, PackageFile[]> = {};
      const config = {
        repoIsOnboarded: true,
        baseBranch: 'master',
      };
      repositoryCache.getCache.mockReturnValueOnce({
        scan: {
          master: {
            revision: EXTRACT_CACHE_REVISION,
            sha: branchSha,
            configHash: fingerprint(generateFingerprintConfig(config)),
            extractionFingerprints: {},
            packageFiles,
          },
        },
      });
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      const res = await extract(config);
      expect(res).toEqual(packageFiles);
    });

    it('extracts again when cached registry URLs hold credentials', async () => {
      const registryUrl = 'https://user:pass@reg.example.com/npm';
      const cachedPackageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            registryUrls: [registryUrl],
            deps: [{ depName: 'foo' }],
          },
        ],
      };
      const config = {
        repoIsOnboarded: true,
        baseBranch: 'master',
      };
      const cache: RepoCacheData = {
        scan: {
          master: {
            revision: EXTRACT_CACHE_REVISION,
            sha: branchSha,
            configHash: fingerprint(generateFingerprintConfig(config)),
            extractionFingerprints: {},
            packageFiles: cachedPackageFiles,
          },
        },
      };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles: {
          npm: [
            {
              packageFile: 'package.json',
              registryUrls: [registryUrl],
              deps: [{ depName: 'foo', datasource: 'npm' }],
            },
          ],
        },
        extractionFingerprints: {},
      });

      const res = await extract(config);

      expect(scm.checkoutBranch).toHaveBeenCalledWith('master');
      expect(res.npm[0].registryUrls).toEqual(['https://reg.example.com/npm']);
      expect(
        hostRules.find({ hostType: 'npm', url: 'https://reg.example.com/npm' }),
      ).toMatchObject({
        username: 'user',
        password: 'pass',
      });
      expect(cache.scan).toEqual({});
    });

    it('does not cache a fresh extract whose registry URLs hold credentials', async () => {
      const cache: RepoCacheData = {
        scan: { master: partial<BaseBranchCache>({ sha: 'old' }) },
      };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      const registryUrl = 'https://user:pass@reg.example.com/npm';
      const withoutNpmrc = vi.spyOn(npmrc, 'withoutNpmrc');
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles: {
          npm: [
            {
              packageFile: 'package.json',
              registryUrls: [registryUrl],
              additionalRegistryUrls: [registryUrl],
              deps: [
                {
                  depName: 'foo',
                  datasource: 'npm',
                  registryUrls: [registryUrl],
                },
                { depName: 'bar', datasource: 'npm' },
              ],
            },
            { packageFile: 'other/package.json', deps: [] },
          ],
        },
        extractionFingerprints: {},
      });

      const res = await extract({
        repoIsOnboarded: true,
        baseBranch: 'master',
      });

      const stripped = 'https://reg.example.com/npm';
      expect(res).toEqual({
        npm: [
          {
            packageFile: 'package.json',
            registryUrls: [stripped],
            additionalRegistryUrls: [stripped],
            deps: [
              { depName: 'foo', datasource: 'npm', registryUrls: [stripped] },
              { depName: 'bar', datasource: 'npm' },
            ],
          },
          { packageFile: 'other/package.json', deps: [] },
        ],
      });
      expect(hostRules.find({ hostType: 'npm', url: stripped })).toMatchObject({
        username: 'user',
        password: 'pass',
      });
      expect(hostRules.find({ url: stripped })).toEqual({});
      expect(hostRules.getAll()).toBeEmptyArray();
      expect(withoutNpmrc).toHaveBeenCalledOnce();
      expect(cache.scan).toEqual({});
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { baseBranch: 'master' },
        'The package files contain URLs with credentials, so the extract result is not cached: configure the credentials through hostRules instead',
      );
    });

    it('caches a fresh extract whose registry URLs hold no credentials', async () => {
      const cache: RepoCacheData = { scan: {} };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            registryUrls: ['https://${USER}:${PASS}@reg.example.com/npm'],
            deps: [{ depName: 'foo' }],
          },
        ],
      };
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });
      const config = { repoIsOnboarded: true, baseBranch: 'master' };
      const withoutNpmrc = vi.spyOn(npmrc, 'withoutNpmrc');

      await extract(config);

      expect(withoutNpmrc).toHaveBeenCalledOnce();
      expect(cache.scan?.master).toEqual({
        revision: EXTRACT_CACHE_REVISION,
        sha: branchSha,
        configHash: fingerprint(generateFingerprintConfig(config)),
        extractionFingerprints: {},
        packageFiles: {
          npm: [
            {
              packageFile: 'package.json',
              registryUrls: ['https://reg.example.com/npm'],
              deps: [{ depName: 'foo' }],
            },
          ],
        },
      });
      expect(hostRules.getAll()).toBeEmptyArray();
    });

    it('keeps the credentials of a host rule for the host for its hostType only', async () => {
      hostRules.add(
        { hostType: 'maven', matchHost: 'reg.example.com', token: 'admin' },
        { trusted: true },
      );
      const registryUrl = 'https://user:pass@reg.example.com/maven';
      const packageFiles: Record<string, PackageFile[]> = {
        gradle: [
          {
            packageFile: 'build.gradle',
            registryUrls: [registryUrl],
            deps: [
              { depName: 'foo', datasource: 'npm' },
              {
                depName: 'bar',
                datasource: 'maven',
                registryUrls: [registryUrl],
              },
            ],
          },
        ],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      await extract({ repoIsOnboarded: true, baseBranch: 'master' });

      expect(JSON.stringify(packageFiles)).not.toContain('user:pass@');
      expect(hostRules.getAll()).toHaveLength(1);
      // the configured credentials win for their hostType, the npm deps get the ones from the URL
      const maven = hostRules.find({
        hostType: 'maven',
        url: 'https://reg.example.com/maven',
      });
      expect(maven.token).toBe('admin');
      expect(maven.username).toBeUndefined();
      expect(
        hostRules.find({
          hostType: 'npm',
          url: 'https://reg.example.com/maven',
        }),
      ).toMatchObject({ username: 'user', password: 'pass' });
    });

    it('keeps the credentials of a host rule without matchHost for the datasource of the URLs', async () => {
      hostRules.add({ hostType: 'maven', token: 'admin' }, { trusted: true });
      const registryUrl = 'https://user:pass@reg.example.com/maven';
      const otherUrl = 'https://user:pass@other.example.com/maven';
      const packageFiles: Record<string, PackageFile[]> = {
        gradle: [
          {
            packageFile: 'build.gradle',
            registryUrls: [registryUrl],
            deps: [
              { depName: 'foo', datasource: 'maven' },
              { depName: 'bar', datasource: 'maven' },
            ],
          },
          {
            packageFile: 'other.gradle',
            datasource: 'maven',
            additionalRegistryUrls: [registryUrl],
            deps: [],
          },
          {
            packageFile: 'deps.gradle',
            deps: [
              {
                depName: 'baz',
                datasource: 'maven',
                registryUrls: [registryUrl],
              },
              {
                depName: 'qux',
                datasource: 'npm',
                registryUrls: [otherUrl],
              },
              { depName: 'quux', registryUrls: [otherUrl] },
            ],
          },
        ],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      await extract({ repoIsOnboarded: true, baseBranch: 'master' });

      expect(JSON.stringify(packageFiles)).not.toContain('user:pass@');
      expect(hostRules.getAll()).toMatchObject([
        { hostType: 'maven', token: 'admin' },
      ]);
      const maven = hostRules.find({
        hostType: 'maven',
        url: 'https://reg.example.com/maven/foo',
      });
      expect(maven.token).toBe('admin');
      expect(maven.username).toBeUndefined();
      expect(
        hostRules.find({
          hostType: 'npm',
          url: 'https://other.example.com/maven/foo',
        }),
      ).toMatchObject({ username: 'user', password: 'pass' });
    });

    it('registers the credentials for the host type a custom datasource requests with', async () => {
      const registryUrl = 'https://user:pass@reg.example.com/custom';
      const packageFiles: Record<string, PackageFile[]> = {
        regex: [
          {
            packageFile: 'versions.txt',
            registryUrls: [registryUrl],
            deps: [
              {
                depName: 'foo',
                datasource: 'custom.foo',
                registryUrls: [registryUrl],
              },
              { depName: 'bar', datasource: 'does-not-exist' },
            ],
          },
        ],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      await extract({ repoIsOnboarded: true, baseBranch: 'master' });

      expect(JSON.stringify(packageFiles)).not.toContain('user:pass@');
      expect(
        hostRules.find({
          hostType: 'custom',
          url: 'https://reg.example.com/custom/foo',
        }),
      ).toMatchObject({ username: 'user', password: 'pass' });
      expect(
        hostRules.find({
          hostType: 'custom.foo',
          url: 'https://reg.example.com/custom/foo',
        }),
      ).toEqual({});
      expect(
        hostRules.find({
          hostType: 'does-not-exist',
          url: 'https://reg.example.com/custom/foo',
        }),
      ).toEqual({});
    });

    it('only strips the credentials of registry URLs for a datasource without custom registry support and caches the extract', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        gomod: [
          {
            packageFile: 'go.mod',
            deps: [
              {
                depName: 'git.example.com/org/mod',
                datasource: 'go',
                registryUrls: [
                  'https://user:secret-password-1234@git.example.com/',
                ],
              },
            ],
          },
        ],
      };
      const cache: RepoCacheData = { scan: {} };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      await extract({ repoIsOnboarded: true, baseBranch: 'master' });

      expect(packageFiles.gomod[0].deps[0].registryUrls).toEqual([
        'https://git.example.com/',
      ]);
      expect(
        hostRules.find({
          hostType: 'go',
          url: 'https://git.example.com/org/mod',
        }),
      ).toEqual({});
      expect(sanitize('secret-password-1234')).toBe('**redacted**');
      expect(cache.scan?.master?.packageFiles).toEqual(packageFiles);
      expect(logger.logger.once.warn).not.toHaveBeenCalled();
    });

    it('registers the credentials of registry URLs for a datasource with custom registry support and does not cache the extract', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        npm: [
          {
            packageFile: 'package.json',
            deps: [
              {
                depName: 'foo',
                datasource: 'npm',
                registryUrls: [
                  'https://user:secret-password-5678@reg.example.com/npm',
                ],
              },
            ],
          },
        ],
      };
      const cache: RepoCacheData = { scan: {} };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      await extract({ repoIsOnboarded: true, baseBranch: 'master' });

      expect(packageFiles.npm[0].deps[0].registryUrls).toEqual([
        'https://reg.example.com/npm',
      ]);
      expect(
        hostRules.find({
          hostType: 'npm',
          url: 'https://reg.example.com/npm/foo',
        }),
      ).toMatchObject({ username: 'user', password: 'secret-password-5678' });
      expect(cache.scan).toEqual({});
      expect(logger.logger.once.warn).toHaveBeenCalledWith(
        { baseBranch: 'master' },
        'The package files contain URLs with credentials, so the extract result is not cached: configure the credentials through hostRules instead',
      );
    });

    it('keeps non-string registry URLs', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        kustomize: [
          {
            packageFile: 'kustomization.yaml',
            registryUrls: [undefined as never],
            additionalRegistryUrls: [null as never],
            deps: [
              {
                depName: 'local-chart',
                datasource: 'helm',
                registryUrls: [undefined as never],
              },
            ],
          },
        ],
      };
      const cache: RepoCacheData = { scan: {} };
      repositoryCache.getCache.mockReturnValueOnce(cache);
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });

      await extract({ repoIsOnboarded: true, baseBranch: 'master' });

      expect(packageFiles.kustomize[0]).toMatchObject({
        registryUrls: [undefined],
        additionalRegistryUrls: [null],
        deps: [{ registryUrls: [undefined] }],
      });
      expect(cache.scan?.master?.packageFiles).toEqual(packageFiles);
    });

    it('does not add registry URLs to package files and deps without them', async () => {
      const packageFiles: Record<string, PackageFile[]> = {
        nuget: [
          {
            packageFile: 'test.csproj',
            deps: [{ depName: 'foo', datasource: 'nuget' }],
          },
        ],
      };
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.getBranchCommit.mockResolvedValueOnce(branchSha);
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);
      extractAll.extractAllDependencies.mockResolvedValueOnce({
        packageFiles,
        extractionFingerprints: {},
      });
      const registryUrls = ['https://nuget.example.com/v3/index.json'];

      await extract({ repoIsOnboarded: true, baseBranch: 'master' });

      const [file] = packageFiles.nuget;
      expect(Object.hasOwn(file, 'registryUrls')).toBeFalse();
      expect(Object.hasOwn(file, 'additionalRegistryUrls')).toBeFalse();
      expect(Object.hasOwn(file.deps[0], 'registryUrls')).toBeFalse();
      const fileConfig = mergeChildConfig({ registryUrls }, file);
      expect(fileConfig.registryUrls).toEqual(registryUrls);
      expect(mergeChildConfig(fileConfig, file.deps[0]).registryUrls).toEqual(
        registryUrls,
      );
    });

    describe('cached package files', () => {
      const config = { repoIsOnboarded: true, baseBranch: 'master' };
      let cache: { scan: Record<string, BaseBranchCache> };

      beforeEach(() => {
        cache = { scan: {} };
        repositoryCache.getCache.mockReturnValue(cache);
        scm.getBranchCommit.mockResolvedValue(branchSha);
        scm.checkoutBranch.mockResolvedValue(branchSha);
      });

      function createPackageFiles(): Record<string, PackageFile[]> {
        return {
          npm: [
            {
              packageFile: 'package.json',
              deps: [{ depName: 'axios', currentValue: '1.14.0' }],
            },
          ],
        };
      }

      it('stores a copy of the extracted package files', async () => {
        extractAll.extractAllDependencies.mockResolvedValueOnce({
          packageFiles: createPackageFiles(),
          extractionFingerprints: {},
        });

        const res = await extract(config);
        res.npm[0].deps[0].skipReason = 'internal-error';

        expect(cache.scan.master.packageFiles).toEqual(createPackageFiles());
      });

      it('returns a copy of the cached package files', async () => {
        cache.scan.master = {
          revision: EXTRACT_CACHE_REVISION,
          sha: branchSha,
          configHash: fingerprint(generateFingerprintConfig(config)),
          extractionFingerprints: {},
          packageFiles: createPackageFiles(),
        };

        const res = await extract(config);
        res.npm[0].deps[0].skipReason = 'internal-error';

        expect(cache.scan.master.packageFiles).toEqual(createPackageFiles());
        expect(
          (await extract(config)).npm[0].deps[0].skipReason,
        ).toBeUndefined();
      });
    });

    describe('npmrc', () => {
      const configNpmrc = '//registry.npmjs.org/:_authToken=secret';
      const repoNpmrc = {
        fileName: '.npmrc',
        content: 'registry=https://reg.example.com/\n',
        detectedLineEnding: '\n',
      };

      it('caches package files without their npmrc', async () => {
        const cache: { scan: Record<string, BaseBranchCache> } = { scan: {} };
        repositoryCache.getCache.mockReturnValueOnce(cache);
        scm.getBranchCommit.mockResolvedValueOnce(branchSha);
        scm.checkoutBranch.mockResolvedValueOnce(branchSha);
        const gradleFile = { packageFile: 'build.gradle', deps: [] };
        const npmFile: NpmrcPackageFile = {
          packageFile: 'package.json',
          npmrc: `${configNpmrc}\n${repoNpmrc.content}`,
          managerData: { npmrcFileName: '.npmrc', repoNpmrc },
          deps: [],
        };
        extractAll.extractAllDependencies.mockResolvedValueOnce({
          packageFiles: { npm: [npmFile], gradle: [gradleFile] },
          extractionFingerprints: {},
        });
        const config = {
          repoIsOnboarded: true,
          baseBranch: 'master',
          npmrc: configNpmrc,
        };

        const res = await extract(config);

        expect((res.npm[0] as NpmrcPackageFile).npmrc).toBe(
          `${configNpmrc}\n${repoNpmrc.content}`,
        );
        expect(cache.scan.master.packageFiles.npm[0]).toEqual({
          packageFile: 'package.json',
          managerData: { npmrcFileName: '.npmrc', repoNpmrc },
          deps: [],
        });
        expect(cache.scan.master.packageFiles.gradle[0]).toEqual(gradleFile);
        expect(cache.scan.master.packageFiles.gradle[0]).not.toBe(gradleFile);
        expect(JSON.stringify(cache)).not.toContain('secret');
      });

      it('caches package files whose npmrc holds a URL with credentials', async () => {
        const cache: { scan: Record<string, BaseBranchCache> } = { scan: {} };
        repositoryCache.getCache.mockReturnValueOnce(cache);
        scm.getBranchCommit.mockResolvedValueOnce(branchSha);
        scm.checkoutBranch.mockResolvedValueOnce(branchSha);
        const npmFile: NpmrcPackageFile = {
          packageFile: 'package.json',
          npmrc: 'registry=https://user:secret@reg.example.com/\n',
          deps: [],
        };
        extractAll.extractAllDependencies.mockResolvedValueOnce({
          packageFiles: { npm: [npmFile] },
          extractionFingerprints: {},
        });

        await extract({ repoIsOnboarded: true, baseBranch: 'master' });

        expect(cache.scan.master.packageFiles.npm[0]).toEqual({
          packageFile: 'package.json',
          deps: [],
        });
        expect(JSON.stringify(cache)).not.toContain('secret');
      });

      it('rebuilds the npmrc when using the cached extract', async () => {
        const packageFiles: Record<string, PackageFile[]> = {
          npm: [
            {
              packageFile: 'package.json',
              managerData: { npmrcFileName: '.npmrc', repoNpmrc },
              deps: [],
            },
            {
              packageFile: 'other/package.json',
              managerData: { npmrcFileName: null },
              deps: [],
            },
            { packageFile: 'pnpm-workspace.yaml', deps: [] },
          ],
          gradle: [{ packageFile: 'build.gradle', deps: [] }],
        };
        const config = {
          repoIsOnboarded: true,
          baseBranch: 'master',
          npmrc: configNpmrc,
          npmrcMerge: true,
        };
        repositoryCache.getCache.mockReturnValueOnce({
          scan: {
            master: {
              revision: EXTRACT_CACHE_REVISION,
              sha: branchSha,
              configHash: fingerprint(generateFingerprintConfig(config)),
              extractionFingerprints: {},
              packageFiles,
            },
          },
        });
        scm.getBranchCommit.mockResolvedValueOnce(branchSha);

        const res = await extract(config);

        expect(scm.checkoutBranch).not.toHaveBeenCalled();
        const [first, second, workspace] = res.npm as NpmrcPackageFile[];
        expect(first.npmrc).toBe(`${configNpmrc}\n${repoNpmrc.content}`);
        expect(second.npmrc).toBe(configNpmrc);
        // a package file extracted without npmrc, such as a pnpm-workspace.yaml, stays without one
        expect(workspace).not.toHaveProperty('npmrc');
        expect(res.gradle[0]).toEqual(packageFiles.gradle[0]);
        expect(res.gradle[0]).not.toBe(packageFiles.gradle[0]);
        // the cached object stays without it
        expect(JSON.stringify(packageFiles)).not.toContain('secret');
      });

      it('caches the extract without a repository npmrc that has credentials', async () => {
        const cache: { scan: Record<string, BaseBranchCache> } = {
          scan: { master: partial<BaseBranchCache>({ sha: 'old' }) },
        };
        repositoryCache.getCache.mockReturnValueOnce(cache);
        scm.getBranchCommit.mockResolvedValueOnce(branchSha);
        scm.checkoutBranch.mockResolvedValueOnce(branchSha);
        const bunFile: NpmrcPackageFile = {
          packageFile: 'package.json',
          npmrc: '//reg.example.com/:_authToken=repo-secret\n',
          managerData: {
            repoNpmrc: {
              fileName: '.npmrc',
              content: '//reg.example.com/:_authToken=repo-secret\n',
              detectedLineEnding: '\n',
            },
          },
          deps: [],
        };
        extractAll.extractAllDependencies.mockResolvedValueOnce({
          packageFiles: { bun: [bunFile] },
          extractionFingerprints: {},
        });
        const config = { repoIsOnboarded: true, baseBranch: 'master' };

        const res = await extract(config);

        expect(res.bun[0]).toBe(bunFile);
        expect(cache.scan.master.packageFiles.bun[0]).toEqual({
          packageFile: 'package.json',
          managerData: { uncachedNpmrcFileName: '.npmrc' },
          deps: [],
        });
        expect(JSON.stringify(cache)).not.toContain('secret');
        expect(logger.logger.once.warn).toHaveBeenCalledWith(
          { npmrcFileName: '.npmrc' },
          'A repository .npmrc contains credentials, which are not cached: configure them through hostRules or the npmrc option instead',
        );
      });

      it('leaves the cache alone for a repository npmrc that has credentials when not overwriting it', async () => {
        const cache: { scan: Record<string, BaseBranchCache> } = { scan: {} };
        repositoryCache.getCache.mockReturnValueOnce(cache);
        scm.getBranchCommit.mockResolvedValueOnce(branchSha);
        scm.checkoutBranch.mockResolvedValueOnce(branchSha);
        const bunFile: NpmrcPackageFile = {
          packageFile: 'package.json',
          npmrc: '//reg.example.com/:_authToken=repo-secret\n',
          managerData: {
            repoNpmrc: {
              fileName: '.npmrc',
              content: '//reg.example.com/:_authToken=repo-secret\n',
              detectedLineEnding: '\n',
            },
          },
          deps: [],
        };
        extractAll.extractAllDependencies.mockResolvedValueOnce({
          packageFiles: { bun: [bunFile] },
          extractionFingerprints: {},
        });
        const config = { repoIsOnboarded: true, baseBranch: 'master' };

        const res = await extract(config, false);

        expect(res.bun[0]).toBe(bunFile);
        expect(cache.scan).toEqual({});
        expect(logger.logger.once.warn).not.toHaveBeenCalled();
      });

      it('reads a repository npmrc with credentials from disk again when using the cached extract', async () => {
        const packageFiles: Record<string, PackageFile[]> = {
          npm: [
            {
              packageFile: 'package.json',
              managerData: {
                npmrcFileName: '.npmrc',
                uncachedNpmrcFileName: '.npmrc',
              },
              deps: [],
            },
          ],
        };
        const config = {
          repoIsOnboarded: true,
          baseBranch: 'master',
          npmrc: configNpmrc,
          npmrcMerge: true,
        };
        repositoryCache.getCache.mockReturnValueOnce({
          scan: {
            master: {
              revision: EXTRACT_CACHE_REVISION,
              sha: branchSha,
              configHash: fingerprint(generateFingerprintConfig(config)),
              extractionFingerprints: {},
              packageFiles,
            },
          },
        });
        scm.getBranchCommit.mockResolvedValueOnce(branchSha);
        scm.checkoutBranch.mockResolvedValueOnce(branchSha);
        fs.readLocalFile.mockResolvedValueOnce(
          '//reg.example.com/:_authToken=repo-secret\n',
        );

        const res = await extract(config);

        expect(scm.checkoutBranch).toHaveBeenCalledWith('master');
        expect((res.npm[0] as NpmrcPackageFile).npmrc).toBe(
          `${configNpmrc}\n//reg.example.com/:_authToken=repo-secret\n`,
        );
        // the cached object stays without it
        expect(JSON.stringify(packageFiles)).not.toContain('secret');
      });
    });

    it('fetches vulnerabilities', async () => {
      const config = {
        repoIsOnboarded: true,
        osvVulnerabilityAlerts: true,
      };
      const appendVulnerabilityPackageRulesMock = vi.fn();
      createVulnerabilitiesMock.mockResolvedValue({
        appendVulnerabilityPackageRules: appendVulnerabilityPackageRulesMock,
      });
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledTimes(2);
      expect(appendVulnerabilityPackageRulesMock).toHaveBeenCalledTimes(2);
    });

    it('handles exception when fetching vulnerabilities', async () => {
      const config = {
        repoIsOnboarded: true,
        osvVulnerabilityAlerts: true,
      };
      createVulnerabilitiesMock.mockRejectedValueOnce(new Error());
      repositoryCache.getCache.mockReturnValueOnce({ scan: {} });
      scm.checkoutBranch.mockResolvedValueOnce(branchSha);

      const packageFiles = await extract(config);
      await lookup(config, packageFiles);

      expect(createVulnerabilitiesMock).toHaveBeenCalledTimes(2);
    });

    describe('malicious package detection', () => {
      // this follows how the calls should actually work, but as it's heavily mocked, this may end up changing from actual behaviour
      describe('when using mocks', () => {
        it('skips malicious package updates', async () => {
          const packageFiles: Record<string, PackageFile[]> = {
            npm: [
              {
                deps: [
                  // has a malicious update
                  {
                    depType: 'devDependencies',
                    depName: 'axios',
                    currentValue: '1.14.0',
                    datasource: 'npm',
                    prettyDepType: 'devDependency',
                    lockedVersion: '1.14.0',
                    updates: [
                      // will be populated by our mock
                    ],
                    packageName: 'axios',
                  },
                  // not malicious
                  {
                    depType: 'devDependencies',
                    depName: 'axios',
                    currentValue: '1.14.0',
                    datasource: 'npm',
                    prettyDepType: 'devDependency',
                    lockedVersion: '1.14.0',
                    updates: [],
                    packageName: 'axios',
                  },
                ],
                packageFile: 'package.json',
              },
            ],
          };

          const config = {
            repoIsOnboarded: true,
            baseBranch: 'main',
            osvVulnerabilityAlerts: true,
          };
          const appendVulnerabilityPackageRulesMock = vi.fn();
          createVulnerabilitiesMock.mockResolvedValue({
            appendVulnerabilityPackageRules:
              appendVulnerabilityPackageRulesMock,
          });

          // the first time, we're checking what updates are available, so don't modify anything
          appendVulnerabilityPackageRulesMock.mockImplementationOnce(
            async (
              _config: any,
              _packageFiles: Record<string, PackageFile[]>,
            ): Promise<void> => {
              // no-op
            },
          );

          fetch.fetchUpdates.mockImplementation(
            (
              _config: any,
              packageFiles: Record<string, PackageFile[]>,
            ): Promise<void> => {
              packageFiles.npm[0].deps[0].updates = [
                // MAL-2026-2307
                { newVersion: '1.14.1' },
              ];
              return Promise.resolve();
            },
          );

          appendVulnerabilityPackageRulesMock.mockImplementationOnce(
            (
              _config: any,
              packageFiles: Record<string, PackageFile[]>,
            ): Promise<void> => {
              const updates = packageFiles?.npm[0]?.deps[0]?.updates;

              if (updates && updates[0]?.newVersion === '1.14.1') {
                packageFiles.npm[0].deps[0].skipReason =
                  'malicious-update-proposed';
              }
              return Promise.resolve();
            },
          );

          await lookup(config, packageFiles);

          expect(fetch.fetchUpdates).toHaveBeenCalled();
          expect(appendVulnerabilityPackageRulesMock).toHaveBeenCalledTimes(2);

          expect(packageFiles.npm).toHaveLength(1);
          expect(packageFiles.npm[0].deps).toHaveLength(2);
          expect(packageFiles.npm[0].deps[0].skipReason).toEqual(
            'malicious-update-proposed',
          );
        });
      });

      // this
      describe('when manually specifying the `skipReason`s', () => {
        describe('when skipReason=malicious-version-in-use', () => {
          it('logs a warning', async () => {
            const packageFiles: Record<string, PackageFile[]> = {
              npm: [
                {
                  deps: [
                    {
                      depType: 'devDependencies',
                      depName: 'axios',
                      currentValue: '1.14.1',
                      datasource: 'npm',
                      prettyDepType: 'devDependency',
                      lockedVersion: '1.14.1',
                      updates: [],
                      packageName: 'axios',

                      // most importantly
                      skipReason: 'malicious-version-in-use',
                    },
                    // not malicious
                    {
                      depType: 'devDependencies',
                      depName: 'axios',
                      currentValue: '1.14.0',
                      datasource: 'npm',
                      prettyDepType: 'devDependency',
                      lockedVersion: '1.14.0',
                      updates: [],
                      packageName: 'axios',
                    },
                  ],
                  packageFile: 'package.json',
                },
              ],
            };

            const config = {
              repoIsOnboarded: true,
              baseBranch: 'main',
            };

            await lookup(config, packageFiles);

            expect(logger.logger.warn).toHaveBeenCalledWith(
              {
                packageFile: 'package.json',
                depName: 'axios',
                packageName: 'axios',
                manager: 'npm',
                datasource: 'npm',
              },
              'Dependency is currently using a malicious version',
            );
          });

          it('deletes the skipReason and skipStage, to allow the update phase to continue updating', async () => {
            const packageFiles: Record<string, PackageFile[]> = {
              npm: [
                {
                  deps: [
                    {
                      depType: 'devDependencies',
                      depName: 'axios',
                      currentValue: '1.14.1',
                      datasource: 'npm',
                      prettyDepType: 'devDependency',
                      lockedVersion: '1.14.1',
                      updates: [],
                      packageName: 'axios',

                      // most importantly
                      skipReason: 'malicious-version-in-use',
                      skipStage: 'lookup',
                    },
                    // not malicious
                    {
                      depType: 'devDependencies',
                      depName: 'axios',
                      currentValue: '1.14.0',
                      datasource: 'npm',
                      prettyDepType: 'devDependency',
                      lockedVersion: '1.14.0',
                      updates: [],
                      packageName: 'axios',
                    },
                  ],
                  packageFile: 'package.json',
                },
              ],
            };

            const config = {
              repoIsOnboarded: true,
              baseBranch: 'main',
            };

            await lookup(config, packageFiles);

            expect(packageFiles.npm[0].deps[0].skipReason).toBeUndefined();
            expect(packageFiles.npm[0].deps[0].skipStage).toBeUndefined();
          });
        });

        it('when skipReason=malicious-version-in-use, it logs a warning for each skipReason', async () => {
          const packageFiles: Record<string, PackageFile[]> = {
            npm: [
              {
                deps: [
                  {
                    depType: 'devDependencies',
                    depName: 'axios',
                    currentValue: '1.14.0',
                    datasource: 'npm',
                    prettyDepType: 'devDependency',
                    lockedVersion: '1.14.0',
                    updates: [
                      {
                        newVersion: '1.14.1',
                      },
                      {
                        // unrelated, using newValue
                        newValue: '1.14.2',
                      },
                      {
                        // unrelated
                        newVersion: '2.0.0',
                      },
                      {
                        // doesn't have a newVersion or newValue
                        updateType: 'digest',
                        newDigest: '1234',
                      },
                    ],
                    packageName: 'axios',

                    // most importantly
                    skipReason: 'malicious-update-proposed',
                  },
                  // not malicious
                  {
                    depType: 'devDependencies',
                    depName: 'axios',
                    currentValue: '1.14.0',
                    datasource: 'npm',
                    prettyDepType: 'devDependency',
                    lockedVersion: '1.14.0',
                    updates: [],
                    packageName: 'axios',
                  },
                ],
                packageFile: 'package.json',
              },
            ],
          };

          const config = {
            repoIsOnboarded: true,
            baseBranch: 'main',
          };

          await lookup(config, packageFiles);

          expect(logger.logger.warn).toHaveBeenCalledWith(
            {
              packageFile: 'package.json',
              depName: 'axios',
              packageName: 'axios',
              manager: 'npm',
              datasource: 'npm',
              newVersions: ['1.14.1', '1.14.2', '2.0.0'],
            },
            'Dependency has update(s) proposed which would update you to a malicious version - skipping',
          );
        });
      });
    });
  });

  describe('update()', () => {
    it('writes the updates', async () => {
      const config = {};
      const branches = [
        {
          manager: 'some-manager',
          branchName: 'some-branch',
          baseBranch: 'base',
          upgrades: [],
        },
      ];
      write.writeUpdates.mockResolvedValueOnce('automerged');

      const res = await update(config, branches);

      expect(res).toBe('automerged');
      expect(write.writeUpdates).toHaveBeenCalledExactlyOnceWith(
        config,
        branches,
      );
    });
  });

  describe('isCacheExtractValid()', () => {
    let cachedExtract: BaseBranchCache;

    beforeEach(() => {
      cachedExtract = {
        revision: EXTRACT_CACHE_REVISION,
        sha: 'sha',
        configHash: undefined as never,
        extractionFingerprints: {},
        packageFiles: {},
      };
    });

    it('undefined cache', () => {
      expect(isCacheExtractValid('sha', 'hash', undefined)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(0);
    });

    it('returns false if no revision', () => {
      delete cachedExtract.revision;
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('returns false if revision mismatch', () => {
      cachedExtract.revision = -1;
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('partial cache', () => {
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(0);
    });

    it('sha mismatch', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('new_sha', 'hash', cachedExtract)).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        `Cached extract result cannot be used due to base branch SHA change (old=sha, new=new_sha)`,
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('config change', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('sha', 'new_hash', cachedExtract)).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract result cannot be used due to config change',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('invalid if no extractionFingerprints', () => {
      cachedExtract.configHash = 'hash';
      const { extractionFingerprints: _, ...restOfCache } = cachedExtract;
      expect(
        isCacheExtractValid(
          'sha',
          'hash',
          restOfCache as never as BaseBranchCache,
        ),
      ).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract is missing extractionFingerprints, so cannot be used',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('invalid if changed fingerprints', () => {
      cachedExtract.configHash = 'hash';
      cachedExtract.extractionFingerprints = { npm: 'old-fingerprint' };
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });

    it('valid if fingerprints are unchanged', () => {
      cachedExtract.configHash = 'hash';
      cachedExtract.extractionFingerprints = { npm: hashMap.get('npm')! };
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(true);
    });

    const registryUrls = ['https://user:pass@reg.example.com/npm'];

    it.each`
      field                       | file
      ${'registryUrls'}           | ${{ registryUrls, deps: [{ depName: 'foo' }] }}
      ${'additionalRegistryUrls'} | ${{ additionalRegistryUrls: registryUrls, deps: [] }}
      ${'dep registryUrls'}       | ${{ deps: [{ depName: 'foo' }, { depName: 'bar', registryUrls }] }}
      ${'dep replaceString'}      | ${{ deps: [{ depName: 'foo', replaceString: `foo ${registryUrls[0]}` }] }}
      ${'dep managerData'}        | ${{ deps: [{ depName: 'foo', managerData: { url: registryUrls[0] } }] }}
    `('invalid if $field hold URL credentials', ({ file }) => {
      cachedExtract.configHash = 'hash';
      cachedExtract.packageFiles = {
        npm: [{ packageFile: 'package.json', ...file }],
      };

      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract has URLs with credentials, so cannot be used',
      );
    });

    it.each`
      field             | dep
      ${'registryUrl'}  | ${{ registryUrl: registryUrls[0] }}
      ${'changelogUrl'} | ${{ changelogUrl: registryUrls[0] }}
      ${'updates'}      | ${{ updates: [{ registryUrl: registryUrls[0] }] }}
    `('invalid if dep $field holds URL credentials', ({ dep }) => {
      cachedExtract.configHash = 'hash';
      cachedExtract.packageFiles = {
        npm: [
          { packageFile: 'package.json', deps: [{ depName: 'foo', ...dep }] },
        ],
      };

      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(false);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract has URLs with credentials, so cannot be used',
      );
    });

    it('valid if URLs hold no credentials', () => {
      cachedExtract.configHash = 'hash';
      cachedExtract.packageFiles = {
        npm: [
          {
            packageFile: 'package.json',
            registryUrls: ['https://reg.example.com/npm'],
            deps: [
              {
                depName: 'foo',
                registryUrls: [
                  'https://oauth2accesstoken@region-docker.pkg.dev/p/',
                ],
                replaceString: 'foo https://reg.example.com/@scope',
              },
            ],
          },
        ],
      };

      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(true);
    });

    it('valid cache and config', () => {
      cachedExtract.configHash = 'hash';
      expect(isCacheExtractValid('sha', 'hash', cachedExtract)).toBe(true);

      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Cached extract for sha=sha is valid and can be used',
      );
      expect(logger.logger.debug).toHaveBeenCalledTimes(1);
    });
  });
});

import { dir as tmpDir } from 'tmp-promise';
import { Fixtures } from '~test/fixtures.ts';
import * as httpMock from '~test/http-mock.ts';
import { GlobalConfig } from '../../../config/global.ts';
import * as memCache from '../../../util/cache/memory/index.ts';
import * as packageCache from '../../../util/cache/package/index.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { parseUrl } from '../../../util/url.ts';
import { getPkgReleases } from '../index.ts';
import { AzurePipelinesTasksDatasource } from './index.ts';
import { AzurePipelinesFallbackTasks, AzurePipelinesTask } from './schema.ts';

const gitHubHost = 'https://raw.githubusercontent.com';
const builtinTasksPath =
  '/renovatebot/azure-devops-marketplace/main/azure-pipelines-builtin-tasks.json';
const marketplaceTasksPath =
  '/renovatebot/azure-devops-marketplace/main/azure-pipelines-marketplace-tasks.json';

describe('modules/datasource/azure-pipelines-tasks/index', () => {
  beforeEach(() => {
    GlobalConfig.reset();
    hostRules.clear();
  });

  it('returns null for unknown task', async () => {
    httpMock
      .scope(gitHubHost)
      .get(builtinTasksPath)
      .reply(200, {})
      .get(marketplaceTasksPath)
      .reply(200, {});
    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'unknown',
      }),
    ).resolves.toBeNull();
  });

  it('supports built-in tasks', async () => {
    httpMock
      .scope(gitHubHost)
      .get(builtinTasksPath)
      .reply(200, { automatedanalysis: ['0.171.0', '0.198.0'] });
    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AutomatedAnalysis',
      }),
    ).resolves.toEqual({
      releases: [{ version: '0.171.0' }, { version: '0.198.0' }],
    });
  });

  it('supports marketplace tasks', async () => {
    httpMock
      .scope(gitHubHost)
      .get(builtinTasksPath)
      .reply(200, {})
      .get(marketplaceTasksPath)
      .reply(200, { 'automatedanalysis-marketplace': ['0.171.0', '0.198.0'] });
    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AutomatedAnalysis-Marketplace',
      }),
    ).resolves.toEqual({
      releases: [{ version: '0.171.0' }, { version: '0.198.0' }],
    });
  });

  it('is case insensitive', async () => {
    httpMock
      .scope(gitHubHost)
      .get(builtinTasksPath)
      .reply(200, { automatedanalysis: ['0.171.0', '0.198.0'] });
    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'automatedanalysis',
      }),
    ).resolves.toEqual({
      releases: [{ version: '0.171.0' }, { version: '0.198.0' }],
    });
  });

  it('returns organization task with single version', async () => {
    GlobalConfig.set({
      platform: 'azure',
      endpoint: 'https://my.custom.domain',
    });

    hostRules.add({
      hostType: AzurePipelinesTasksDatasource.id,
      matchHost: 'my.custom.domain',
      token: '123test',
    });

    httpMock
      .scope('https://my.custom.domain')
      .get('/_apis/distributedtask/tasks/')
      .reply(200, Fixtures.get('tasks.json'));

    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AzurePowerShell',
      }),
    ).resolves.toEqual({
      releases: [
        {
          changelogContent:
            'Added support for Az Module and cross platform agents.',
          changelogUrl:
            'https://github.com/microsoft/azure-pipelines-tasks/releases',
          version: '5.248.3',
        },
      ],
    });
  });

  it('identifies task based on task id', async () => {
    GlobalConfig.set({
      platform: 'azure',
      endpoint: 'https://my.custom.domain',
    });
    hostRules.add({
      hostType: AzurePipelinesTasksDatasource.id,
      matchHost: 'my.custom.domain',
      token: '123test',
    });
    httpMock
      .scope('https://my.custom.domain')
      .get('/_apis/distributedtask/tasks/')
      .reply(200, Fixtures.get('tasks.json'));
    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: '5d437bf5-f193-4449-b531-c4c69eebaa48',
      }),
    ).resolves.toEqual({ releases: [{ version: '3.1.11' }] });
  });

  it('identifies task based on contributionIdentifier and id', async () => {
    GlobalConfig.set({
      platform: 'azure',
      endpoint: 'https://my.custom.domain',
    });
    hostRules.add({
      hostType: AzurePipelinesTasksDatasource.id,
      matchHost: 'my.custom.domain',
      token: '123test',
    });
    httpMock
      .scope('https://my.custom.domain')
      .get('/_apis/distributedtask/tasks/')
      .reply(200, Fixtures.get('tasks.json'));
    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName:
          'gittools.gittools.open-gitreleasemanager-task.5d437bf5-f193-4449-b531-c4c69eebaa48',
      }),
    ).resolves.toEqual({ releases: [{ version: '3.1.11' }] });
  });

  it('identifies task based on contributionIdentifier and name', async () => {
    GlobalConfig.set({
      platform: 'azure',
      endpoint: 'https://my.custom.domain',
    });
    hostRules.add({
      hostType: AzurePipelinesTasksDatasource.id,
      matchHost: 'my.custom.domain',
      token: '123test',
    });
    httpMock
      .scope('https://my.custom.domain')
      .get('/_apis/distributedtask/tasks/')
      .reply(200, Fixtures.get('tasks.json'));
    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName:
          'gittools.gittools.open-gitreleasemanager-task.gitreleasemanager/open',
      }),
    ).resolves.toEqual({ releases: [{ version: '3.1.11' }] });
  });

  it('returns organization task with multiple versions', async () => {
    GlobalConfig.set({
      platform: 'azure',
      endpoint: 'https://my.custom.domain',
    });

    hostRules.add({
      hostType: AzurePipelinesTasksDatasource.id,
      matchHost: 'my.custom.domain',
      token: '123test',
    });

    httpMock
      .scope('https://my.custom.domain')
      .get('/_apis/distributedtask/tasks/')
      .reply(200, Fixtures.get('tasks.json'));

    await expect(
      getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'PowerShell',
      }),
    ).resolves.toEqual({
      releases: [
        {
          changelogUrl:
            'https://github.com/microsoft/azure-pipelines-tasks/releases',
          isDeprecated: true,
          version: '1.2.3',
        },
        {
          changelogContent:
            'Script task consistency. Added support for macOS and Linux.',
          changelogUrl:
            'https://github.com/microsoft/azure-pipelines-tasks/releases',
          version: '2.247.1',
        },
      ],
    });
  });

  describe('package cache', () => {
    let dirResult: Awaited<ReturnType<typeof tmpDir>>;
    const datasource = new AzurePipelinesTasksDatasource();

    beforeEach(async () => {
      dirResult = await tmpDir({ unsafeCleanup: true });
      await packageCache.init({ cacheDir: dirResult.path });
      memCache.init();
    });

    afterEach(async () => {
      await packageCache.cleanup({});
      await dirResult.cleanup();
    });

    it.each([
      `${gitHubHost}${builtinTasksPath}`,
      `${gitHubHost}${marketplaceTasksPath}`,
    ])('reuses the public catalog cache for %s', async (url) => {
      const parsed = parseUrl(url)!;
      const catalog = { task: ['1.0.0'] };
      httpMock.scope(parsed.origin).get(parsed.pathname).reply(200, catalog);

      await expect(
        datasource.getTasks(url, {}, AzurePipelinesFallbackTasks),
      ).resolves.toEqual(catalog);
      memCache.init();
      await expect(
        datasource.getTasks(url, {}, AzurePipelinesFallbackTasks),
      ).resolves.toEqual(catalog);
    });

    it.each([
      'https://dev.azure.com/organization/_apis/distributedtask/tasks/',
      'https://organization.visualstudio.com/_apis/distributedtask/tasks/',
      'https://my.custom.domain/_apis/distributedtask/tasks/',
      `${gitHubHost}/other/private/main/tasks.json`,
    ])('bypasses existing cache entries and writes for %s', async (url) => {
      const key = `cache-decorator:${url}`;
      const namespace = 'datasource-azure-pipelines-tasks';
      await packageCache.set(
        namespace,
        key,
        {
          cachedAt: new Date().toISOString(),
          value: { task: ['0.0.0'] },
        },
        1440,
      );
      const parsed = parseUrl(url)!;
      httpMock
        .scope(parsed.origin)
        .get(parsed.pathname + parsed.search)
        .reply(200, { task: ['1.0.0'] })
        .get(parsed.pathname + parsed.search)
        .reply(200, { task: ['2.0.0'] });

      await expect(
        datasource.getTasks(url, {}, AzurePipelinesFallbackTasks),
      ).resolves.toEqual({ task: ['1.0.0'] });
      memCache.init();
      await expect(
        datasource.getTasks(url, {}, AzurePipelinesFallbackTasks),
      ).resolves.toEqual({ task: ['2.0.0'] });
      await expect(packageCache.get(namespace, key)).resolves.toEqual({
        cachedAt: expect.any(String),
        value: { task: ['0.0.0'] },
      });
    });
  });

  describe('compare semver', () => {
    it.each`
      a                              | exp
      ${[]}                          | ${[]}
      ${['']}                        | ${['']}
      ${['', '']}                    | ${['', '']}
      ${['1.0.0']}                   | ${['1.0.0']}
      ${['1.0.1', '1.1.0', '1.0.0']} | ${['1.0.0', '1.0.1', '1.1.0']}
    `('when versions is $a', ({ a, exp }) => {
      const azureVersions = a.map((x: string) => {
        const splitted = x.split('.');

        const version =
          splitted.length === 3
            ? {
                major: parseInt(splitted[0], 10),
                minor: parseInt(splitted[1], 10),
                patch: parseInt(splitted[2], 10),
              }
            : null;

        return AzurePipelinesTask.parse({
          id: '',
          name: '',
          deprecated: false,
          version,
        });
      });

      const azureSortedVersions = azureVersions.sort(
        AzurePipelinesTasksDatasource.compareSemanticVersions('version'),
      );

      expect(
        azureSortedVersions.map((x: any) => {
          const data = AzurePipelinesTask.parse(x);

          return data.version === null
            ? ''
            : `${data.version.major}.${data.version.minor}.${data.version.patch}`;
        }),
      ).toStrictEqual(exp);
    });
  });
});

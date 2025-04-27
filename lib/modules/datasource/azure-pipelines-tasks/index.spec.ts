import { getPkgReleases } from '..';
import { GlobalConfig } from '../../../config/global';
import * as hostRules from '../../../util/host-rules';
import { AzurePipelinesTask } from './schema';
import { AzurePipelinesTasksDatasource } from '.';
import { Fixtures } from '~test/fixtures';
import * as httpMock from '~test/http-mock';

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
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'unknown',
      }),
    ).toBeNull();
  });

  it('supports built-in tasks', async () => {
    httpMock
      .scope(gitHubHost)
      .get(builtinTasksPath)
      .reply(200, { automatedanalysis: ['0.171.0', '0.198.0'] });
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AutomatedAnalysis',
      }),
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
  });

  it('supports marketplace tasks', async () => {
    httpMock
      .scope(gitHubHost)
      .get(builtinTasksPath)
      .reply(200, {})
      .get(marketplaceTasksPath)
      .reply(200, { 'automatedanalysis-marketplace': ['0.171.0', '0.198.0'] });
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AutomatedAnalysis-Marketplace',
      }),
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
  });

  it('is case insensitive', async () => {
    httpMock
      .scope(gitHubHost)
      .get(builtinTasksPath)
      .reply(200, { automatedanalysis: ['0.171.0', '0.198.0'] });
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'automatedanalysis',
      }),
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
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

    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AzurePowerShell',
      }),
    ).toEqual({
      releases: [
        {
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
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: '5d437bf5-f193-4449-b531-c4c69eebaa48',
      }),
    ).toEqual({ releases: [{ version: '3.1.11' }] });
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
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName:
          'gittools.gittools.open-gitreleasemanager-task.5d437bf5-f193-4449-b531-c4c69eebaa48',
      }),
    ).toEqual({ releases: [{ version: '3.1.11' }] });
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
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName:
          'gittools.gittools.open-gitreleasemanager-task.gitreleasemanager/open',
      }),
    ).toEqual({ releases: [{ version: '3.1.11' }] });
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

    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'PowerShell',
      }),
    ).toEqual({
      releases: [
        {
          changelogUrl:
            'https://github.com/microsoft/azure-pipelines-tasks/releases',
          isDeprecated: true,
          version: '1.2.3',
        },
        {
          changelogUrl:
            'https://github.com/microsoft/azure-pipelines-tasks/releases',
          version: '2.247.1',
        },
      ],
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
                major: Number(splitted[0]),
                minor: Number(splitted[1]),
                patch: Number(splitted[2]),
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

import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { GlobalConfig } from '../../../config/global';
import { AzurePipelinesTasksDatasource } from '.';

const gitHubHost = 'https://raw.githubusercontent.com';
const builtinTasksPath =
  '/renovatebot/azure-devops-marketplace/main/azure-pipelines-builtin-tasks.json';
const marketplaceTasksPath =
  '/renovatebot/azure-devops-marketplace/main/azure-pipelines-marketplace-tasks.json';

describe('modules/datasource/azure-pipelines-tasks/index', () => {
  beforeEach(() => {
    GlobalConfig.reset();
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

    httpMock
      .scope('https://my.custom.domain')
      .get('/_apis/distributedtask/tasks/')
      .reply(200, Fixtures.get('tasks.json'));

    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AzurePowerShell',
      }),
    ).toEqual({ releases: [{ version: '5.248.3' }] });
  });

  it('returns organization task with multiple versions', async () => {
    GlobalConfig.set({
      platform: 'azure',
      endpoint: 'https://my.custom.domain',
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
        { isDeprecated: true, version: '1.2.3' },
        { isDeprecated: undefined, version: '2.247.1' },
      ],
    });
  });
});

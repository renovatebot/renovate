import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import { AzurePipelinesTasksDatasource } from '.';

const gitHubHost = 'https://raw.githubusercontent.com';
const builtinTasksPath =
  '/renovatebot/azure-devops-marketplace/main/azure-pipelines-builtin-tasks.json';
const marketplaceTasksPath =
  '/renovatebot/azure-devops-marketplace/main/azure-pipelines-marketplace-tasks.json';

describe('modules/datasource/azure-pipelines-tasks/index', () => {
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
});

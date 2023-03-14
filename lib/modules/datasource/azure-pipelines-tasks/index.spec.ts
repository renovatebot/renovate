import { getPkgReleases } from '..';
import { AzurePipelinesTasksDatasource } from '.';

describe('modules/datasource/azure-pipelines-tasks/index', () => {
  it('returns null for unknown task', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'unknown',
      })
    ).toBeNull();
  });

  it('supports built-in tasks', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AutomatedAnalysis',
      })
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
  });

  it('supports marketplace tasks', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'AutomatedAnalysis-Marketplace',
      })
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
  });

  it('is case insensitive', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        packageName: 'automatedanalysis',
      })
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
  });
});

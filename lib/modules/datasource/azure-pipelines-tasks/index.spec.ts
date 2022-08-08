import { getPkgReleases } from '..';
import { AzurePipelinesTasksDatasource } from '.';

describe('modules/datasource/azure-pipelines-tasks/index', () => {
  it('returns null for unknown task', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        depName: 'unknown',
      })
    ).toBeNull();
  });

  it('supports built-in tasks', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        depName: 'AutomatedAnalysis',
      })
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
  });

  it('is case insensitive', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        depName: 'automatedanalysis',
      })
    ).toEqual({ releases: [{ version: '0.171.0' }, { version: '0.198.0' }] });
  });
});

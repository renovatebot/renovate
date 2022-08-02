import { getPkgReleases } from '../index';
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

  it('returns single version', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        depName: 'Bash',
      })
    ).toEqual({ releases: [{ version: '3' }] });
  });

  it('returns multiple versions', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        depName: 'AzureFileCopy',
      })
    ).toEqual({
      releases: [
        { version: '1' },
        { version: '2' },
        { version: '3' },
        { version: '4' },
        { version: '5' },
      ],
    });
  });

  it('is case insensitive', async () => {
    expect(
      await getPkgReleases({
        datasource: AzurePipelinesTasksDatasource.id,
        depName: 'AzUrEfIlEcOpY',
      })
    ).toEqual({
      releases: [
        { version: '1' },
        { version: '2' },
        { version: '3' },
        { version: '4' },
        { version: '5' },
      ],
    });
  });
});

import { mocked } from '../../../../../test/util';
import * as _datasourceCommon from '../../../../modules/datasource/common';
import { Datasource } from '../../../../modules/datasource/datasource';
import type {
  GetReleasesConfig,
  Release,
  ReleaseResult,
} from '../../../../modules/datasource/types';
import { tryInterceptRelease } from './intercept-release';
import type { CandidateReleaseConfig } from './types';

jest.mock('../../../../modules/datasource/common');
const { getDatasourceFor } = mocked(_datasourceCommon);

class DummyDatasource extends Datasource {
  constructor() {
    super('some-datasource');
  }

  override getReleases(_: GetReleasesConfig): Promise<ReleaseResult | null> {
    return Promise.resolve(null);
  }
}

describe('workers/repository/process/lookup/intercept-release', () => {
  it('returns original release for empty datasource field', async () => {
    const releaseOrig: Release = { version: '1.2.3' };
    const release = await tryInterceptRelease({}, releaseOrig);
    expect(release).toBe(releaseOrig);
  });

  it('returns original release for missing datasource', async () => {
    const releaseOrig: Release = { version: '1.2.3' };
    getDatasourceFor.mockReturnValueOnce(null);

    const release = await tryInterceptRelease(
      { datasource: 'some-datasource' },
      releaseOrig,
    );

    expect(release).toBe(releaseOrig);
  });

  it('returns original release for datasource with missing `interceptRelease` method', async () => {
    const releaseOrig: Release = { version: '1.2.3' };
    getDatasourceFor.mockReturnValueOnce(new DummyDatasource());

    const release = await tryInterceptRelease(
      { datasource: 'some-datasource' },
      releaseOrig,
    );

    expect(release).toBe(releaseOrig);
  });

  it('updates release via `interceptRelease` method', async () => {
    const releaseOrig: Release = { version: '1.2.3' };

    class SomeDatasource extends DummyDatasource {
      interceptRelease(
        _config: CandidateReleaseConfig,
        release: Release,
      ): Promise<Release | null> {
        release.releaseTimestamp = '2024-09-05';
        return Promise.resolve(release);
      }
    }
    getDatasourceFor.mockReturnValueOnce(new SomeDatasource());

    const release = await tryInterceptRelease(
      { datasource: 'some-datasource' },
      releaseOrig,
    );

    expect(release).toEqual({
      version: '1.2.3',
      releaseTimestamp: '2024-09-05',
    });
  });

  it('rejects release via `interceptRelease` method', async () => {
    const releaseOrig: Release = { version: '1.2.3' };

    class SomeDatasource extends DummyDatasource {
      interceptRelease(
        _config: CandidateReleaseConfig,
        _release: Release,
      ): Promise<Release | null> {
        return Promise.resolve(null);
      }
    }
    getDatasourceFor.mockReturnValueOnce(new SomeDatasource());

    const release = await tryInterceptRelease(
      { datasource: 'some-datasource' },
      releaseOrig,
    );

    expect(release).toBeNull();
  });

  it('falls back when error was thrown', async () => {
    const releaseOrig: Release = { version: '1.2.3' };

    class SomeDatasource extends DummyDatasource {
      interceptRelease(
        _config: CandidateReleaseConfig,
        _release: Release,
      ): Promise<Release | null> {
        return Promise.reject(new Error('unknown error'));
      }
    }
    getDatasourceFor.mockReturnValueOnce(new SomeDatasource());

    const release = await tryInterceptRelease(
      { datasource: 'some-datasource' },
      releaseOrig,
    );

    expect(release).toBe(releaseOrig);
  });
});

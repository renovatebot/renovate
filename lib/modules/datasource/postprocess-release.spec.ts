import { mocked } from '../../../test/util';
import type { Timestamp } from '../../util/timestamp';
import * as _datasourceCommon from './common';
import { Datasource } from './datasource';
import { postprocessRelease } from './postprocess-release';
import type {
  GetReleasesConfig,
  PostprocessReleaseConfig,
  PostprocessReleaseResult,
  Release,
  ReleaseResult,
} from './types';

jest.mock('./common');
const { getDatasourceFor } = mocked(_datasourceCommon);

class DummyDatasource extends Datasource {
  constructor() {
    super('some-datasource');
  }

  override getReleases(_: GetReleasesConfig): Promise<ReleaseResult | null> {
    return Promise.resolve(null);
  }
}

describe('modules/datasource/postprocess-release', () => {
  it('returns original release for empty datasource field', async () => {
    const releaseOrig: Release = { version: '1.2.3' };
    const release = await postprocessRelease(
      { packageName: 'some-package' },
      releaseOrig,
    );
    expect(release).toBe(releaseOrig);
  });

  it('returns original release for missing datasource', async () => {
    const releaseOrig: Release = { version: '1.2.3' };
    getDatasourceFor.mockReturnValueOnce(null);

    const release = await postprocessRelease(
      { datasource: 'some-datasource', packageName: 'some-package' },
      releaseOrig,
    );

    expect(release).toBe(releaseOrig);
  });

  it('returns original release for datasource with missing `postprocessRelease` method', async () => {
    const releaseOrig: Release = { version: '1.2.3' };
    getDatasourceFor.mockReturnValueOnce(new DummyDatasource());

    const release = await postprocessRelease(
      { datasource: 'some-datasource', packageName: 'some-package' },
      releaseOrig,
    );

    expect(release).toBe(releaseOrig);
  });

  it('returns original release for datasource with missing `packageName` field', async () => {
    class SomeDatasource extends DummyDatasource {
      override postprocessRelease(
        _config: PostprocessReleaseConfig,
        release: Release,
      ): Promise<PostprocessReleaseResult> {
        return Promise.resolve(release);
      }
    }

    const releaseOrig: Release = { version: '1.2.3' };
    getDatasourceFor.mockReturnValueOnce(new SomeDatasource());

    const release = await postprocessRelease(
      { datasource: 'some-datasource' },
      releaseOrig,
    );

    expect(release).toBe(releaseOrig);
  });

  it('updates release via `postprocessRelease` method', async () => {
    const releaseOrig: Release = { version: '1.2.3' };

    class SomeDatasource extends DummyDatasource {
      override postprocessRelease(
        _config: PostprocessReleaseConfig,
        release: Release,
      ): Promise<PostprocessReleaseResult> {
        release.releaseTimestamp = '2024-09-05' as Timestamp;
        return Promise.resolve(release);
      }
    }
    getDatasourceFor.mockReturnValueOnce(new SomeDatasource());

    const release = await postprocessRelease(
      { datasource: 'some-datasource', packageName: 'some-package' },
      releaseOrig,
    );

    expect(release).toEqual({
      version: '1.2.3',
      releaseTimestamp: '2024-09-05',
    });
  });

  it('rejects release via `postprocessRelease` method', async () => {
    const releaseOrig: Release = { version: '1.2.3' };

    class SomeDatasource extends DummyDatasource {
      override postprocessRelease(
        _config: PostprocessReleaseConfig,
        _release: Release,
      ): Promise<PostprocessReleaseResult> {
        return Promise.resolve('reject');
      }
    }
    getDatasourceFor.mockReturnValueOnce(new SomeDatasource());

    const release = await postprocessRelease(
      { datasource: 'some-datasource', packageName: 'some-package' },
      releaseOrig,
    );

    expect(release).toBeNull();
  });

  it('falls back when error was thrown', async () => {
    const releaseOrig: Release = { version: '1.2.3' };

    class SomeDatasource extends DummyDatasource {
      override postprocessRelease(
        _config: PostprocessReleaseConfig,
        _release: Release,
      ): Promise<PostprocessReleaseResult> {
        return Promise.reject(new Error('unknown error'));
      }
    }
    getDatasourceFor.mockReturnValueOnce(new SomeDatasource());

    const release = await postprocessRelease(
      { datasource: 'some-datasource', packageName: 'some-package' },
      releaseOrig,
    );

    expect(release).toBe(releaseOrig);
  });
});

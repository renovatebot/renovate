import * as httpMock from '~test/http-mock.ts';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages.ts';
import { getPkgReleases } from '../index.ts';
import { JuliaGeneralMetadataDatasource } from './index.ts';

const baseUrl = 'https://juliaregistries.github.io/GeneralMetadata.jl/api';
const datasource = JuliaGeneralMetadataDatasource.id;

describe('modules/datasource/julia-general-metadata/index', () => {
  describe('getReleases', () => {
    it('returns null for empty body', async () => {
      httpMock.scope(baseUrl).get('/Example/versions.json').reply(200, {});
      expect(
        await getPkgReleases({ datasource, packageName: 'Example' }),
      ).toBeNull();
    });

    it('returns null for malformed body', async () => {
      httpMock
        .scope(baseUrl)
        .get('/Example/versions.json')
        .reply(200, { '0.1.0': 'not-an-object' });
      expect(
        await getPkgReleases({ datasource, packageName: 'Example' }),
      ).toBeNull();
    });

    it('returns null for 404', async () => {
      httpMock.scope(baseUrl).get('/Example/versions.json').reply(404);
      expect(
        await getPkgReleases({ datasource, packageName: 'Example' }),
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(baseUrl).get('/Example/versions.json').reply(502);
      await expect(
        getPkgReleases({ datasource, packageName: 'Example' }),
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for unknown error', async () => {
      httpMock
        .scope(baseUrl)
        .get('/Example/versions.json')
        .replyWithError('some error');
      expect(
        await getPkgReleases({ datasource, packageName: 'Example' }),
      ).toBeNull();
    });

    it('returns releases with timestamps and yanked flag', async () => {
      httpMock
        .scope(baseUrl)
        .get('/Example/versions.json')
        .reply(200, {
          '0.5.0': {
            registered: '2018-08-09T10:04:18',
            has_artifacts: false,
          },
          '0.5.1': {
            registered: '2018-08-09T10:04:18',
            has_artifacts: false,
          },
          '0.5.3': {
            registered: '2019-07-17T05:33:46',
            yanked: true,
            has_artifacts: false,
          },
        });
      const res = await getPkgReleases({ datasource, packageName: 'Example' });
      expect(res).toEqual({
        registryUrl: 'https://juliaregistries.github.io/GeneralMetadata.jl/',
        releases: [
          {
            version: '0.5.0',
            releaseTimestamp: '2018-08-09T10:04:18.000Z',
          },
          {
            version: '0.5.1',
            releaseTimestamp: '2018-08-09T10:04:18.000Z',
          },
          {
            version: '0.5.3',
            releaseTimestamp: '2019-07-17T05:33:46.000Z',
            isDeprecated: true,
          },
        ],
      });
    });

    it('omits releaseTimestamp when registered cannot be parsed', async () => {
      httpMock
        .scope(baseUrl)
        .get('/Example/versions.json')
        .reply(200, {
          '1.0.0': { registered: 'not-a-real-date', has_artifacts: false },
        });
      const res = await getPkgReleases({ datasource, packageName: 'Example' });
      expect(res?.releases).toEqual([{ version: '1.0.0' }]);
    });
  });
});

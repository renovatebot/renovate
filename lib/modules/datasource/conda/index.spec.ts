import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { EXTERNAL_HOST_ERROR } from '../../../constants/error-messages';
import { datasource, defaultRegistryUrl } from './common';
import { CondaDatasource } from './index';

const depName = 'main/pytest';
const depUrl = `/${depName}`;

describe('modules/datasource/conda/index', () => {
  describe('getReleases', () => {
    it('throws for error', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).replyWithError('error');
      await expect(
        getPkgReleases({
          datasource,
          depName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('returns null for 404', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(404);
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
      ).toBeNull();
    });

    it('returns null for empty result', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(200, {});
      expect(
        await getPkgReleases({
          datasource,
          depName,
        })
      ).toBeNull();
    });

    it('throws for 5xx', async () => {
      httpMock.scope(defaultRegistryUrl).get(depUrl).reply(502);
      await expect(
        getPkgReleases({
          datasource,
          depName,
        })
      ).rejects.toThrow(EXTERNAL_HOST_ERROR);
    });

    it('processes real data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get(depUrl)
        .reply(200, Fixtures.get('pytest.json'));
      const res = await getPkgReleases({
        datasource,
        depName,
      });
      expect(res).toMatchSnapshot();
      expect(res?.releases).toHaveLength(94);
    });

    it('returns null without registryUrl', async () => {
      const condaDatasource = new CondaDatasource();
      const res = await condaDatasource.getReleases({
        registryUrl: '',
        packageName: depName,
      });
      expect(res).toBeNull();
    });

    it('supports multiple custom datasource urls', async () => {
      const depName = 'pytest';
      httpMock
        .scope('https://api.anaconda.org/package/rapids')
        .get(`/${depName}`)
        .reply(404);
      httpMock
        .scope('https://api.anaconda.org/package/conda-forge')
        .get(`/${depName}`)
        .reply(200, {
          html_url: 'http://anaconda.org/anaconda/pytest',
          dev_url: 'https://github.com/pytest-dev/pytest/',
          versions: ['2.7.0', '2.5.1', '2.6.0'],
        });
      const config = {
        registryUrls: [
          'https://api.anaconda.org/package/rapids',
          'https://api.anaconda.org/package/conda-forge',
          'https://api.anaconda.org/package/nvidia',
        ],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        depName,
      });
      expect(res).toMatchObject({
        homepage: 'http://anaconda.org/anaconda/pytest',
        registryUrl: 'https://api.anaconda.org/package/conda-forge',
        releases: [
          { version: '2.5.1' },
          { version: '2.6.0' },
          { version: '2.7.0' },
        ],
        sourceUrl: 'https://github.com/pytest-dev/pytest',
      });
    });
  });
});

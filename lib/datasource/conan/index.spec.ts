import { getDigest, getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadJsonFixture } from '../../../test/util';
import * as loose from '../../versioning/loose';
import { id as versioning } from '../../versioning/loose';
import { defaultRegistryUrl } from './common';
import { ConanDatasource } from '.';

const pocoJson: any = loadJsonFixture('poco');
const pocoDigestJson: any = loadJsonFixture('pocoDigest');
const malformedJson: any = loadJsonFixture('malformed');
const fakeJson: any = loadJsonFixture('fake');
const datasource = ConanDatasource.id;

describe('datasource/conan/index', () => {
  describe('getDigest', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('handles bad return', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage/fakeversion')
        .reply(200, null);
      expect(
        await getDigest(
          {
            datasource,
            lookupName: 'fakepackage',
            registryUrl: defaultRegistryUrl,
            currentDigest: '@conan/stable',
          },
          'fakeversion'
        )
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles matched packages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=poco/1.9.3')
        .reply(200, pocoDigestJson);
      expect(
        await getDigest(
          {
            datasource,
            lookupName: 'poco',
            registryUrl: defaultRegistryUrl,
            currentDigest: '@conan/test',
          },
          '1.9.3'
        )
      ).toMatchSnapshot();
    });

    it('handles unmatched packages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=poco/1.9.3')
        .reply(200, pocoDigestJson);
      expect(
        await getDigest(
          {
            datasource,
            lookupName: 'poco',
            registryUrl: defaultRegistryUrl,
            currentDigest: '@bincrafters/stable',
          },
          '1.9.3'
        )
      ).toMatchSnapshot();
    });

    it('handles malformed packages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=bad/fakeversion')
        .reply(200, malformedJson);
      expect(
        await getDigest(
          {
            datasource,
            lookupName: 'bad',
            registryUrl: defaultRegistryUrl,
            currentDigest: '@conan/stable',
          },
          'fakeversion'
        )
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });

  describe('getReleases', () => {
    let config: any;
    beforeEach(() => {
      jest.resetAllMocks();
      config = {
        versioning: loose.id,
        registryUrls: [defaultRegistryUrl],
      };
    });

    it('handles bad return', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, null);
      config.registryUrls = [defaultRegistryUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'fakepackage',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles bad registries', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .reply(404);
      config.registryUrls = ['https://fake.bintray.com/'];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'poco',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles missing packages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, fakeJson);
      config.registryUrls = [defaultRegistryUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'fakepackage',
        })
      ).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('processes real versioned data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      config.registryUrls = [defaultRegistryUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'poco',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles malformed packages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=bad')
        .reply(200, malformedJson);
      config.registryUrls = [defaultRegistryUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'bad',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles non 404 errors', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .replyWithError('error');
      config.registryUrls = ['https://fake.bintray.com/'];

      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'poco',
        })
      ).toMatchSnapshot();

      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles missing slash on registries', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .reply(200, fakeJson);
      config.registryUrls = ['https://fake.bintray.com'];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'poco',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

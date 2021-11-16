import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadJsonFixture } from '../../../test/util';
import * as loose from '../../versioning/loose';
import { id as versioning } from '../../versioning/loose';
import { defaultRegistryUrl } from './common';
import { ConanDatasource } from '.';

const pocoJson: any = loadJsonFixture('poco.json');
const malformedJson: any = loadJsonFixture('malformed.json');
const fakeJson: any = loadJsonFixture('fake.json');
const datasource = ConanDatasource.id;

const config = {
  versioning: loose.id,
  registryUrls: [defaultRegistryUrl],
};

describe('datasource/conan/index', () => {
  describe('getReleases', () => {
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
          lookupName: 'fakepackage/1.2@_/_',
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
          lookupName: 'poco/1.2@_/_',
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
          lookupName: 'fakepackage/1.2@_/_',
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
          lookupName: 'poco/1.2@_/_',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('it handles mismatched userAndChannel versioned data', async () => {
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
          lookupName: 'poco/1.2@un/matched',
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
          lookupName: 'bad/1.2@_/_',
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
          lookupName: 'poco/1.2@_/_',
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
          lookupName: 'poco/1.2@_/_',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

import { getPkgReleases } from '..';
import { Fixtures } from '../../../test/fixtures';
import * as httpMock from '../../../test/http-mock';
import * as conan from '../../versioning/conan';
import type { GetPkgReleasesConfig } from '../types';
import { defaultRegistryUrl } from './common';
import { ConanDatasource } from '.';

const pocoJson = Fixtures.get('poco.json');
const malformedJson = Fixtures.get('malformed.json');
const fakeJson = Fixtures.get('fake.json');
const datasource = ConanDatasource.id;

const config: GetPkgReleasesConfig = {
  depName: '',
  datasource,
  versioning: conan.id,
  registryUrls: [defaultRegistryUrl],
};

describe('datasource/conan/index', () => {
  beforeEach(() => {
    config.registryUrls = [defaultRegistryUrl];
  });

  describe('getReleases', () => {
    it('handles bad return', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, null);
      config.depName = 'fakepackage';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'fakepackage/1.2@_/_',
        })
      ).toBeNull();
    });

    it('handles empty return', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, {});
      config.depName = 'fakepackage';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'fakepackage/1.2@_/_',
        })
      ).toBeNull();
    });

    it('handles bad registries', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .reply(404);
      config.registryUrls = ['https://fake.bintray.com/'];
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'poco/1.2@_/_',
        })
      ).toBeNull();
    });

    it('handles missing packages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, fakeJson);
      config.depName = 'fakepackage';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'fakepackage/1.2@_/_',
        })
      ).toBeNull();
    });

    it('processes real versioned data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'poco/1.2@_/_',
        })
      ).toEqual({
        registryUrl: 'https://center.conan.io',
        releases: [
          {
            version: '1.8.1',
          },
          {
            version: '1.9.3',
          },
          {
            version: '1.9.4',
          },
          {
            version: '1.10.0',
          },
          {
            version: '1.10.1',
          },
        ],
      });
    });

    it('it handles mismatched userAndChannel versioned data', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'poco/1.2@un/matched',
        })
      ).toBeNull();
    });

    it('handles malformed packages', async () => {
      httpMock
        .scope(defaultRegistryUrl)
        .get('/v2/conans/search?q=bad')
        .reply(200, malformedJson);
      config.depName = 'bad';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'bad/1.2@_/_',
        })
      ).toEqual({
        registryUrl: 'https://center.conan.io',
        releases: [
          {
            version: '1.9.3',
          },
        ],
      });
    });

    it('handles non 404 errors', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .replyWithError('error');
      config.registryUrls = ['https://fake.bintray.com/'];
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'poco/1.2@_/_',
        })
      ).toBeNull();
    });

    it('handles missing slash on registries', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .reply(200, fakeJson);
      config.registryUrls = ['https://fake.bintray.com'];
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          lookupName: 'poco/1.2@_/_',
        })
      ).toBeNull();
    });
  });
});

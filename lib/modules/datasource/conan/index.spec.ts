import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as conan from '../../versioning/conan';
import type { GetPkgReleasesConfig } from '../types';
import { defaultRegistryUrl } from './common';
import { ConanDatasource } from '.';

const pocoJson = Fixtures.get('poco.json');
const pocoRevisions = Fixtures.getJson('poco_revisions.json');
const malformedPocoRevisions = Fixtures.getJson(
  'poco_revisions_malformed.json'
);
const pocoYamlGitHubContent = Fixtures.get('poco.yaml');
const malformedJson = Fixtures.get('malformed.json');
const fakeJson = Fixtures.get('fake.json');
const datasource = ConanDatasource.id;

const nonDefaultRegistryUrl = 'https://not.conan.io/';

const config: GetPkgReleasesConfig = {
  depName: '',
  datasource,
  versioning: conan.id,
  registryUrls: [nonDefaultRegistryUrl],
};

describe('modules/datasource/conan/index', () => {
  beforeEach(() => {
    config.registryUrls = [nonDefaultRegistryUrl];
  });

  describe('getReleases', () => {
    it('handles bad return', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200);
      config.depName = 'fakepackage';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'fakepackage/1.2@_/_',
        })
      ).toBeNull();
    });

    it('handles empty return', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, {});
      config.depName = 'fakepackage';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'fakepackage/1.2@_/_',
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
          packageName: 'poco/1.2@_/_',
        })
      ).toBeNull();
    });

    it('handles missing packages', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, fakeJson);
      config.depName = 'fakepackage';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'fakepackage/1.2@_/_',
        })
      ).toBeNull();
    });

    it('processes real versioned data', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@_/_',
        })
      ).toEqual({
        registryUrl: 'https://not.conan.io',
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

    it('processes real versioned data real data with revisions', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      for (const version of ['1.8.1', '1.9.3', '1.9.4', '1.10.0', '1.10.1']) {
        httpMock
          .scope(nonDefaultRegistryUrl)
          .get(`/v2/conans/poco/${version}/_/_/revisions`)
          .reply(200, pocoRevisions[version]);
      }
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@_/_#4fc13d60fd91ba44fefe808ad719a5af',
        })
      ).toEqual({
        registryUrl: 'https://not.conan.io',
        releases: [
          {
            version: '1.8.1',
            newDigest: '3a9b47caee2e2c1d3fb7d97788339aa8',
          },
          {
            version: '1.9.3',
            newDigest: 'dc80dcf02da270cc5f629c00df151a56',
          },
          {
            version: '1.9.4',
            newDigest: '736fdb96cd0add0cf85ca420e0bac453',
          },
          {
            version: '1.10.0',
            newDigest: '7c3fbb12b69d7e7fd7134ba1efb04d5e',
          },
          {
            version: '1.10.1',
            newDigest: '32815db5b18046e4f8879af7bb743422',
          },
        ],
      });
    });

    it('processes maformed revisions', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      for (const version of ['1.8.1', '1.9.3', '1.9.4', '1.10.0', '1.10.1']) {
        httpMock
          .scope(nonDefaultRegistryUrl)
          .get(`/v2/conans/poco/${version}/_/_/revisions`)
          .reply(200, malformedPocoRevisions[version]);
      }
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@_/_#4fc13d60fd91ba44fefe808ad719a5af',
        })
      ).toEqual({
        registryUrl: 'https://not.conan.io',
        releases: [
          {
            version: '1.8.1',
            newDigest: '3a9b47caee2e2c1d3fb7d97788339aa8',
          },
          {
            version: '1.9.3',
            newDigest: 'dc80dcf02da270cc5f629c00df151a56',
          },
          {
            version: '1.9.4',
            newDigest: '736fdb96cd0add0cf85ca420e0bac453',
          },
          {
            version: '1.10.0',
            newDigest: '7c3fbb12b69d7e7fd7134ba1efb04d5e',
          },
          {
            version: '1.10.1',
          },
        ],
      });
    });

    it('uses github instead of conan center', async () => {
      httpMock
        .scope('https://api.github.com')
        .get(
          '/repos/conan-io/conan-center-index/contents/recipes/poco/config.yml'
        )
        .reply(200, pocoYamlGitHubContent);
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: [defaultRegistryUrl],
          depName: 'poco',
          packageName: 'poco/1.2@_/_',
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
          {
            version: '1.11.0',
          },
          {
            version: '1.11.1',
          },
        ],
      });
    });

    it('rejects userAndChannel for Conan Center', async () => {
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: [defaultRegistryUrl],
          depName: 'poco',
          packageName: 'poco/1.2@foo/bar',
        })
      ).toBeNull();
    });

    it('it handles mismatched userAndChannel versioned data', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      config.depName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@un/matched',
        })
      ).toBeNull();
    });

    it('handles malformed packages', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=bad')
        .reply(200, malformedJson);
      config.depName = 'bad';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'bad/1.2@_/_',
        })
      ).toEqual({
        registryUrl: 'https://not.conan.io',
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
          packageName: 'poco/1.2@_/_',
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
          packageName: 'poco/1.2@_/_',
        })
      ).toBeNull();
    });
  });
});

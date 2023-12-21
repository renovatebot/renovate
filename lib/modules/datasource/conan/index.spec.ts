import { getDigest, getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as conan from '../../versioning/conan';
import type { GetDigestInputConfig, GetPkgReleasesConfig } from '../types';
import { defaultRegistryUrl } from './common';
import { ConanDatasource } from '.';

const mixedCaseJson = Fixtures.get('mixed_case.json');
const pocoJson = Fixtures.get('poco.json');
const pocoRevisions = Fixtures.getJson('poco_revisions.json');
const pocoYamlGitHubContent = Fixtures.get('poco.yaml');
const malformedJson = Fixtures.get('malformed.json');
const fakeJson = Fixtures.get('fake.json');
const datasource = ConanDatasource.id;

const nonDefaultRegistryUrl = 'https://not.conan.io/';

const config: GetPkgReleasesConfig = {
  packageName: '',
  datasource,
  versioning: conan.id,
  registryUrls: [nonDefaultRegistryUrl],
};

const digestConfig: GetDigestInputConfig = {
  packageName: 'fake',
  datasource,
  registryUrls: [nonDefaultRegistryUrl],
};

describe('modules/datasource/conan/index', () => {
  beforeEach(() => {
    config.registryUrls = [nonDefaultRegistryUrl];
  });

  describe('getDigest', () => {
    it('handles package without digest', async () => {
      digestConfig.packageName = 'fakepackage/1.2@_/_';
      expect(await getDigest(digestConfig)).toBeNull();
    });

    it('handles digest', async () => {
      const version = '1.8.1';
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get(`/v2/conans/poco/${version}/_/_/revisions`)
        .reply(200, pocoRevisions[version]);
      digestConfig.packageName = `poco/${version}@_/_`;
      digestConfig.currentDigest = '4fc13d60fd91ba44fefe808ad719a5af';
      expect(await getDigest(digestConfig, version)).toBe(
        '3a9b47caee2e2c1d3fb7d97788339aa8',
      );
    });

    it('returns null for missing revision', async () => {
      const version = '1.8.1';
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get(`/v2/conans/poco/${version}/_/_/revisions`)
        .reply(200, []);
      digestConfig.packageName = `poco/${version}@_/_`;
      digestConfig.currentDigest = '4fc13d60fd91ba44fefe808ad719a5af';
      expect(await getDigest(digestConfig, version)).toBeNull();
    });
  });

  describe('getReleases', () => {
    it('handles bad return', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200);
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'fakepackage/1.2@_/_',
        }),
      ).toBeNull();
    });

    it('handles empty return', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, {});
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'fakepackage/1.2@_/_',
        }),
      ).toBeNull();
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
          packageName: 'poco/1.2@_/_',
        }),
      ).toBeNull();
    });

    it('handles missing packages', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, fakeJson);
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'fakepackage/1.2@_/_',
        }),
      ).toBeNull();
    });

    it('processes real versioned data', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@_/_',
        }),
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

    it('processes mixed case names', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=FooBar')
        .reply(200, mixedCaseJson);
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'FooBar/1.0.0@_/_',
        }),
      ).toEqual({
        registryUrl: 'https://not.conan.io',
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '1.1.0',
          },
          {
            version: '2.2.0',
          },
        ],
      });
    });

    it('uses github instead of conan center', async () => {
      httpMock
        .scope('https://api.github.com')
        .get(
          '/repos/conan-io/conan-center-index/contents/recipes/poco/config.yml',
        )
        .reply(200, pocoYamlGitHubContent);
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: [defaultRegistryUrl],
          packageName: 'poco/1.2@_/_',
        }),
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

    it('works with empty releases', async () => {
      httpMock
        .scope('https://api.github.com')
        .get(
          '/repos/conan-io/conan-center-index/contents/recipes/poco/config.yml',
        )
        .reply(200, '');
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: [defaultRegistryUrl],
          packageName: 'poco/1.2@_/_',
        }),
      ).toBeNull();
    });

    it('rejects userAndChannel for Conan Center', async () => {
      expect(
        await getPkgReleases({
          ...config,
          registryUrls: [defaultRegistryUrl],
          packageName: 'poco/1.2@foo/bar',
        }),
      ).toBeNull();
    });

    it('it handles mismatched userAndChannel versioned data', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      config.packageName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@un/matched',
        }),
      ).toBeNull();
    });

    it('handles malformed packages', async () => {
      httpMock
        .scope(nonDefaultRegistryUrl)
        .get('/v2/conans/search?q=bad')
        .reply(200, malformedJson);
      config.packageName = 'bad';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'bad/1.2@_/_',
        }),
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
      config.packageName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@_/_',
        }),
      ).toBeNull();
    });

    it('handles missing slash on registries', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .reply(200, fakeJson);
      config.registryUrls = ['https://fake.bintray.com'];
      config.packageName = 'poco';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'poco/1.2@_/_',
        }),
      ).toBeNull();
    });

    it('artifactory sourceurl', async () => {
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo/')
        .get('/v2/conans/search?q=arti')
        .reply(
          200,
          { results: ['arti/1.0.0@_/_', 'arti/1.1.1@_/_'] },
          {
            'x-jfrog-version': 'latest',
          },
        );
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo/')
        .get('/v2/conans/arti/1.1.1/_/_/latest')
        .reply(200, {
          revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          time: '2032-06-23T00:00:00.000+0000',
        });
      httpMock
        .scope(
          'https://fake.artifactory.com/artifactory/api/storage/test-repo/',
        )
        .get(
          '/_/arti/1.1.1/_/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/export/conanfile.py?properties=conan.package.url',
        )
        .reply(200, {
          properties: {
            'conan.package.url': 'https://fake.conan.url.com',
          },
        });

      config.registryUrls = [
        'https://fake.artifactory.com/artifactory/api/conan/test-repo',
      ];
      config.packageName = 'arti';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'arti/1.1@_/_',
        }),
      ).toEqual({
        registryUrl:
          'https://fake.artifactory.com/artifactory/api/conan/test-repo',
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '1.1.1',
          },
        ],
      });
    });

    it('artifactory header without api', async () => {
      httpMock
        .scope('https://fake.artifactory.com')
        .get('/v2/conans/search?q=arti')
        .reply(
          200,
          { results: ['arti/1.0.0@_/_', 'arti/1.1.1@_/_'] },
          {
            'x-jfrog-version': 'latest',
          },
        );
      config.registryUrls = ['https://fake.artifactory.com'];
      config.packageName = 'arti';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'arti/1.1@_/_',
        }),
      ).toEqual({
        registryUrl: 'https://fake.artifactory.com',
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '1.1.1',
          },
        ],
      });
    });

    it('artifactory invalid version', async () => {
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo')
        .get('/v2/conans/search?q=arti')
        .reply(
          200,
          {
            results: ['arti/invalid_version@_/_'],
          },
          { 'x-jfrog-version': 'latest' },
        );
      config.registryUrls = [
        'https://fake.artifactory.com/artifactory/api/conan/test-repo',
      ];
      config.packageName = 'arti';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'arti/1.1@_/_',
        }),
      ).toEqual({
        registryUrl:
          'https://fake.artifactory.com/artifactory/api/conan/test-repo',
        releases: [],
      });
    });

    it('non artifactory header', async () => {
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo')
        .get('/v2/conans/search?q=arti')
        .reply(200, {}, { 'x-jfrog-invalid-header': 'latest' });
      config.registryUrls = [
        'https://fake.artifactory.com/artifactory/api/conan/test-repo',
      ];
      config.packageName = 'arti';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'arti/1.1@_/_',
        }),
      ).toBeNull();
    });

    it('artifactory no package url', async () => {
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo/')
        .get('/v2/conans/search?q=arti')
        .reply(
          200,
          { results: ['arti/1.0.0@_/_', 'arti/1.1.1@_/_'] },
          {
            'x-jfrog-version': 'latest',
          },
        );
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo/')
        .get('/v2/conans/arti/1.1.1/_/_/latest')
        .reply(200, {
          revision: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          time: '2032-06-23T00:00:00.000+0000',
        });
      httpMock
        .scope(
          'https://fake.artifactory.com/artifactory/api/storage/test-repo/',
        )
        .get(
          '/_/arti/1.1.1/_/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/export/conanfile.py?properties=conan.package.url',
        )
        .reply(200);

      config.registryUrls = [
        'https://fake.artifactory.com/artifactory/api/conan/test-repo',
      ];
      config.packageName = 'arti';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'arti/1.1@_/_',
        }),
      ).toEqual({
        registryUrl:
          'https://fake.artifactory.com/artifactory/api/conan/test-repo',
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '1.1.1',
          },
        ],
      });
    });

    it('artifactory http error', async () => {
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo/')
        .get('/v2/conans/search?q=arti')
        .reply(
          200,
          { results: ['arti/1.0.0@_/_', 'arti/1.1.1@_/_'] },
          {
            'x-jfrog-version': 'latest',
          },
        );
      httpMock
        .scope('https://fake.artifactory.com/artifactory/api/conan/test-repo/')
        .get('/v2/conans/arti/1.1.1/_/_/latest')
        .reply(404);

      config.registryUrls = [
        'https://fake.artifactory.com/artifactory/api/conan/test-repo',
      ];
      config.packageName = 'arti';
      expect(
        await getPkgReleases({
          ...config,
          packageName: 'arti/1.1@_/_',
        }),
      ).toEqual({
        registryUrl:
          'https://fake.artifactory.com/artifactory/api/conan/test-repo',
        releases: [
          {
            version: '1.0.0',
          },
          {
            version: '1.1.1',
          },
        ],
      });
    });
  });
});

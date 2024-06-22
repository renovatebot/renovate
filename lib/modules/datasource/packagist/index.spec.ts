import { mockDeep } from 'jest-mock-extended';
import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import type { HostRule } from '../../../types';
import * as _hostRules from '../../../util/host-rules';
import * as composerVersioning from '../../versioning/composer';
import { id as versioning } from '../../versioning/loose';
import { PackagistDatasource } from '.';

jest.mock('../../../util/host-rules', () => mockDeep());

const hostRules = _hostRules;

const includesJson = Fixtures.getJson('includes.json');
const beytJson = Fixtures.getJson('1beyt.json');
const mailchimpJson = Fixtures.getJson('mailchimp-api.json');
const mailchimpDevJson = Fixtures.getJson('mailchimp-api~dev.json');

const baseUrl = 'https://packagist.org';
const datasource = PackagistDatasource.id;

describe('modules/datasource/packagist/index', () => {
  describe('getReleases', () => {
    let config: any;

    beforeEach(() => {
      hostRules.find = jest.fn((input: HostRule) => input);
      hostRules.hosts = jest.fn(() => []);
      config = {
        versioning: composerVersioning.id,
        registryUrls: [
          'https://composer.renovatebot.com',
          'https://packagist.org',
        ],
      };
    });

    it('supports custom registries', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(404);
      config = {
        registryUrls: ['https://composer.renovatebot.com'],
      };
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'something/one',
      });
      expect(res).toBeNull();
    });

    it('supports plain packages', async () => {
      const packagesOnly = {
        packages: {
          'vendor/package-name': {
            'dev-master': { version: 'dev-master' },
            '1.0.x-dev': { version: '1.0.x-dev' },
            '0.0.1': { version: '0.0.1' },
            '1.0.0': { version: '1.0.0' },
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesOnly);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'vendor/package-name',
      });
      expect(res).toMatchSnapshot();
    });

    it('handles timeouts', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .replyWithError({ code: 'ETIMEDOUT' });
      httpMock
        .scope(baseUrl)
        .get('/packages.json')
        .reply(200, { 'metadata-url': '/p2/%package%.json' })
        .get('/p2/vendor/package-name2.json')
        .reply(200)
        .get('/p2/vendor/package-name2~dev.json')
        .reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'vendor/package-name2',
      });
      expect(res).toBeNull();
    });

    it('handles auth rejections', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(403);
      httpMock
        .scope(baseUrl)
        .get('/packages.json')
        .reply(200, { 'metadata-url': '/p2/%package%.json' })
        .get('/p2/vendor/package-name.json')
        .reply(200)
        .get('/p2/vendor/package-name~dev.json')
        .reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'vendor/package-name',
      });
      expect(res).toBeNull();
    });

    it('handles not found registries', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(404);
      httpMock
        .scope(baseUrl)
        .get('/packages.json')
        .reply(200, { 'metadata-url': '/p2/%package%.json' })
        .get('/p2/drewm/mailchimp-api.json')
        .reply(200)
        .get('/p2/drewm/mailchimp-api~dev.json')
        .reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'drewm/mailchimp-api',
      });
      expect(res).toBeNull();
    });

    it('supports includes packages', async () => {
      hostRules.find = jest.fn(() => ({
        username: 'some-username',
        password: 'some-password',
      }));
      const packagesJson = {
        packages: [],
        includes: {
          'include/all$093530b127abe74defbf21affc9589bf713e4e08f898bf11986842f9956eda86.json':
            {
              sha256:
                '093530b127abe74defbf21affc9589bf713e4e08f898bf11986842f9956eda86',
            },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson)
        .get(
          '/include/all$093530b127abe74defbf21affc9589bf713e4e08f898bf11986842f9956eda86.json',
        )
        .reply(200, includesJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'guzzlehttp/guzzle',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('supports older sha1 hashes', async () => {
      hostRules.find = jest.fn(() => ({
        username: 'some-username',
        password: 'some-password',
      }));
      const packagesJson = {
        packages: [],
        includes: {
          'include/all$afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b.json': {
            sha1: 'afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b',
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson)
        .get('/include/all$afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b.json')
        .reply(200, includesJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'guzzlehttp/guzzle',
      });
      expect(res).toMatchObject({
        homepage: 'http://guzzlephp.org/',
        registryUrl: 'https://composer.renovatebot.com',
        releases: [
          { version: '3.0.0' },
          { version: '3.0.1' },
          { version: '3.0.2' },
          { version: '3.0.3' },
          { version: '3.0.4' },
          { version: '3.0.5' },
          { version: '3.0.6' },
          { version: '3.0.7' },
          { version: '3.1.0' },
          { version: '3.1.1' },
          { version: '3.1.2' },
          { version: '3.2.0' },
          { version: '3.3.0' },
          { version: '3.3.1' },
          { version: '3.4.0' },
          { version: '3.4.1' },
          { version: '3.4.2' },
          { version: '3.4.3' },
          { version: '3.5.0' },
          { version: '3.6.0' },
          { version: '3.7.0' },
          { version: '3.7.1' },
          { version: '3.7.2' },
          { version: '3.7.3' },
          { version: '3.7.4' },
          { version: '3.8.0' },
          { version: '3.8.1' },
        ],
        sourceUrl: 'https://github.com/guzzle/guzzle',
      });
    });

    it('supports lazy repositories', async () => {
      const packagesJson = {
        packages: [],
        'providers-lazy-url':
          'https://composer.renovatebot.com/composer/lazy/p/%package%.json',
      };
      config = {
        registryUrls: ['https://composer.renovatebot.com/composer/lazy'],
      };
      const fileJson = {
        packages: {
          'guzzlehttp/guzzle': {
            '5.3.4': {
              name: 'guzzlehttp/guzzle',
              version: '5.3.4',
            },
            '7.0.0-beta.1': {
              name: 'guzzlehttp/guzzle',
              version: '7.0.0-beta.1',
            },
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/composer/lazy/packages.json')
        .reply(200, packagesJson)
        .get('/composer/lazy/p/guzzlehttp/guzzle.json')
        .reply(200, fileJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'guzzlehttp/guzzle',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('supports provider-includes', async () => {
      const packagesJson = {
        packages: [],
        'providers-url': '/p/%package%$%hash%.json',
        'provider-includes': {
          'p/providers-2018-09$%hash%.json': {
            sha256:
              '14346045d7a7261cb3a12a6b7a1a7c4151982530347b115e5e277d879cad1942',
          },
        },
      };
      const fileJson = {
        providers: {
          'wpackagist-plugin/1337-rss-feed-made-for-sharing': {
            sha256:
              'e9b6c98c63f99e59440863a044cc80dd9cddbf5c426b05003dba98983b5757de',
          },
          'wpackagist-plugin/1beyt': {
            sha256:
              'b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a',
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson)
        .get(
          '/p/providers-2018-09$14346045d7a7261cb3a12a6b7a1a7c4151982530347b115e5e277d879cad1942.json',
        )
        .reply(200, fileJson)
        .get(
          '/p/wpackagist-plugin/1beyt$b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a.json',
        )
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'wpackagist-plugin/1beyt',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('handles provider-includes miss', async () => {
      const packagesJson = {
        packages: [],
        'providers-url': '/p/%package%$%hash%.json',
        'provider-includes': {
          'p/providers-2018-09$%hash%.json': {
            sha256:
              '14346045d7a7261cb3a12a6b7a1a7c4151982530347b115e5e277d879cad1942',
          },
        },
      };
      const fileJson = {
        providers: {
          'wpackagist-plugin/1337-rss-feed-made-for-sharing': {
            sha256:
              'e9b6c98c63f99e59440863a044cc80dd9cddbf5c426b05003dba98983b5757de',
          },
          'wpackagist-plugin/1beyt': {
            sha256:
              'b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a',
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson)
        .get(
          '/p/providers-2018-09$14346045d7a7261cb3a12a6b7a1a7c4151982530347b115e5e277d879cad1942.json',
        )
        .reply(200, fileJson);
      httpMock
        .scope(baseUrl)
        .get('/packages.json')
        .reply(200, { 'metadata-url': '/p2/%package%.json' })
        .get('/p2/some/other.json')
        .reply(200, beytJson)
        .get('/p2/some/other~dev.json')
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'some/other',
      });
      expect(res).toBeNull();
    });

    it('supports providers', async () => {
      const packagesJson = {
        packages: [],
        'providers-url': '/p/%package%$%hash%.json',
        providers: {
          'wpackagist-plugin/1337-rss-feed-made-for-sharing': {
            sha256:
              'e9b6c98c63f99e59440863a044cc80dd9cddbf5c426b05003dba98983b5757de',
          },
          'wpackagist-plugin/1beyt': {
            sha256:
              'b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a',
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson)
        .get(
          '/p/wpackagist-plugin/1beyt$b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a.json',
        )
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'wpackagist-plugin/1beyt',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('supports providers without a hash', async () => {
      const packagesJson = {
        packages: [],
        'providers-url': '/p/%package%.json',
        providers: {
          'wpackagist-plugin/1337-rss-feed-made-for-sharing': {
            sha256: null,
          },
          'wpackagist-plugin/1beyt': {
            sha256: null,
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson)
        .get('/p/wpackagist-plugin/1beyt.json')
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'wpackagist-plugin/1beyt',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });

    it('handles providers miss', async () => {
      const packagesJson = {
        packages: [],
        'providers-url': '/p/%package%$%hash%.json',
        providers: {
          'wpackagist-plugin/1337-rss-feed-made-for-sharing': {
            sha256:
              'e9b6c98c63f99e59440863a044cc80dd9cddbf5c426b05003dba98983b5757de',
          },
          'wpackagist-plugin/1beyt': {
            sha256:
              'b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a',
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson);
      httpMock
        .scope(baseUrl)
        .get('/packages.json')
        .reply(200, { 'metadata-url': '/p2/%package%.json' })
        .get('/p2/some/other.json')
        .reply(200, beytJson)
        .get('/p2/some/other~dev.json')
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'some/other',
      });
      expect(res).toBeNull();
    });

    it('processes real versioned data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages.json')
        .reply(200, { 'metadata-url': '/p2/%package%.json' })
        .get('/p2/drewm/mailchimp-api.json')
        .reply(200, mailchimpJson)
        .get('/p2/drewm/mailchimp-api~dev.json')
        .reply(200, mailchimpDevJson);
      config.registryUrls = ['https://packagist.org'];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          packageName: 'drewm/mailchimp-api',
        }),
      ).toMatchSnapshot();
    });

    it('adds packagist source implicitly', async () => {
      httpMock
        .scope(baseUrl)
        .get('/packages.json')
        .reply(200, { 'metadata-url': '/p2/%package%.json' })
        .get('/p2/drewm/mailchimp-api.json')
        .reply(200, mailchimpJson)
        .get('/p2/drewm/mailchimp-api~dev.json')
        .reply(200, mailchimpDevJson);
      config.registryUrls = [];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          packageName: 'drewm/mailchimp-api',
        }),
      ).toMatchSnapshot();
    });

    it('fetches packagist V2 packages', async () => {
      httpMock
        .scope('https://example.com')
        .get('/packages.json')
        .reply(200, {
          'metadata-url': 'https://example.com/p2/%package%.json',
        })
        .get('/p2/drewm/mailchimp-api.json')
        .reply(200, {
          minified: 'composer/2.0',
          packages: {
            'drewm/mailchimp-api': [
              {
                name: 'drewm/mailchimp-api',
                version: 'v2.5.4',
              },
            ],
          },
        })
        .get('/p2/drewm/mailchimp-api~dev.json')
        .reply(404);
      config.registryUrls = ['https://example.com'];

      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'drewm/mailchimp-api',
      });

      expect(res).toEqual({
        registryUrl: 'https://example.com',
        releases: [{ gitRef: 'v2.5.4', version: '2.5.4' }],
      });
    });

    it('respects "available-packages" list', async () => {
      httpMock
        .scope('https://example.com')
        .get('/packages.json')
        .twice()
        .reply(200, {
          'metadata-url': 'https://example.com/p2/%package%.json',
          'available-packages': ['foo/bar'],
        })
        .get('/p2/foo/bar.json')
        .reply(200, {
          minified: 'composer/2.0',
          packages: {
            'foo/bar': [
              {
                name: 'foo/bar',
                version: 'v1.2.3',
              },
            ],
          },
        })
        .get('/p2/foo/bar~dev.json')
        .reply(404);
      config.registryUrls = ['https://example.com'];

      const foo = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'foo/foo',
      });
      expect(foo).toBeNull();

      const bar = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'foo/bar',
      });

      expect(bar).toEqual({
        registryUrl: 'https://example.com',
        releases: [{ gitRef: 'v1.2.3', version: '1.2.3' }],
      });
    });
  });
});

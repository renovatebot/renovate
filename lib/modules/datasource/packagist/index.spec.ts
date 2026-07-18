import { Fixtures } from '~test/fixtures.ts';
import { hostRules } from '~test/host-rules.ts';
import * as httpMock from '~test/http-mock.ts';
import * as composerVersioning from '../../versioning/composer/index.ts';
import { id as versioning } from '../../versioning/loose/index.ts';
import { getPkgReleases } from '../index.ts';
import { PackagistDatasource } from './index.ts';

const includesJson = Fixtures.getJson('includes.json');
const beytJson = Fixtures.getJson('1beyt.json');
const mailchimpJson = Fixtures.getJson('mailchimp-api.json');
const mailchimpDevJson = Fixtures.getJson('mailchimp-api~dev.json');

const baseUrl = 'https://repo.packagist.org';
const datasource = PackagistDatasource.id;

describe('modules/datasource/packagist/index', () => {
  describe('getReleases', () => {
    let config: any;

    beforeEach(() => {
      config = {
        versioning: composerVersioning.id,
        registryUrls: [
          'https://composer.renovatebot.com',
          'https://repo.packagist.org',
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
      expect(res).toEqual({
        registryUrl: 'https://composer.renovatebot.com',
        releases: [
          {
            gitRef: '0.0.1',
            version: '0.0.1',
          },
          {
            gitRef: '1.0.x-dev',
            version: '1.0.x-dev',
          },
          {
            gitRef: '1.0.0',
            version: '1.0.0',
          },
        ],
      });
    });

    it('handles timeouts', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .replyWithError(httpMock.error({ code: 'ETIMEDOUT' }));
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
      hostRules.add({
        username: 'some-username',
        password: 'some-password',
      });
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
      expect(res).toEqual({
        homepage: 'http://guzzlephp.org/',
        registryUrl: 'https://composer.renovatebot.com',
        releases: [
          {
            gitRef: 'v3.0.0',
            releaseTimestamp: '2012-10-16T04:57:15.000Z',
            version: '3.0.0',
          },
          {
            gitRef: 'v3.0.1',
            releaseTimestamp: '2012-10-22T20:20:55.000Z',
            version: '3.0.1',
          },
          {
            gitRef: 'v3.0.2',
            releaseTimestamp: '2012-10-25T04:55:19.000Z',
            version: '3.0.2',
          },
          {
            gitRef: 'v3.0.3',
            releaseTimestamp: '2012-11-04T20:31:03.000Z',
            version: '3.0.3',
          },
          {
            gitRef: 'v3.0.4',
            releaseTimestamp: '2012-11-12T00:00:24.000Z',
            version: '3.0.4',
          },
          {
            gitRef: 'v3.0.5',
            releaseTimestamp: '2012-11-19T00:15:33.000Z',
            version: '3.0.5',
          },
          {
            gitRef: 'v3.0.6',
            releaseTimestamp: '2012-12-10T05:25:04.000Z',
            version: '3.0.6',
          },
          {
            gitRef: 'v3.0.7',
            releaseTimestamp: '2012-12-19T23:06:35.000Z',
            version: '3.0.7',
          },
          {
            gitRef: 'v3.1.0',
            releaseTimestamp: '2013-01-14T05:09:07.000Z',
            version: '3.1.0',
          },
          {
            gitRef: 'v3.1.1',
            releaseTimestamp: '2013-01-21T05:46:09.000Z',
            version: '3.1.1',
          },
          {
            gitRef: 'v3.1.2',
            releaseTimestamp: '2013-01-28T00:07:40.000Z',
            version: '3.1.2',
          },
          {
            gitRef: 'v3.2.0',
            releaseTimestamp: '2013-02-15T01:33:10.000Z',
            version: '3.2.0',
          },
          {
            gitRef: 'v3.3.0',
            releaseTimestamp: '2013-03-04T00:41:45.000Z',
            version: '3.3.0',
          },
          {
            gitRef: 'v3.3.1',
            releaseTimestamp: '2013-03-10T23:05:38.000Z',
            version: '3.3.1',
          },
          {
            gitRef: 'v3.4.0',
            releaseTimestamp: '2013-04-12T05:58:15.000Z',
            version: '3.4.0',
          },
          {
            gitRef: 'v3.4.1',
            releaseTimestamp: '2013-04-16T20:56:26.000Z',
            version: '3.4.1',
          },
          {
            gitRef: 'v3.4.2',
            releaseTimestamp: '2013-04-29T23:55:30.000Z',
            version: '3.4.2',
          },
          {
            gitRef: 'v3.4.3',
            releaseTimestamp: '2013-04-30T20:31:38.000Z',
            version: '3.4.3',
          },
          {
            gitRef: 'v3.5.0',
            releaseTimestamp: '2013-05-13T20:17:47.000Z',
            version: '3.5.0',
          },
          {
            gitRef: 'v3.6.0',
            releaseTimestamp: '2013-05-30T07:01:25.000Z',
            version: '3.6.0',
          },
          {
            gitRef: 'v3.7.0',
            releaseTimestamp: '2013-06-11T00:24:07.000Z',
            version: '3.7.0',
          },
          {
            gitRef: 'v3.7.1',
            releaseTimestamp: '2013-07-05T20:17:54.000Z',
            version: '3.7.1',
          },
          {
            gitRef: 'v3.7.2',
            releaseTimestamp: '2013-08-02T18:31:05.000Z',
            version: '3.7.2',
          },
          {
            gitRef: 'v3.7.3',
            releaseTimestamp: '2013-09-08T21:09:18.000Z',
            version: '3.7.3',
          },
          {
            gitRef: 'v3.7.4',
            releaseTimestamp: '2013-10-02T20:47:00.000Z',
            version: '3.7.4',
          },
          {
            gitRef: 'v3.8.0',
            releaseTimestamp: '2013-12-05T23:39:20.000Z',
            version: '3.8.0',
          },
          {
            gitRef: 'v3.8.1',
            releaseTimestamp: '2014-01-28T22:29:15.000Z',
            version: '3.8.1',
          },
        ],
        sourceUrl: 'https://github.com/guzzle/guzzle',
      });
      expect(res).not.toBeNull();
    });

    it('supports older sha1 hashes', async () => {
      hostRules.add({
        username: 'some-username',
        password: 'some-password',
      });
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
      expect(res).toEqual({
        registryUrl: 'https://composer.renovatebot.com/composer/lazy',
        releases: [
          {
            gitRef: '5.3.4',
            version: '5.3.4',
          },
          {
            gitRef: '7.0.0-beta.1',
            version: '7.0.0-beta.1',
          },
        ],
      });
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
      expect(res).toEqual({
        homepage: 'https://wordpress.org/plugins/1beyt/',
        registryUrl: 'https://composer.renovatebot.com',
        releases: [
          {
            gitRef: '1.0',
            version: '1.0',
          },
          {
            gitRef: '1.1',
            version: '1.1',
          },
          {
            gitRef: '1.4',
            version: '1.4',
          },
          {
            gitRef: '1.5',
            version: '1.5',
          },
          {
            gitRef: '1.5.1',
            version: '1.5.1',
          },
        ],
        sourceUrl: 'https://plugins.svn.wordpress.org/1beyt/',
      });
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
      expect(res).toEqual({
        homepage: 'https://wordpress.org/plugins/1beyt/',
        registryUrl: 'https://composer.renovatebot.com',
        releases: [
          {
            gitRef: '1.0',
            version: '1.0',
          },
          {
            gitRef: '1.1',
            version: '1.1',
          },
          {
            gitRef: '1.4',
            version: '1.4',
          },
          {
            gitRef: '1.5',
            version: '1.5',
          },
          {
            gitRef: '1.5.1',
            version: '1.5.1',
          },
        ],
        sourceUrl: 'https://plugins.svn.wordpress.org/1beyt/',
      });
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
      expect(res).toEqual({
        homepage: 'https://wordpress.org/plugins/1beyt/',
        registryUrl: 'https://composer.renovatebot.com',
        releases: [
          {
            gitRef: '1.0',
            version: '1.0',
          },
          {
            gitRef: '1.1',
            version: '1.1',
          },
          {
            gitRef: '1.4',
            version: '1.4',
          },
          {
            gitRef: '1.5',
            version: '1.5',
          },
          {
            gitRef: '1.5.1',
            version: '1.5.1',
          },
        ],
        sourceUrl: 'https://plugins.svn.wordpress.org/1beyt/',
      });
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
      config.registryUrls = ['https://repo.packagist.org'];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          packageName: 'drewm/mailchimp-api',
        }),
      ).toEqual({
        registryUrl: 'https://repo.packagist.org',
        releases: [
          {
            gitRef: 'v1.0',
            releaseTimestamp: '2014-05-30T16:51:39.000Z',
            version: '1.0',
          },
          {
            gitRef: 'v1.1',
            releaseTimestamp: '2015-07-07T15:38:25.000Z',
            version: '1.1',
          },
          {
            gitRef: 'v2.0',
            releaseTimestamp: '2016-01-17T13:08:01.000Z',
            version: '2.0',
          },
          {
            gitRef: 'v2.1',
            releaseTimestamp: '2016-01-30T16:12:54.000Z',
            version: '2.1',
          },
          {
            gitRef: 'v2.1.1',
            releaseTimestamp: '2016-04-06T08:37:20.000Z',
            version: '2.1.1',
          },
          {
            gitRef: 'v2.1.2',
            releaseTimestamp: '2016-04-06T12:41:37.000Z',
            version: '2.1.2',
          },
          {
            gitRef: 'v2.1.3',
            releaseTimestamp: '2016-04-12T09:09:47.000Z',
            version: '2.1.3',
          },
          {
            gitRef: 'v2.2',
            releaseTimestamp: '2016-04-23T12:43:28.000Z',
            version: '2.2',
          },
          {
            gitRef: 'v2.2.1',
            releaseTimestamp: '2016-04-23T18:00:21.000Z',
            version: '2.2.1',
          },
          {
            gitRef: 'v2.2.2',
            releaseTimestamp: '2016-07-01T09:58:24.000Z',
            version: '2.2.2',
          },
          {
            gitRef: 'v2.2.3',
            releaseTimestamp: '2016-07-01T15:53:33.000Z',
            version: '2.2.3',
          },
          {
            gitRef: 'v2.2.4',
            releaseTimestamp: '2016-07-01T15:53:33.000Z',
            version: '2.2.4',
          },
          {
            gitRef: 'v2.3',
            releaseTimestamp: '2016-12-21T14:50:24.000Z',
            version: '2.3',
          },
          {
            gitRef: 'v2.4',
            releaseTimestamp: '2017-02-16T13:24:20.000Z',
            version: '2.4',
          },
          {
            gitRef: 'v2.5',
            releaseTimestamp: '2018-02-16T15:31:05.000Z',
            version: '2.5',
          },
          {
            gitRef: 'v2.5.1',
            releaseTimestamp: '2019-03-19T11:43:38.000Z',
            version: '2.5.1',
          },
          {
            gitRef: 'v2.5.2',
            releaseTimestamp: '2019-03-26T09:00:38.000Z',
            version: '2.5.2',
          },
          {
            gitRef: 'v2.5.3',
            releaseTimestamp: '2019-03-28T15:20:43.000Z',
            version: '2.5.3',
          },
          {
            gitRef: 'v2.5.4',
            releaseTimestamp: '2019-08-06T09:24:58.000Z',
            version: '2.5.4',
          },
        ],
        sourceUrl: 'https://github.com/drewm/mailchimp-api',
      });
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
      ).toEqual({
        registryUrl: 'https://repo.packagist.org',
        releases: [
          {
            gitRef: 'v1.0',
            releaseTimestamp: '2014-05-30T16:51:39.000Z',
            version: '1.0',
          },
          {
            gitRef: 'v1.1',
            releaseTimestamp: '2015-07-07T15:38:25.000Z',
            version: '1.1',
          },
          {
            gitRef: 'v2.0',
            releaseTimestamp: '2016-01-17T13:08:01.000Z',
            version: '2.0',
          },
          {
            gitRef: 'v2.1',
            releaseTimestamp: '2016-01-30T16:12:54.000Z',
            version: '2.1',
          },
          {
            gitRef: 'v2.1.1',
            releaseTimestamp: '2016-04-06T08:37:20.000Z',
            version: '2.1.1',
          },
          {
            gitRef: 'v2.1.2',
            releaseTimestamp: '2016-04-06T12:41:37.000Z',
            version: '2.1.2',
          },
          {
            gitRef: 'v2.1.3',
            releaseTimestamp: '2016-04-12T09:09:47.000Z',
            version: '2.1.3',
          },
          {
            gitRef: 'v2.2',
            releaseTimestamp: '2016-04-23T12:43:28.000Z',
            version: '2.2',
          },
          {
            gitRef: 'v2.2.1',
            releaseTimestamp: '2016-04-23T18:00:21.000Z',
            version: '2.2.1',
          },
          {
            gitRef: 'v2.2.2',
            releaseTimestamp: '2016-07-01T09:58:24.000Z',
            version: '2.2.2',
          },
          {
            gitRef: 'v2.2.3',
            releaseTimestamp: '2016-07-01T15:53:33.000Z',
            version: '2.2.3',
          },
          {
            gitRef: 'v2.2.4',
            releaseTimestamp: '2016-07-01T15:53:33.000Z',
            version: '2.2.4',
          },
          {
            gitRef: 'v2.3',
            releaseTimestamp: '2016-12-21T14:50:24.000Z',
            version: '2.3',
          },
          {
            gitRef: 'v2.4',
            releaseTimestamp: '2017-02-16T13:24:20.000Z',
            version: '2.4',
          },
          {
            gitRef: 'v2.5',
            releaseTimestamp: '2018-02-16T15:31:05.000Z',
            version: '2.5',
          },
          {
            gitRef: 'v2.5.1',
            releaseTimestamp: '2019-03-19T11:43:38.000Z',
            version: '2.5.1',
          },
          {
            gitRef: 'v2.5.2',
            releaseTimestamp: '2019-03-26T09:00:38.000Z',
            version: '2.5.2',
          },
          {
            gitRef: 'v2.5.3',
            releaseTimestamp: '2019-03-28T15:20:43.000Z',
            version: '2.5.3',
          },
          {
            gitRef: 'v2.5.4',
            releaseTimestamp: '2019-08-06T09:24:58.000Z',
            version: '2.5.4',
          },
        ],
        sourceUrl: 'https://github.com/drewm/mailchimp-api',
      });
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

    it('marks abandoned packages as deprecated with a replacement', async () => {
      httpMock
        .scope('https://example.com')
        .get('/packages.json')
        .reply(200, {
          'metadata-url': 'https://example.com/p2/%package%.json',
        })
        .get('/p2/scheb/two-factor-bundle.json')
        .reply(200, {
          minified: 'composer/2.0',
          packages: {
            'scheb/two-factor-bundle': [
              {
                name: 'scheb/two-factor-bundle',
                version: 'v4.18.4',
                abandoned: 'scheb/2fa-bundle',
              },
            ],
          },
        })
        .get('/p2/scheb/two-factor-bundle~dev.json')
        .reply(404);
      config.registryUrls = ['https://example.com'];

      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'scheb/two-factor-bundle',
      });

      expect(res).toEqual({
        registryUrl: 'https://example.com',
        deprecationMessage:
          'This package is abandoned and no longer maintained. The author suggests using the `scheb/2fa-bundle` package instead.',
        releases: [
          { gitRef: 'v4.18.4', version: '4.18.4', isDeprecated: true },
        ],
      });
    });

    it('marks abandoned packages as deprecated without a replacement', async () => {
      httpMock
        .scope('https://example.com')
        .get('/packages.json')
        .reply(200, {
          'metadata-url': 'https://example.com/p2/%package%.json',
        })
        .get('/p2/sonata-project/core-bundle.json')
        .reply(200, {
          minified: 'composer/2.0',
          packages: {
            'sonata-project/core-bundle': [
              {
                name: 'sonata-project/core-bundle',
                version: '3.20.0',
                abandoned: true,
              },
            ],
          },
        })
        .get('/p2/sonata-project/core-bundle~dev.json')
        .reply(404);
      config.registryUrls = ['https://example.com'];

      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        packageName: 'sonata-project/core-bundle',
      });

      expect(res).toEqual({
        registryUrl: 'https://example.com',
        deprecationMessage:
          'This package is abandoned and no longer maintained.',
        releases: [{ gitRef: '3.20.0', version: '3.20.0', isDeprecated: true }],
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

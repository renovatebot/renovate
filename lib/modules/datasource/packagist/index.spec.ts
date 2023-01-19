import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import type { HostRule } from '../../../types';
import * as _hostRules from '../../../util/host-rules';
import * as composerVersioning from '../../versioning/composer';
import { id as versioning } from '../../versioning/loose';
import { PackagistDatasource } from '.';

jest.mock('../../../util/host-rules');

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
      jest.resetAllMocks();
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
        depName: 'something/one',
      });
      expect(res).toBeNull();
    });

    it('handles timeouts', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .replyWithError({ code: 'ETIMEDOUT' });
      httpMock
        .scope(baseUrl)
        .get('/p2/vendor/package-name2.json')
        .reply(200)
        .get('/p2/vendor/package-name2~dev.json')
        .reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'vendor/package-name2',
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
        .get('/p2/vendor/package-name.json')
        .reply(200)
        .get('/p2/vendor/package-name~dev.json')
        .reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'vendor/package-name',
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
        .get('/p2/drewm/mailchimp-api.json')
        .reply(200)
        .get('/p2/drewm/mailchimp-api~dev.json')
        .reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'drewm/mailchimp-api',
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
          'include/all$afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b.json': {
            sha256: 'afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b',
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
        depName: 'guzzlehttp/guzzle',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
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
        depName: 'guzzlehttp/guzzle',
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
          '/p/providers-2018-09$14346045d7a7261cb3a12a6b7a1a7c4151982530347b115e5e277d879cad1942.json'
        )
        .reply(200, fileJson)
        .get(
          '/p/wpackagist-plugin/1beyt$b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a.json'
        )
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'wpackagist-plugin/1beyt',
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
          '/p/providers-2018-09$14346045d7a7261cb3a12a6b7a1a7c4151982530347b115e5e277d879cad1942.json'
        )
        .reply(200, fileJson);
      httpMock
        .scope(baseUrl)
        .get('/p2/some/other.json')
        .reply(200, beytJson)
        .get('/p2/some/other~dev.json')
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'some/other',
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
          '/p/wpackagist-plugin/1beyt$b574a802b5bf20a58c0f027e73aea2a75d23a6f654afc298a8dc467331be316a.json'
        )
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'wpackagist-plugin/1beyt',
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
        depName: 'wpackagist-plugin/1beyt',
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
        .get('/p2/some/other.json')
        .reply(200, beytJson)
        .get('/p2/some/other~dev.json')
        .reply(200, beytJson);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'some/other',
      });
      expect(res).toBeNull();
    });

    it('processes real versioned data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/p2/drewm/mailchimp-api.json')
        .reply(200, mailchimpJson);
      httpMock
        .scope(baseUrl)
        .get('/p2/drewm/mailchimp-api~dev.json')
        .reply(200, mailchimpDevJson);
      config.registryUrls = ['https://packagist.org'];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'drewm/mailchimp-api',
        })
      ).toMatchSnapshot();
    });

    it('adds packagist source implicitly', async () => {
      httpMock
        .scope(baseUrl)
        .get('/p2/drewm/mailchimp-api.json')
        .reply(200, mailchimpJson);
      httpMock
        .scope(baseUrl)
        .get('/p2/drewm/mailchimp-api~dev.json')
        .reply(200, mailchimpDevJson);
      config.registryUrls = [];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'drewm/mailchimp-api',
        })
      ).toMatchSnapshot();
    });
  });
});

import fs from 'fs';
import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as composerVersioning from '../../versioning/composer';
import { id as versioning } from '../../versioning/loose';
import { id as datasource } from '.';

jest.mock('../../util/host-rules');

const hostRules = _hostRules;

const includesJson: any = fs.readFileSync(
  'lib/datasource/packagist/__fixtures__/includes.json'
);
const beytJson: any = fs.readFileSync(
  'lib/datasource/packagist/__fixtures__/1beyt.json'
);
const mailchimpJson: any = fs.readFileSync(
  'lib/datasource/packagist/__fixtures__/mailchimp-api.json'
);

const baseUrl = 'https://packagist.org';

describe(getName(__filename), () => {
  describe('getReleases', () => {
    let config: any;
    beforeEach(() => {
      jest.resetAllMocks();
      httpMock.setup();
      hostRules.find = jest.fn((input) => input);
      hostRules.hosts = jest.fn(() => []);
      config = {
        versioning: composerVersioning.id,
        registryUrls: [
          'https://composer.renovatebot.com',
          'https://packagist.org',
        ],
      };
    });

    afterEach(() => {
      httpMock.reset();
    });

    it('supports custom registries', async () => {
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
    it('supports plain packages', async () => {
      const packagesOnly = {
        packages: {
          'vendor/package-name': {
            'dev-master': {},
            '1.0.x-dev': {},
            '0.0.1': {},
            '1.0.0': {},
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
        depName: 'vendor/package-name',
      });
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles timeouts', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .replyWithError({ code: 'ETIMEDOUT' });
      httpMock.scope(baseUrl).get('/p/vendor/package-name2.json').reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'vendor/package-name2',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles auth rejections', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(403);
      httpMock.scope(baseUrl).get('/p/vendor/package-name.json').reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'vendor/package-name',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('handles not found registries', async () => {
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(404);
      httpMock.scope(baseUrl).get('/p/drewm/mailchip-api.json').reply(200);
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'drewm/mailchip-api',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
            sha1: 'afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b',
          },
        },
      };
      httpMock
        .scope('https://composer.renovatebot.com')
        .get('/packages.json')
        .reply(200, packagesJson)
        .get('/include/all$afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b.json')
        .reply(200, JSON.parse(includesJson));
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'guzzlehttp/guzzle',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        .reply(200, JSON.parse(beytJson));
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'wpackagist-plugin/1beyt',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        .get('/p/some/other.json')
        .reply(200, JSON.parse(beytJson));
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'some/other',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        .reply(200, JSON.parse(beytJson));
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'wpackagist-plugin/1beyt',
      });
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
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
        .get('/p/some/other.json')
        .reply(200, JSON.parse(beytJson));
      const res = await getPkgReleases({
        ...config,
        datasource,
        versioning,
        depName: 'some/other',
      });
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('processes real versioned data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/p/drewm/mailchimp-api.json')
        .reply(200, JSON.parse(mailchimpJson));
      config.registryUrls = ['https://packagist.org'];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'drewm/mailchimp-api',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('adds packagist source implicitly', async () => {
      httpMock
        .scope(baseUrl)
        .get('/p/drewm/mailchimp-api.json')
        .reply(200, JSON.parse(mailchimpJson));
      config.registryUrls = [];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'drewm/mailchimp-api',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

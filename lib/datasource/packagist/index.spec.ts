import fs from 'fs';
import * as globalCache from '../../util/cache/global';
import * as runCache from '../../util/cache/run';
import _got from '../../util/got';
import * as _hostRules from '../../util/host-rules';
import * as composerVersioning from '../../versioning/composer';
import * as packagist from '.';

jest.mock('../../util/got');
jest.mock('../../util/host-rules');

const got: any = _got;
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

describe('datasource/packagist', () => {
  describe('getReleases', () => {
    let config: any;
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find = jest.fn((input) => input);
      hostRules.hosts = jest.fn(() => []);
      runCache.clear();
      config = {
        versioning: composerVersioning.id,
        registryUrls: [
          'https://composer.renovatebot.com',
          'https://packagist.org',
        ],
      };
      return globalCache.rmAll();
    });
    it('supports custom registries', async () => {
      config = {
        registryUrls: ['https://composer.renovatebot.com'],
      };
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'something/one',
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
      got.mockReturnValueOnce({
        body: packagesOnly,
      });
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'vendor/package-name',
      });
      expect(res).toMatchSnapshot();
    });
    it('handles timeouts', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          code: 'ETIMEDOUT',
        })
      );
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'vendor/package-name2',
      });
      expect(res).toBeNull();
    });
    it('handles auth rejections', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 403,
        })
      );
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'vendor/package-name',
      });
      expect(res).toBeNull();
    });
    it('handles not found registries', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
          url: 'https://some.registry/packages.json',
        })
      );
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'drewm/mailchip-api',
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
            sha1: 'afbf74d51f31c7cbb5ff10304f9290bfb4f4e68b',
          },
        },
      };
      got.mockReturnValueOnce({
        body: packagesJson,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(includesJson),
      });
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'guzzlehttp/guzzle',
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
      got.mockReturnValueOnce({
        body: packagesJson,
      });
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
      got.mockReturnValueOnce({
        body: fileJson,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(beytJson),
      });
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'wpackagist-plugin/1beyt',
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
      got.mockReturnValueOnce({
        body: packagesJson,
      });
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
      got.mockReturnValueOnce({
        body: fileJson,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(beytJson),
      });
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'some/other',
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
      got.mockReturnValueOnce({
        body: packagesJson,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(beytJson),
      });
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'wpackagist-plugin/1beyt',
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
      got.mockReturnValueOnce({
        body: packagesJson,
      });
      got.mockReturnValueOnce({
        body: JSON.parse(beytJson),
      });
      const res = await packagist.getReleases({
        ...config,
        lookupName: 'some/other',
      });
      expect(res).toBeNull();
    });
    it('processes real versioned data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(mailchimpJson),
      });
      config.registryUrls = ['https://packagist.org'];
      expect(
        await packagist.getReleases({
          ...config,
          lookupName: 'drewm/mailchimp-api',
        })
      ).toMatchSnapshot();
    });
    it('adds packagist source implicitly', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(mailchimpJson),
      });
      config.registryUrls = [];
      expect(
        await packagist.getReleases({
          ...config,
          lookupName: 'drewm/mailchimp-api',
        })
      ).toMatchSnapshot();
    });
  });
});

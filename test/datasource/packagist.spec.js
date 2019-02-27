const fs = require('fs');
const got = require('got');
const datasource = require('../../lib/datasource');
const hostRules = require('../../lib/util/host-rules');

jest.mock('got');
jest.mock('../../lib/util/host-rules');

const includesJson = fs.readFileSync('test/_fixtures/packagist/includes.json');
const beytJson = fs.readFileSync('test/_fixtures/packagist/1beyt.json');
const mailchimpJson = fs.readFileSync(
  'test/_fixtures/packagist/mailchimp-api.json'
);

describe('datasource/packagist', () => {
  describe('getPkgReleases', () => {
    let config;
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find = jest.fn(input => input);
      global.repoCache = {};
      config = {
        versionScheme: 'composer',
        registryUrls: [
          {
            type: 'composer',
            url: 'https://composer.renovatebot.com',
          },
        ],
      };
      return global.renovateCache.rmAll();
    });
    it('supports custom registries', async () => {
      config = {
        registryUrls: [
          {
            type: 'composer',
            url: 'https://composer.renovatebot.com',
          },
          {
            type: 'unknown',
          },
          {
            type: 'package',
            package: {
              name: 'abc/def',
              type: 'wordpress-theme',
              version: '1.2.6',
              dist: {
                type: 'zip',
                url: 'https://github.com/abc/def/archive/v1.2.6.zip',
              },
            },
          },
          {
            'packagist.org': false,
          },
        ],
      };
      const res = await datasource.getPkgReleases(
        'pkg:packagist/something/one',
        config
      );
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
      const res = await datasource.getPkgReleases(
        'pkg:packagist/vendor/package-name',
        config
      );
      expect(res).toMatchSnapshot();
    });
    it('handles auth rejections', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 401,
        })
      );
      const res = await datasource.getPkgReleases(
        'pkg:packagist/vendor/package-name',
        config
      );
      expect(res).toBeNull();
    });
    it('handles not found registries', async () => {
      got.mockImplementationOnce(() =>
        Promise.reject({
          statusCode: 404,
          url: 'https://some.registry/packages.json',
        })
      );
      const res = await datasource.getPkgReleases(
        'pkg:packagist/drewm/mailchip-api',
        config
      );
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
      const res = await datasource.getPkgReleases(
        'pkg:packagist/guzzlehttp/guzzle',
        config
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
    it('supports providers packages', async () => {
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
      const res = await datasource.getPkgReleases(
        'pkg:packagist/wpackagist-plugin/1beyt',
        config
      );
      expect(res).toMatchSnapshot();
      expect(res).not.toBeNull();
    });
    it('handles providers packages miss', async () => {
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
      const res = await datasource.getPkgReleases(
        'pkg:packagist/some/other',
        config
      );
      expect(res).toBeNull();
    });
    it('processes real versioned data', async () => {
      got.mockReturnValueOnce({
        body: JSON.parse(mailchimpJson),
      });
      delete config.registryUrls;
      expect(
        await datasource.getPkgReleases(
          'pkg:packagist/drewm/mailchimp-api',
          config
        )
      ).toMatchSnapshot();
    });
  });
});

import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { loadJsonFixture } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as loose from '../../versioning/loose';
import { id as versioning } from '../../versioning/loose';
import { id as datasource, getDigest, lookupConanPackage } from '.';

jest.mock('../../util/host-rules');

const hostRules = _hostRules;

const pocoJson: any = loadJsonFixture('poco');
const pocoDigestJson: any = loadJsonFixture('pocoDigest');
const malformedJson: any = loadJsonFixture('malformed');
const fakeJson: any = loadJsonFixture('fake');

const baseUrl = 'https://conan.bintray.com/';

describe('datasource/conan/index', () => {
  describe('lookupConanPackage', () => {
    let config: any;
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find = jest.fn((input) => input);
      hostRules.hosts = jest.fn(() => []);
      config = {
        versioning: loose.id,
        registryUrls: [baseUrl],
      };
    });

    it('handles non 404 errors', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .replyWithError('error');
      config.registryUrls = ['https://fake.bintray.com/'];

      await expect(
        lookupConanPackage('poco', 'https://fake.bintray.com/')
      ).rejects.toThrow('error');
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles missing slash on registries', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco')
        .reply(200, fakeJson);
      config.registryUrls = ['https://fake.bintray.com'];
      expect(
        await lookupConanPackage('poco', 'https://fake.bintray.com')
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles malformed packages', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=bad')
        .reply(200, malformedJson);
      config.registryUrls = [baseUrl];
      expect(await lookupConanPackage('bad', baseUrl)).toMatchSnapshot();
    });
  });

  describe('getDigest', () => {
    let config: any;
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find = jest.fn((input) => input);
      hostRules.hosts = jest.fn(() => []);
      config = {
        versioning: loose.id,
        registryUrls: [baseUrl],
      };
    });

    it('handles bad return', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, null);
      config.registryUrls = [baseUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'fakepackage',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles bad registries', async () => {
      httpMock
        .scope('https://fake.bintray.com/')
        .get('/v2/conans/search?q=poco/fakeversion')
        .reply(404);
      config.registryUrls = ['https://fake.bintray.com/'];
      expect(
        await getDigest(
          {
            lookupName: 'poco',
            registryUrl: 'https://fake.bintray.com/',
            currentDigest: '@conan/stable',
          },
          'fakeversion'
        )
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles missing packages', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=fakepackage/fakeversion')
        .reply(200, fakeJson);
      config.registryUrls = [baseUrl];
      expect(
        await getDigest(
          {
            lookupName: 'fakepackage',
            registryUrl: baseUrl,
            currentDigest: '@conan/stable',
          },
          'fakeversion'
        )
      ).toMatchSnapshot();
    });

    it('handles matched packages', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=poco/1.9.3')
        .reply(200, pocoDigestJson);
      config.registryUrls = [baseUrl];
      expect(
        await getDigest(
          {
            lookupName: 'poco',
            registryUrl: baseUrl,
            currentDigest: '@conan/test',
          },
          '1.9.3'
        )
      ).toMatchSnapshot();
    });

    it('handles unmatched packages', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=poco/1.9.3')
        .reply(200, pocoDigestJson);
      config.registryUrls = [baseUrl];
      expect(
        await getDigest(
          {
            lookupName: 'poco',
            registryUrl: baseUrl,
            currentDigest: '@bincrafters/stable',
          },
          '1.9.3'
        )
      ).toMatchSnapshot();
    });
  });

  describe('getReleases', () => {
    let config: any;
    beforeEach(() => {
      jest.resetAllMocks();
      hostRules.find = jest.fn((input) => input);
      hostRules.hosts = jest.fn(() => []);
      config = {
        versioning: loose.id,
        registryUrls: [baseUrl],
      };
    });

    it('handles bad return', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, null);
      config.registryUrls = [baseUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'fakepackage',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('handles missing packages', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=fakepackage')
        .reply(200, fakeJson);
      config.registryUrls = [baseUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'fakepackage',
        })
      ).toBeNull();
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
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('processes real versioned data', async () => {
      httpMock
        .scope(baseUrl)
        .get('/v2/conans/search?q=poco')
        .reply(200, pocoJson);
      config.registryUrls = [baseUrl];
      expect(
        await getPkgReleases({
          ...config,
          datasource,
          versioning,
          depName: 'poco',
        })
      ).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

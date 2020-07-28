import { getPkgReleases } from '..';
import * as httpMock from '../../../test/httpMock';
import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as rubyVersioning from '../../versioning/ruby';
import onePassInfo from './__fixtures__/1pass/info.json';
import onePassVersions from './__fixtures__/1pass/versions.json';
import railsInfo from './__fixtures__/rails/info.json';
import railsVersions from './__fixtures__/rails/versions.json';
import { resetCache } from './get-gem';
import * as rubygems from '.';

const hostRules = mocked(_hostRules);

const gemfuryIoVersions = `created_at: 2020-07-17T09:53:03+00:00
---
my_private_gem 0.1.0,0.1.1,0.1.2,0.1.3,0.1.4 341ee846d589ef418d42c4aff2edf195
my_other_private_gem 1.0.4,1.0.5,2.0.0rc1,2.0.0rc3,2.0.0,2.0.1,2.0.2,3.0.0,3.0.1,3.0.2,3.0.3,3.1.0 277cb051a09dd06ae9e20cb147f7d596
`;

jest.mock('../../util/host-rules');

describe('datasource/rubygems', () => {
  describe('getReleases', () => {
    const SKIP_CACHE = process.env.RENOVATE_SKIP_CACHE;

    const params = {
      versioning: rubyVersioning.id,
      datasource: rubygems.id,
      depName: 'rails',
      registryUrls: ['https://thirdparty.com', 'https://firstparty.com'],
    };

    beforeEach(() => {
      resetCache();
      httpMock.setup();
      process.env.RENOVATE_SKIP_CACHE = 'true';
      hostRules.find.mockReturnValue({});
      hostRules.hosts.mockReturnValue([]);
    });

    afterEach(() => {
      httpMock.reset();
      jest.resetAllMocks();
      process.env.RENOVATE_SKIP_CACHE = SKIP_CACHE;
    });

    it('returns null for missing pkg', async () => {
      httpMock
        .scope('https://firstparty.com')
        .get('/api/v1/gems/rails.json')
        .reply(200, null);
      httpMock
        .scope('https://thirdparty.com')
        .get('/api/v1/gems/rails.json')
        .reply(200, null);
      expect(await getPkgReleases(params)).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null for rubygems.org package miss', async () => {
      const newparams = { ...params };
      newparams.registryUrls = [];
      httpMock
        .scope('https://rubygems.org')
        .get('/api/v1/gems/rails.json')
        .reply(404);
      const res = await getPkgReleases(newparams);
      expect(res).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns a dep for rubygems.org package hit', async () => {
      const newparams = {
        ...params,
        lookupName: '1pass',
        registryUrls: [],
      };

      httpMock
        .scope('https://rubygems.org')
        .get(`/api/v1/gems/${newparams.lookupName}.json`)
        .reply(200, onePassInfo)
        .get(`/api/v1/versions/${newparams.lookupName}.json`)
        .reply(200, onePassVersions);

      const res = await getPkgReleases(newparams);
      expect(res).not.toBeNull();
      expect(res.releases).toHaveLength(3);
      expect(res).toMatchSnapshot();
      expect(
        res.releases.find((release) => release.version === '0.1.1')
      ).toBeDefined();
      expect(
        res.releases.find((release) => release.version === '1.0.0')
      ).toBeUndefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('works with gem.fury.io registry url without auth', async () => {
      httpMock
        .scope('https://gem.fury.io')
        .get('/username/versions')
        .reply(200, gemfuryIoVersions);

      const res = await getPkgReleases({
        ...params,
        lookupName: 'my_private_gem',
        registryUrls: ['https://gem.fury.io/username'],
      });
      expect(res).not.toBeNull();
      expect(res.releases).toHaveLength(5);
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('works with gem.fury.io registry url with auth', async () => {
      httpMock
        .scope('https://gem.fury.io')
        .get('/username/versions')
        .reply(200, gemfuryIoVersions);

      hostRules.find.mockReturnValueOnce({
        token: 'some-token',
      });

      const res = await getPkgReleases({
        ...params,
        lookupName: 'my_private_gem',
        registryUrls: ['https://gem.fury.io/username'],
      });
      expect(res).not.toBeNull();
      expect(res.releases).toHaveLength(5);
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('works with real data', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/api/v1/versions/rails.json')
        .reply(200, railsVersions);

      const res = await getPkgReleases(params);
      expect(res.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('uses multiple source urls', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(401);
      httpMock
        .scope('https://firstparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/api/v1/versions/rails.json')
        .reply(200, railsVersions);

      const res = await getPkgReleases(params);
      expect(res.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('returns null if mismatched name', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(200, { ...railsInfo, name: 'oooops' });
      httpMock
        .scope('https://firstparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(200, null);
      expect(await getPkgReleases(params)).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
  });
});

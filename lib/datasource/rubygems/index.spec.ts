import { getPkgReleases } from '..';
import * as httpMock from '../../../test/httpMock';
import { mocked } from '../../../test/util';
import * as _hostRules from '../../util/host-rules';
import * as rubyVersioning from '../../versioning/ruby';
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

const rubygemsOrgVersions = `created_at: 2017-03-27T04:38:13+00:00
---
- 1 05d0116933ba44b0b5d0ee19bfd35ccc
.cat 0.0.1 631fd60a806eaf5026c86fff3155c289
0mq 0.1.0,0.1.1,0.1.2,0.2.0,0.2.1,0.3.0,0.4.0,0.4.1,0.5.0,0.5.1,0.5.2,0.5.3 6146193f8f7e944156b0b42ec37bad3e
0xffffff 0.0.1,0.1.0 0a4a9aeae24152cdb467be02f40482f9
10to1-crack 0.1.1,0.1.2,0.1.3 e7218e76477e2137355d2e7ded094925
1234567890_ 1.0,1.1 233e818c2db65d2dad9f9ea9a27b1a30
12_hour_time 0.0.2,0.0.3,0.0.4 4e58bc03e301f704950410b713c20b69
16watts-fluently 0.3.0,0.3.1 555088e2b18e97e0293cab1d90dbb0d2
189seg 0.0.1 c4d329f7d3eb88b6e602358968be0242
196demo 0.0.0 e00c558565f7b03a438fbd93d854b7de
1_as_identity_function 1.0.0,1.0.1 bee2f0fbbc3c5c83008c0b8fc64cb168
1and1 1.1 1853e4495b036ddc5da2035523d48f0d
1hdoc 0.1.3,0.2.0,0.2.2,0.2.3,0.2.4 7076f29c196df12047a3700c4d6e5915
1pass 0.1.0,0.1.1,0.1.2 d209547aae4b8f3d67123f18f738ac99
1pass -0.1.2 abcdef
21-day-challenge-countdown 0.1.0,0.1.1,0.1.2 57e8873fe713063f4e54e85bbbd709bb`;

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
        .get('/versions')
        .reply(200, rubygemsOrgVersions);
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
        .get('/versions')
        .reply(200, rubygemsOrgVersions);

      const res = await getPkgReleases(newparams);
      expect(res).not.toBeNull();
      expect(res.releases).toHaveLength(2);
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
        username: 'some-token',
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

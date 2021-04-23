import { getPkgReleases } from '..';
import * as httpMock from '../../../test/http-mock';
import { getName, loadFixture, loadJsonFixture } from '../../../test/util';
import * as rubyVersioning from '../../versioning/ruby';
import { resetCache } from './get-rubygems-org';
import * as rubygems from '.';

const rubygemsOrgVersions = loadFixture(__filename, 'rubygems-org.txt');
const railsInfo = loadJsonFixture(__filename, 'rails/info.json');
const railsVersions = loadJsonFixture(__filename, 'rails/versions.json');

describe(getName(__filename), () => {
  describe('getReleases', () => {
    const SKIP_CACHE = process.env.RENOVATE_SKIP_CACHE;

    const params = {
      versioning: rubyVersioning.id,
      datasource: rubygems.id,
      depName: 'rails',
      registryUrls: [
        'https://thirdparty.com',
        'https://firstparty.com/basepath/',
      ],
    };

    beforeEach(() => {
      resetCache();
      httpMock.setup();
      process.env.RENOVATE_SKIP_CACHE = 'true';
      jest.resetAllMocks();
    });

    afterEach(() => {
      httpMock.reset();
      process.env.RENOVATE_SKIP_CACHE = SKIP_CACHE;
    });

    it('returns null for missing pkg', async () => {
      httpMock
        .scope('https://firstparty.com')
        .get('/basepath/api/v1/gems/rails.json')
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
        res.releases.find((release) => release.version === '0.1.2')
      ).toBeUndefined();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });

    it('uses rubygems.org if no registry urls were provided', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, rubygemsOrgVersions);

      expect(
        await getPkgReleases({
          ...params,
          registryUrls: [],
        })
      ).toBeNull();

      const res = await getPkgReleases({
        ...params,
        lookupName: '1pass',
        registryUrls: [],
      });
      expect(res).not.toBeNull();
      expect(res.releases).toHaveLength(2);
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
        .get('/basepath/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/basepath/api/v1/versions/rails.json')
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
        .get('/basepath/api/v1/gems/rails.json')
        .reply(200, null);
      expect(await getPkgReleases(params)).toBeNull();
      expect(httpMock.getTrace()).toMatchSnapshot();
    });
    it('falls back to info when version request fails', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/api/v1/versions/rails.json')
        .reply(400, {});
      const res = await getPkgReleases(params);
      expect(res.releases).toHaveLength(1);
      expect(res.releases[0].version).toBe(railsInfo.version);
    });
    it('errors when version request fails with anything other than 400 or 404', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/api/v1/versions/rails.json')
        .reply(500, {});
      expect(await getPkgReleases(params)).toBeNull();
    });
  });
});

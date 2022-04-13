import { getPkgReleases } from '..';
import * as httpMock from '../../../../test/http-mock';
import {
  loadBinaryFixture,
  loadFixture,
  loadJsonFixture,
} from '../../../../test/util';
import * as rubyVersioning from '../../versioning/ruby';
import { resetCache } from './get-rubygems-org';
import { RubyGemsDatasource } from '.';

const rubygemsOrgVersions = loadFixture('rubygems-org.txt');
const railsInfo = loadJsonFixture('rails/info.json');
const railsVersions = loadJsonFixture('rails/versions.json');
const railsDependencies = loadBinaryFixture('dependencies-rails.dat');
const emptyMarshalArray = Buffer.from([4, 8, 91, 0]);

describe('modules/datasource/rubygems/index', () => {
  describe('getReleases', () => {
    const SKIP_CACHE = process.env.RENOVATE_SKIP_CACHE;

    const params = {
      versioning: rubyVersioning.id,
      datasource: RubyGemsDatasource.id,
      depName: 'rails',
      registryUrls: [
        'https://thirdparty.com',
        'https://firstparty.com/basepath/',
      ],
    };

    beforeEach(() => {
      resetCache();
      process.env.RENOVATE_SKIP_CACHE = 'true';
      jest.resetAllMocks();
    });

    afterEach(() => {
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
    });

    it('returns a dep for rubygems.org package hit', async () => {
      const newparams = {
        ...params,
        packageName: '1pass',
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
        packageName: '1pass',
        registryUrls: [],
      });
      expect(res).not.toBeNull();
      expect(res.releases).toHaveLength(2);
      expect(res).toMatchSnapshot();
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
      httpMock
        .scope('https://firstparty.com/basepath')
        .get('/api/v1/gems/rails.json')
        .reply(500);
      expect(await getPkgReleases(params)).toBeNull();
    });

    it('falls back to dependencies api', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/api/v1/gems/rails.json')
        .reply(404, railsInfo)
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, railsDependencies);

      const res = await getPkgReleases(params);
      expect(res?.releases).toHaveLength(339);
    });

    it('returns null for GitHub Packages package miss', async () => {
      const newparams = { ...params };
      newparams.registryUrls = ['https://rubygems.pkg.github.com/example'];
      httpMock
        .scope('https://rubygems.pkg.github.com/example')
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, emptyMarshalArray);
      expect(await getPkgReleases(newparams)).toBeNull();
    });

    it('returns a dep for GitHub Packages package hit', async () => {
      const newparams = { ...params };
      newparams.registryUrls = ['https://rubygems.pkg.github.com/example'];
      httpMock
        .scope('https://rubygems.pkg.github.com/example')
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, railsDependencies);
      const res = await getPkgReleases(newparams);
      expect(res.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
    });
  });
});

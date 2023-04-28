import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as memCache from '../../../util/cache/memory';
import * as rubyVersioning from '../../versioning/ruby';
import { VersionsDatasource } from './versions-datasource';
import { RubyGemsDatasource } from '.';

const rubygemsOrgVersions = Fixtures.get('rubygems-org.txt');
const railsInfo = Fixtures.getJson('rails/info.json');
const railsVersions = Fixtures.getJson('rails/versions.json');
const railsDependencies = Fixtures.getBinary('dependencies-rails.dat');
const emptyMarshalArray = Buffer.from([4, 8, 91, 0]);

describe('modules/datasource/rubygems/index', () => {
  describe('getReleases', () => {
    const params = {
      versioning: rubyVersioning.id,
      datasource: RubyGemsDatasource.id,
      packageName: 'rails',
      registryUrls: [
        'https://thirdparty.com',
        'https://firstparty.com/basepath/',
      ],
    };

    beforeEach(() => {
      memCache.init();
      jest.resetAllMocks();
    });

    afterEach(() => {
      memCache.reset();
    });

    it('returns null for missing pkg', async () => {
      httpMock
        .scope('https://firstparty.com')
        .get('/basepath/versions')
        .reply(404);
      httpMock
        .scope('https://firstparty.com')
        .get('/basepath/api/v1/gems/rails.json')
        .reply(200);
      httpMock.scope('https://thirdparty.com').get('/versions').reply(404);
      httpMock
        .scope('https://thirdparty.com')
        .get('/api/v1/gems/rails.json')
        .reply(200);
      expect(await getPkgReleases(params)).toBeNull();
    });

    it('returns null for rubygems.org package miss', async () => {
      const newparams = { ...params };
      newparams.registryUrls = [];
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(404, rubygemsOrgVersions);
      const res = await getPkgReleases(newparams);
      expect(res).toBeNull();
    });

    it('returns null for an error without "not_supported" reason', async () => {
      const newparams = {
        ...params,
        registryUrls: [],
      };

      const versionsdataSourceSpy = jest
        .spyOn(VersionsDatasource.prototype, 'syncVersions')
        .mockImplementationOnce(() => {
          throw new Error();
        });

      try {
        const res = await getPkgReleases(newparams);
        expect(res).toBeNull();
      } finally {
        versionsdataSourceSpy.mockRestore();
      }
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
      expect(res?.releases).toHaveLength(2);
      expect(res).toMatchSnapshot();
      expect(
        res?.releases.find((release) => release.version === '0.1.1')
      ).toBeDefined();
      expect(
        res?.releases.find((release) => release.version === '0.1.2')
      ).toBeUndefined();
    });

    it('returns a dep for a package hit on an arbitrary registry that only supports old format endpoints', async () => {
      const contribsysComVersions = `
        created_at: 2022-06-15T17:10:25+00:00
        ---
        sidekiq-ent 0.7.10,1.0.0,1.0.1,1.2.4,2.0.0,2.1.2 4c0f62a49b15b4775b7fb6824ec34d45
      `;
      const newparams = {
        ...params,
        packageName: 'sidekiq-ent',
        registryUrls: ['https://enterprise.contribsys.com'],
      };
      httpMock
        .scope('https://enterprise.contribsys.com')
        .get('/versions')
        .reply(200, contribsysComVersions);
      const res = await getPkgReleases(newparams);
      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(6);
      expect(res).toMatchObject({
        registryUrl: 'https://enterprise.contribsys.com',
        releases: expect.arrayContaining([
          {
            version: '0.7.10',
          },
          {
            version: '1.0.0',
          },
        ]),
      });
      expect(
        res?.releases.find((release) => release.version === '2.1.2')
      ).toBeDefined();
      expect(
        res?.releases.find((release) => release.version === '2.1.3')
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
      expect(res?.releases).toHaveLength(2);
      expect(res).toMatchSnapshot();
    });

    it('works with real data', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/api/v1/versions/rails.json')
        .reply(200, railsVersions);

      const res = await getPkgReleases(params);
      expect(res?.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
    });

    it('uses multiple source urls', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/gems/rails.json')
        .reply(401);
      httpMock
        .scope('https://firstparty.com/')
        .get('/basepath/versions')
        .reply(404)
        .get('/basepath/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/basepath/api/v1/versions/rails.json')
        .reply(200, railsVersions);

      const res = await getPkgReleases(params);
      expect(res?.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
    });

    it('returns null if mismatched name', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/gems/rails.json')
        .reply(200, { ...railsInfo, name: 'oooops' });
      httpMock
        .scope('https://firstparty.com/')
        .get('/basepath/versions')
        .reply(404)
        .get('/basepath/api/v1/gems/rails.json')
        .reply(200);
      expect(await getPkgReleases(params)).toBeNull();
    });

    it('falls back to info when version request fails', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/api/v1/versions/rails.json')
        .reply(400, {});
      const res = await getPkgReleases(params);
      expect(res?.releases).toHaveLength(1);
      expect(res?.releases[0].version).toBe(railsInfo.version);
    });

    it('errors when version request fails with anything other than 400 or 404', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/gems/rails.json')
        .reply(200, railsInfo)
        .get('/api/v1/versions/rails.json')
        .reply(500, {});
      httpMock
        .scope('https://firstparty.com/basepath')
        .get('/versions')
        .reply(404)
        .get('/api/v1/gems/rails.json')
        .reply(500);
      expect(await getPkgReleases(params)).toBeNull();
    });

    it('falls back to dependencies api', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
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
        .get('/versions')
        .reply(404)
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, emptyMarshalArray);
      expect(await getPkgReleases(newparams)).toBeNull();
    });

    it('returns a dep for GitHub Packages package hit', async () => {
      const newparams = { ...params };
      newparams.registryUrls = ['https://rubygems.pkg.github.com/example'];
      httpMock
        .scope('https://rubygems.pkg.github.com/example')
        .get('/versions')
        .reply(404)
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, railsDependencies);
      const res = await getPkgReleases(newparams);
      expect(res?.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
    });
  });
});

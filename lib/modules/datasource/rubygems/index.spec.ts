import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { ExternalHostError } from '../../../types/errors/external-host-error';
import * as rubyVersioning from '../../versioning/ruby';
import { memCache } from './versions-endpoint-cache';
import { RubyGemsDatasource } from '.';

const rubygemsOrgVersions = Fixtures.get('rubygems-org.txt');
const railsInfo = Fixtures.getJson('rails/info.json');
const railsVersions = Fixtures.getJson('rails/versions.json');
const railsDependencies = Fixtures.getBinary('dependencies-rails.dat');
const emptyMarshalArray = Buffer.from([4, 8, 91, 0]);

describe('modules/datasource/rubygems/index', () => {
  describe('getReleases', () => {
    beforeEach(() => {
      memCache.clear();
      jest.resetAllMocks();
    });

    it('returns null for missing pkg', async () => {
      httpMock
        .scope('https://firstparty.com')
        .get('/basepath/versions')
        .reply(404)
        .get('/basepath/api/v1/versions/rails.json')
        .reply(200, [])
        .get('/basepath/api/v1/dependencies?gems=rails')
        .reply(200, emptyMarshalArray);
      httpMock
        .scope('https://thirdparty.com')
        .get('/versions')
        .reply(404)
        .get('/api/v1/versions/rails.json')
        .reply(200, [])
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, emptyMarshalArray);
      expect(
        await getPkgReleases({
          versioning: rubyVersioning.id,
          datasource: RubyGemsDatasource.id,
          packageName: 'rails',
          registryUrls: [
            'https://thirdparty.com',
            'https://firstparty.com/basepath/',
          ],
        })
      ).toBeNull();
    });

    it('returns null for rubygems.org package miss', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(404, rubygemsOrgVersions);
      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'rails',
        registryUrls: [],
      });
      expect(res).toBeNull();
    });

    it('returns a dep for rubygems.org package hit', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, rubygemsOrgVersions)
        .get('/api/v1/gems/1pass.json')
        .reply(200, { name: '1pass' })
        .get('/api/v1/versions/1pass.json')
        .reply(200, [
          { number: '0.1.0', created_at: '2020-01-01' },
          { number: '0.1.1', created_at: '2021-01-01' },
        ]);

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: '1pass',
        registryUrls: [],
      });

      expect(res).toMatchObject({
        releases: [{ version: '0.1.0' }, { version: '0.1.1' }],
      });
    });

    it('uses rubygems.org if no registry urls were provided', async () => {
      httpMock
        .scope('https://rubygems.org')
        .get('/versions')
        .reply(200, rubygemsOrgVersions)
        .get('/api/v1/gems/1pass.json')
        .reply(200, { name: '1pass' })
        .get('/api/v1/versions/1pass.json')
        .reply(200, [
          { number: '0.1.0', created_at: '2020-01-01' },
          { number: '0.1.1', created_at: '2021-01-01' },
        ]);

      expect(
        await getPkgReleases({
          versioning: rubyVersioning.id,
          datasource: RubyGemsDatasource.id,
          packageName: 'rails',
          registryUrls: [],
        })
      ).toBeNull();

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: '1pass',
        registryUrls: [],
      });

      expect(res).toMatchObject({
        releases: [{ version: '0.1.0' }, { version: '0.1.1' }],
      });
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

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'rails',
        registryUrls: [
          'https://thirdparty.com',
          'https://firstparty.com/basepath/',
        ],
      });
      expect(res?.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
    });

    it('uses multiple source urls', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/versions/rails.json')
        .reply(400)
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, emptyMarshalArray);
      httpMock
        .scope('https://firstparty.com/')
        .get('/basepath/versions')
        .reply(404)
        .get('/basepath/api/v1/versions/rails.json')
        .reply(200, railsVersions)
        .get('/basepath/api/v1/gems/rails.json')
        .reply(200, railsInfo);

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'rails',
        registryUrls: [
          'https://thirdparty.com',
          'https://firstparty.com/basepath/',
        ],
      });
      expect(res?.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
    });

    it('falls back to dependencies when other API requests fail', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/versions/rails.json')
        .reply(400, {})
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, railsDependencies);
      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'rails',
        registryUrls: ['https://thirdparty.com'],
      });
      expect(res?.releases).toHaveLength(339);
    });

    it('errors when version request fails with anything other than 400 or 404', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/versions/rails.json')
        .reply(500, {});
      await expect(
        getPkgReleases({
          versioning: rubyVersioning.id,
          datasource: RubyGemsDatasource.id,
          packageName: 'rails',
          registryUrls: [
            'https://thirdparty.com',
            'https://firstparty.com/basepath/',
          ],
        })
      ).rejects.toThrow(ExternalHostError);
    });

    it('falls back to dependencies api', async () => {
      httpMock
        .scope('https://thirdparty.com/')
        .get('/versions')
        .reply(404)
        .get('/api/v1/versions/rails.json')
        .reply(404, railsInfo)
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, railsDependencies);

      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'rails',
        registryUrls: ['https://thirdparty.com'],
      });
      expect(res?.releases).toHaveLength(339);
    });

    it('returns null for GitHub Packages package miss', async () => {
      httpMock
        .scope('https://rubygems.pkg.github.com/example')
        .get('/versions')
        .reply(404)
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, emptyMarshalArray);
      expect(
        await getPkgReleases({
          versioning: rubyVersioning.id,
          datasource: RubyGemsDatasource.id,
          packageName: 'rails',
          registryUrls: ['https://rubygems.pkg.github.com/example'],
        })
      ).toBeNull();
    });

    it('returns a dep for GitHub Packages package hit', async () => {
      httpMock
        .scope('https://rubygems.pkg.github.com/example')
        .get('/versions')
        .reply(404)
        .get('/api/v1/dependencies?gems=rails')
        .reply(200, railsDependencies);
      const res = await getPkgReleases({
        versioning: rubyVersioning.id,
        datasource: RubyGemsDatasource.id,
        packageName: 'rails',
        registryUrls: ['https://rubygems.pkg.github.com/example'],
      });
      expect(res?.releases).toHaveLength(339);
      expect(res).toMatchSnapshot();
    });
  });
});

import { getPkgReleases } from '..';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import * as perlVersioning from '../../versioning/perl';
import { CpanDatasource, resetCache } from '.';

const packagesDetails = Fixtures.get('02packages.details.txt');

describe('modules/datasource/cpan/index', () => {
  describe('getReleases', () => {
    const SKIP_CACHE = process.env.RENOVATE_SKIP_CACHE;

    const params = {
      versioning: perlVersioning.id,
      datasource: CpanDatasource.id,
      depName: 'Plack',
      registryUrls: [],
    };

    beforeEach(() => {
      resetCache();
      process.env.RENOVATE_SKIP_CACHE = 'true';
      jest.resetAllMocks();
    });

    afterEach(() => {
      process.env.RENOVATE_SKIP_CACHE = SKIP_CACHE;
    });

    it('returns null for www.cpan.org package miss', async () => {
      const newparams = { ...params };
      httpMock
        .scope('https://www.cpan.org')
        .get('/modules/02packages.details.txt')
        .reply(200, packagesDetails);
      const res = await getPkgReleases(newparams);
      expect(res).toBeNull();
    });

    it('returns a dep for www.cpan.org package hit (*.tar.gz)', async () => {
      const newparams = {
        ...params,
        packageName: 'AAAA::Mail::SpamAssassin',
      };
      httpMock
        .scope('https://www.cpan.org')
        .get('/modules/02packages.details.txt')
        .reply(200, packagesDetails);
      const res = await getPkgReleases(newparams);
      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(1);
      expect(res).toMatchSnapshot();
      expect(
        res?.releases.find((release) => release.version === '0.002')
      ).toBeDefined();
    });

    it('returns a dep for www.cpan.org package hit (*.tgz)', async () => {
      const newparams = {
        ...params,
        packageName: 'Regexp::Assemble',
      };
      httpMock
        .scope('https://www.cpan.org')
        .get('/modules/02packages.details.txt')
        .reply(200, packagesDetails);
      const res = await getPkgReleases(newparams);
      expect(res).not.toBeNull();
      expect(res?.releases).toHaveLength(1);
      expect(res).toMatchSnapshot();
      expect(
        res?.releases.find((release) => release.version === '0.38')
      ).toBeDefined();
    });
  });
});

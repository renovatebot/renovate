import { GetPkgReleasesConfig, getPkgReleases } from '..';
import { DebLanguageConfig } from './types';
// import * as httpMock from '../../../test/http-mock';

describe('datasource/deb/index', () => {
  describe('getReleases', () => {
    it('returns a valid version for the package `curl` (standard Debian package)', async () => {
      const cfg: GetPkgReleasesConfig & DebLanguageConfig = {
        datasource: 'deb',
        depName: 'curl',
        deb: {
          binaryArch: 'amd64',
          downloadDirectory: '/tmp/deb/download',
          extractionDirectory: '/tmp/deb/extract',
        },
      };
      const res = await getPkgReleases(cfg);
      expect(res).toBeObject();
      expect(res.releases).toHaveLength(1);
    });

    it('returns null for a package not found in the standard Debian package repo', async () => {
      const cfg: GetPkgReleasesConfig & DebLanguageConfig = {
        datasource: 'deb',
        depName: 'you-will-never-find-me',
        deb: {
          binaryArch: 'amd64',
          downloadDirectory: '/tmp/deb/download',
          extractionDirectory: '/tmp/deb/extract',
        },
      };
      const res = await getPkgReleases(cfg);
      expect(res).toBeNull();
    });

    it('returns null when repo contains missing component', async () => {
      const cfg: GetPkgReleasesConfig & DebLanguageConfig = {
        datasource: 'deb',
        depName: 'curl',
        deb: {
          binaryArch: 'amd64',
          downloadDirectory: '/tmp/deb/download',
          extractionDirectory: '/tmp/deb/extract',
        },
        registryUrls: ['deb https://ftp.debian.org/debian stable'],
      };
      const res = await getPkgReleases(cfg);
      expect(res).toBeNull();
    });
  });
});

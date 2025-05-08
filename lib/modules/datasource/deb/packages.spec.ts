import { readFileSync } from 'fs';
import { retrievePackagesBaseURLFromReleaseFile } from './packages';
import { Fixtures } from '~test/fixtures';

describe('modules/datasource/deb/packages', () => {
  const fixtureInRelease = readFileSync(Fixtures.getPath('InRelease'), 'utf-8');

  const fixtureInReleaseBookworm = readFileSync(
    Fixtures.getPath('InReleaseBookworm'),
    'utf-8',
  );

  const fixtureInReleaseInvalid = readFileSync(
    Fixtures.getPath('InReleaseInvalid'),
    'utf-8',
  );

  describe('retrievePackagesBaseURLFromReleaseFile', () => {
    it('retrieves Packages.xz file from the release file', () => {
      const packageBaseUrl = 'main/binary-arm64/';

      const { hash, packagesFile } = retrievePackagesBaseURLFromReleaseFile(
        fixtureInRelease,
        packageBaseUrl,
      );

      expect(hash).toEqual(
        '14fd8848875e988f92d00d0baeb058c068b8352d537d2836eb1f0a6633c7cdd2',
      );

      expect(packagesFile).toEqual(`${packageBaseUrl}Packages.xz`);
    });

    it('retrieve Packages.xz if there is only Packages.xz available', () => {
      const { hash, packagesFile } = retrievePackagesBaseURLFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/binary-arm64/',
      );

      expect(hash).toEqual(
        'e6334c735d1e2485ec9391c822fb133f18d18c27dc880a2678017f0365142543',
      );

      expect(packagesFile).toEqual('main/binary-arm64/Packages.xz');
    });

    it('retrieve Packages file if no compression is available', () => {
      const { hash, packagesFile } = retrievePackagesBaseURLFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/binary-mipsel/',
      );

      expect(hash).toEqual(
        'ffd78fe14e1cc1883029fce4d128d2f8eb81bf338a64e2318251e908a714c987',
      );

      expect(packagesFile).toEqual('main/binary-mipsel/Packages');
    });

    it('no packages file found', () => {
      const { hash, packagesFile } = retrievePackagesBaseURLFromReleaseFile(
        fixtureInReleaseBookworm,
        'main/non-existend/',
      );

      expect(hash).toEqual('');
      expect(packagesFile).toEqual('');
    });

    it('do not match invalid release file lines', () => {
      const { hash, packagesFile } = retrievePackagesBaseURLFromReleaseFile(
        fixtureInReleaseInvalid,
        'non-free/binary-s390x/',
      );

      expect(hash).toEqual('');
      expect(packagesFile).toEqual('');
    });
  });
});

import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('modules/manager/swift-xcode/index', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty content', () => {
      expect(extractPackageFile(null)).toBeNull();
      expect(extractPackageFile(``)).toBeNull();
      expect(extractPackageFile(`// !$*UTF8*$!`)).toBeNull();
    });

    it('returns null for invalid content', () => {
      expect(
        extractPackageFile(`Begin XCRemoteSwiftPackageReference section`)
      ).toBeNull();
      expect(
        extractPackageFile(`/* Begin XCRemoteSwiftPackageReference section */`)
      ).toBeNull();
      expect(
        extractPackageFile(
          `/* Begin XCRemoteSwiftPackageReference section */ /* End XCRemoteSwiftPackageReference section */`
        )
      ).toBeNull();
    });

    it('returns null for invalid parameters', () => {
      expect(
        extractPackageFile(`Begin XCRemoteSwiftPackageReference section`)
      ).toBeNull();
      expect(
        extractPackageFile(`/* Begin XCRemoteSwiftPackageReference section */`)
      ).toBeNull();

      expect(
        extractPackageFile(
          // no package name
          `/* Begin XCRemoteSwiftPackageReference section */
          1671F0B028099F69001CAE81 /* XCRemoteSwiftPackageReference */ = {
            isa = XCRemoteSwiftPackageReference;
            repositoryURL = "https://github.com/pointfreeco/swift-snapshot-testing";
            requirement = {
              kind = upToNextMajorVersion;
              minimumVersion = 1.0.0;
            };
          };
        /* End XCRemoteSwiftPackageReference section */`
        )
      ).toBeNull();

      expect(
        extractPackageFile(
          // invalid ISA
          `/* Begin XCRemoteSwiftPackageReference section */
          1671F0B028099F69001CAE81 /* XCRemoteSwiftPackageReference */ = {
            isa = XCLocalSwiftPackageReference;
            repositoryURL = "https://github.com/pointfreeco/swift-snapshot-testing";
            requirement = {
              kind = upToNextMajorVersion;
              minimumVersion = 1.0.0;
            };
          };
        /* End XCRemoteSwiftPackageReference section */`
        )
      ).toBeNull();

      expect(
        extractPackageFile(
          // unknown requirement
          `/* Begin XCRemoteSwiftPackageReference section */
          1671F0B028099F69001CAE81 /* XCRemoteSwiftPackageReference */ = {
            isa = XCLocalSwiftPackageReference;
            repositoryURL = "https://github.com/pointfreeco/swift-snapshot-testing";
            requirement = {
              kind = upToNextPatchVersion;
              minimumVersion = 1.0.0;
            };
          };
        /* End XCRemoteSwiftPackageReference section */`
        )
      ).toBeNull();

      expect(
        extractPackageFile(
          // missing requirement
          `/* Begin XCRemoteSwiftPackageReference section */
          1671F0B028099F69001CAE81 /* XCRemoteSwiftPackageReference */ = {
            isa = XCLocalSwiftPackageReference;
            repositoryURL = "https://github.com/pointfreeco/swift-snapshot-testing";
          };
        /* End XCRemoteSwiftPackageReference section */`
        )
      ).toBeNull();
    });

    it('parses package descriptions', () => {
      expect(
        extractPackageFile(
          `/* Begin XCRemoteSwiftPackageReference section */
          1671F0B028099F69001CAE81 /* XCRemoteSwiftPackageReference "swift-snapshot-testing" */ = {
            isa = XCRemoteSwiftPackageReference;
            repositoryURL = "https://github.com/pointfreeco/swift-snapshot-testing";
            requirement = {
              kind = upToNextMajorVersion;
              minimumVersion = 1.0.0;
            };
          };
        /* End XCRemoteSwiftPackageReference section */`
        ).deps[0]
      ).toEqual(
        expect.objectContaining({
          packageName: 'swift-snapshot-testing',
          currentValue: '"1.0.0"..<"2.0.0"',
        })
      );
    });

    it('parses multiple packages', () => {
      expect(
        extractPackageFile(Fixtures.get(`project.pbxproj`))
      ).toMatchSnapshot();
    });
  });
});

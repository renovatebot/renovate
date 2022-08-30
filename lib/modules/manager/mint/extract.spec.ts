import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const simpleMintfile = Fixtures.get('simple.Mintfile');
const noVersionMintfile = Fixtures.get('noVersion.Mintfile');

const complexMintFileContent = `
SwiftGen/SwiftGen@6.6.1
yonaskolb/xcodegen
realm/SwiftLint @ 0.48.0`;

const includesCommentOutMintFileContent = `
SwiftGen/SwiftGen@6.6.1
yonaskolb/xcodegen
#yonaskolb/xcodegen
realm/SwiftLint@0.48.0 #commented out
`;

describe('modules/manager/mint/extract', () => {
  describe('extractPackageFile()', () => {
    it('Mintfile With Version Description', () => {
      const res = extractPackageFile(simpleMintfile);
      expect(res).toEqual({
        deps: [
          {
            depName: 'SwiftGen/SwiftGen',
            currentValue: '6.6.1',
            datasource: 'git-tags',
            packageName: 'https://github.com/SwiftGen/SwiftGen.git',
          },
          {
            depName: 'yonaskolb/xcodegen',
            currentValue: '2.30.0',
            datasource: 'git-tags',
            packageName: 'https://github.com/yonaskolb/xcodegen.git',
          },
          {
            depName: 'realm/SwiftLint',
            currentValue: '0.48.0',
            datasource: 'git-tags',
            packageName: 'https://github.com/realm/SwiftLint.git',
          },
        ],
      });
    });

    it('Makefile Without Version Description', () => {
      const res = extractPackageFile(noVersionMintfile);
      expect(res).toEqual({
        deps: [
          {
            depName: 'yonaskolb/xcodegen',
            currentValue: null,
            skipReason: 'no-version',
            packageName: 'https://github.com/yonaskolb/xcodegen.git',
          },
          {
            depName: 'realm/SwiftLint',
            currentValue: null,
            skipReason: 'no-version',
            packageName: 'https://github.com/realm/SwiftLint.git',
          },
        ],
      });
    });

    it('Complex Makefile', () => {
      const res = extractPackageFile(complexMintFileContent);
      expect(res).toEqual({
        deps: [
          {
            depName: 'SwiftGen/SwiftGen',
            currentValue: '6.6.1',
            datasource: 'git-tags',
            packageName: 'https://github.com/SwiftGen/SwiftGen.git',
          },
          {
            depName: 'yonaskolb/xcodegen',
            currentValue: null,
            skipReason: 'no-version',
            packageName: 'https://github.com/yonaskolb/xcodegen.git',
          },
          {
            depName: 'realm/SwiftLint',
            currentValue: '0.48.0',
            datasource: 'git-tags',
            packageName: 'https://github.com/realm/SwiftLint.git',
          },
        ],
      });
    });

    it('Mintfile Includes Commented Out', () => {
      const res = extractPackageFile(includesCommentOutMintFileContent);
      expect(res).toEqual({
        deps: [
          {
            depName: 'SwiftGen/SwiftGen',
            currentValue: '6.6.1',
            datasource: 'git-tags',
            packageName: 'https://github.com/SwiftGen/SwiftGen.git',
          },
          {
            currentValue: null,
            depName: 'yonaskolb/xcodegen',
            packageName: 'https://github.com/yonaskolb/xcodegen.git',
            skipReason: 'no-version',
          },
        ],
      });
    });
  });
});

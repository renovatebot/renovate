import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const simpleMintfile = Fixtures.get('Mintfile');

const noVersionMintfileContent = `
yonaskolb/xcodegen
realm/SwiftLint
`;

const complexMintFileContent = `
SwiftGen/SwiftGen@6.6.1
yonaskolb/xcodegen
realm/SwiftLint @ 0.48.0`;

const includesCommentedOutMintFileContent = `
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

    it('Mintfile Without Version Description', () => {
      const res = extractPackageFile(noVersionMintfileContent);
      expect(res).toEqual({
        deps: [
          {
            depName: 'yonaskolb/xcodegen',
            currentValue: null,
            skipReason: 'no-version',
            datasource: 'git-tags',
            packageName: 'https://github.com/yonaskolb/xcodegen.git',
          },
          {
            depName: 'realm/SwiftLint',
            currentValue: null,
            skipReason: 'no-version',
            datasource: 'git-tags',
            packageName: 'https://github.com/realm/SwiftLint.git',
          },
        ],
      });
    });

    it('Complex Mintfile', () => {
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
            depName: 'yonaskolb/xcodegen',
            currentValue: null,
            skipReason: 'no-version',
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
  });
});

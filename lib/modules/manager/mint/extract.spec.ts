import { codeBlock } from 'common-tags';
import { extractPackageFile } from '.';

describe('modules/manager/mint/extract', () => {
  describe('extractPackageFile()', () => {
    it('Mintfile With Version Description', () => {
      const res = extractPackageFile(codeBlock`
        SwiftGen/SwiftGen@6.6.1
        yonaskolb/xcodegen@2.30.0
        realm/SwiftLint @ 0.48.0
        #realm/SwiftLint @ 0.48.0
      `);
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
      const res = extractPackageFile(codeBlock`
        yonaskolb/xcodegen
        realm/SwiftLint
      `);
      expect(res).toEqual({
        deps: [
          {
            depName: 'yonaskolb/xcodegen',
            skipReason: 'unspecified-version',
          },
          {
            depName: 'realm/SwiftLint',
            skipReason: 'unspecified-version',
          },
        ],
      });
    });

    it('Complex Mintfile', () => {
      const res = extractPackageFile(codeBlock`
        SwiftGen/SwiftGen@6.6.1
        yonaskolb/xcodegen
        realm/SwiftLint @ 0.48.0
      `);
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
            skipReason: 'unspecified-version',
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
      const res = extractPackageFile(codeBlock`
        SwiftGen/SwiftGen@6.6.1

        yonaskolb/xcodegen
        #yonaskolb/xcodegen
        realm/SwiftLint@0.48.0 #commented out
      `);
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
            skipReason: 'unspecified-version',
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

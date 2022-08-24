import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const simpleMintfile = Fixtures.get('simple.Mintfile');
const noVersionMintfile = Fixtures.get('noVersion.Mintfile');
const complexMintfile = Fixtures.get('complex.Mintfile');

describe('modules/manager/mint/extract', () => {
  describe('extractPackageFile()', () => {
    it('Makefile With Version Description', () => {
      const res = extractPackageFile(simpleMintfile);
      expect(res).toEqual({ deps: [
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
      ]});
    });

    it('Makefile Without Version Description', () => {
      const res = extractPackageFile(noVersionMintfile);
      expect(res).toBeNull();
    });

    it('Complex Makefile', () => {
      const res = extractPackageFile(complexMintfile);
      expect(res!.deps).toEqual([
        {
          depName: 'SwiftGen/SwiftGen',
          currentValue: '6.6.1',
          datasource: 'git-tags',
          packageName: 'https://github.com/SwiftGen/SwiftGen.git',
        },
        {
          depName: 'realm/SwiftLint',
          currentValue: '0.48.0',
          datasource: 'git-tags',
          packageName: 'https://github.com/realm/SwiftLint.git',
        },
      ]);
    });
  });
});

import { extractPackageFile } from './extract';
import { Fixtures } from '~test/fixtures';

describe('modules/manager/devbox-version/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts version', () => {
      const res = extractPackageFile(Fixtures.get('.devbox-version'));
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '0.16.0',
          datasource: 'devbox-version',
        },
      ]);
    });

    it('extracts version with extra whitespace', () => {
      const res = extractPackageFile(
        Fixtures.get('.devbox-version-with-whitespace'),
      );
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '0.16.0',
          datasource: 'devbox-version',
        },
      ]);
    });

    it('extracts pre-release version', () => {
      const res = extractPackageFile(
        Fixtures.get('.devbox-version-prerelease'),
      );
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '0.17.0-beta.1',
          datasource: 'devbox-version',
        },
      ]);
    });

    it('extracts empty file', () => {
      const res = extractPackageFile(Fixtures.get('.devbox-version-empty'));
      expect(res.deps).toEqual([
        {
          depName: 'devbox',
          currentValue: '',
          datasource: 'devbox-version',
        },
      ]);
    });
  });
});

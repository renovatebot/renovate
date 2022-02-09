import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('manager/tool-versions/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('', '.tool-versions', {})).toBeNull();
    });

    it('extracts dependencies for supported tools', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions'),
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: '10.15.0',
            datasource: 'npm',
            depName: 'nodejs',
          },
          {
            currentDigest: 'v1.0.2-a',
            currentValue: 'ref:v1.0.2-a',
            datasource: 'pypi',
            depName: 'python',
          },
          {
            currentDigest: '39cb398vb39',
            currentValue: 'ref:39cb398vb39',
            datasource: 'ruby-version',
            depName: 'ruby',
          },
        ],
      });
    });

    it('handles multiple version fallback dependencies', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions-multiple'),
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: '3.7.2',
            datasource: 'pypi',
            depName: 'python',
          },
        ],
      });
    });

    it('handles unsupported datasources', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions-unsupported-datasource'),
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            depName: 'some-unknown-datasource',
            skipReason: 'unsupported-datasource',
          },
        ],
      });
    });

    it('skips unsupported versions', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions-unsupported-version'),
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: 'path:/some/local/dir',
            datasource: 'npm',
            depName: 'nodejs',
            skipReason: 'unsupported-version',
          },
          {
            currentValue: 'system',
            datasource: 'ruby-version',
            depName: 'ruby',
            skipReason: 'unsupported-version',
          },
        ],
      });
    });

    it('handles invalid deps', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions-invalid'),
        'unused_file_name',
        {}
      );
      expect(res).toBeNull();
    });

    it('handles comments', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions-with-comments'),
        'unused_file_name',
        {}
      ).deps;
      expect(res).toEqual([
        {
          currentValue: '2.5.3',
          datasource: 'ruby-version',
          depName: 'ruby',
        },
        {
          currentValue: '10.15.0',
          datasource: 'npm',
          depName: 'nodejs',
        },
      ]);
    });

    it('skips deps with ignore comments', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions-with-ignore-comments'),
        'unused_file_name',
        {}
      ).deps;
      expect(res).toEqual([
        {
          currentValue: '2.5.3',
          datasource: 'ruby-version',
          depName: 'ruby',
        },
        {
          currentValue: '10.15.0',
          datasource: 'npm',
          depName: 'nodejs',
          skipReason: 'ignored',
        },
      ]);
    });
  });
});

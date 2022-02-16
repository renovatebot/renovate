import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

describe('manager/tool-versions/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('', '.tool-versions', {})).toBeNull();
    });

    it('extracts dep versions for supported tools', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions'),
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: '10.15.0',
            currentVersion: '10.15.0',
            datasource: 'github-tags',
            depName: 'nodejs',
            lookupName: 'nodejs/node',
          },
          {
            currentValue: '3.2.5',
            currentVersion: '3.2.5',
            datasource: 'ruby-version',
            depName: 'ruby',
          },
          {
            currentValue: '2.1.3',
            currentVersion: '2.1.3',
            datasource: 'github-tags',
            depName: 'python',
            lookupName: 'python/cpython',
          },
        ],
      });
    });

    it('extracts dep digests for supported tools', () => {
      const res = extractPackageFile(
        Fixtures.get('.tool-versions-refs'),
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentDigest: '10.15.0',
            currentRawValue: 'ref:10.15.0',
            datasource: 'git-refs',
            depName: 'nodejs',
            lookupName: 'https://github.com/nodejs/node.git',
          },
          {
            currentDigest: '39cb398vb39',
            currentRawValue: 'ref:39cb398vb39',
            datasource: 'git-refs',
            depName: 'ruby',
            lookupName: 'https://github.com/ruby/ruby.git',
          },
          {
            currentDigest: 'v1.0.2-a',
            currentRawValue: 'ref:v1.0.2-a',
            datasource: 'git-refs',
            depName: 'python',
            lookupName: 'https://github.com/python/cpython.git',
          },
        ],
      });
    });

    it('handles multiple version fallback dependencies', () => {
      const res = extractPackageFile(
        'python 3.7.2 2.7.15 system\n',
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: '3.7.2',
            currentVersion: '3.7.2',
            datasource: 'github-tags',
            depName: 'python',
            lookupName: 'python/cpython',
          },
        ],
      });
    });

    it('handles unsupported datasources', () => {
      const res = extractPackageFile(
        'some-unknown-datasource 1.2.3\n',
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
        'nodejs path:/some/local/dir\nruby system\npython non-semver\n',
        'unused_file_name',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: 'path:/some/local/dir',
            datasource: 'github-tags',
            depName: 'nodejs',
            lookupName: 'nodejs/node',
            skipReason: 'unsupported-version',
          },
          {
            currentValue: 'system',
            datasource: 'ruby-version',
            depName: 'ruby',
            skipReason: 'unsupported-version',
          },
          {
            currentValue: 'non-semver',
            datasource: 'github-tags',
            depName: 'python',
            lookupName: 'python/cpython',
            skipReason: 'unsupported-version',
          },
        ],
      });
    });

    it('handles invalid deps', () => {
      const res = extractPackageFile('invalid\n', 'unused_file_name', {});
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
          currentVersion: '2.5.3',
          datasource: 'ruby-version',
          depName: 'ruby',
        },
        {
          currentValue: '10.15.0',
          currentVersion: '10.15.0',
          datasource: 'github-tags',
          depName: 'nodejs',
          lookupName: 'nodejs/node',
        },
      ]);
    });

    it('skips deps with ignore comments', () => {
      const res = extractPackageFile(
        'ruby 2.5.3 # This is a comment\nnodejs 10.15.0 # renovate:ignore\n',
        'unused_file_name',
        {}
      ).deps;
      expect(res).toEqual([
        {
          currentValue: '2.5.3',
          currentVersion: '2.5.3',
          datasource: 'ruby-version',
          depName: 'ruby',
        },
        {
          currentValue: '10.15.0',
          currentVersion: '10.15.0',
          datasource: 'github-tags',
          depName: 'nodejs',
          lookupName: 'nodejs/node',
          skipReason: 'ignored',
        },
      ]);
    });
  });
});

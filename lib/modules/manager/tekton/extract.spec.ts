import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/tekton/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts deps from a file', () => {
      const result = extractPackageFile(
        Fixtures.get('multi-doc.yaml'),
        'test-file.yaml',
      );
      expect(result).toMatchSnapshot();
      expect(result?.deps).toHaveLength(39);
    });

    it('extracts deps from a file in annotations', () => {
      const result = extractPackageFile(
        Fixtures.get('multi-doc-annotations.yaml'),
        'test-file.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v0.0.4',
            datasource: 'github-releases',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'foo/bar',
          },
          {
            currentValue: 'v0.0.12',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
          {
            currentValue: 'v0.0.6',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.12',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
          {
            currentValue: 'v0.0.8',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.14',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
          {
            currentValue: 'v0.0.9',
            datasource: 'github-releases',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'foo/bar',
          },
          {
            currentValue: 'v0.0.7',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.5',
            datasource: 'git-tags',
            depName: 'github.com/foo/bar',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/bar',
          },
          {
            currentValue: 'v0.0.25',
            datasource: 'git-tags',
            depName: 'github.com/foo/baz',
            depType: 'tekton-annotation',
            packageName: 'https://github.com/foo/baz',
          },
        ],
      });
    });

    it('ignores file without any deps', () => {
      expect(extractPackageFile('foo: bar', 'test-file.yaml')).toBeNull();
    });

    it('ignores invalid YAML', () => {
      expect(
        extractPackageFile(
          `
        ---
        bundle: registry.com/repo
      `,
          'test-file.yaml',
        ),
      ).toBeNull();
    });

    it('ignores empty file', () => {
      expect(extractPackageFile('', 'test-file.yaml')).toBeNull();
    });
  });
});

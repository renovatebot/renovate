import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const jsonnetfile = Fixtures.get('jsonnetfile.json');
const jsonnetfileWithName = Fixtures.get('jsonnetfile-with-name.json');
const jsonnetfileNoDependencies = Fixtures.get(
  'jsonnetfile-no-dependencies.json',
);
const jsonnetfileLocalDependencies = Fixtures.get(
  'jsonnetfile-local-dependencies.json',
);
const jsonnetfileEmptyGitSource = JSON.stringify({
  version: 1,
  dependencies: [
    {
      source: { git: {} },
      version: 'v0.50.0',
    },
  ],
});

describe('modules/manager/jsonnet-bundler/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid jsonnetfile', () => {
      expect(
        extractPackageFile('this is not a jsonnetfile', 'jsonnetfile.json'),
      ).toBeNull();
    });

    it('returns null for jsonnetfile with no dependencies', () => {
      expect(
        extractPackageFile(jsonnetfileNoDependencies, 'jsonnetfile.json'),
      ).toBeNull();
    });

    it('returns null for local dependencies', () => {
      expect(
        extractPackageFile(jsonnetfileLocalDependencies, 'jsonnetfile.json'),
      ).toBeNull();
    });

    it('returns null for vendored dependencies', () => {
      expect(
        extractPackageFile(jsonnetfile, 'vendor/jsonnetfile.json'),
      ).toBeNull();
    });

    it('returns null for dependencies with empty Git source', () => {
      expect(
        extractPackageFile(
          jsonnetfileEmptyGitSource,
          'jsonnetfile-empty-git-source.json',
        ),
      ).toBeNull();
    });

    it('extracts dependency', () => {
      const res = extractPackageFile(jsonnetfile, 'jsonnetfile.json');
      expect(res).toMatchSnapshot({
        deps: [
          {
            depName:
              'github.com/prometheus-operator/prometheus-operator/jsonnet/prometheus-operator',
            packageName:
              'https://github.com/prometheus-operator/prometheus-operator.git',
            currentValue: 'v0.50.0',
          },
          {
            depName:
              'github.com/prometheus-operator/kube-prometheus/jsonnet/kube-prometheus',
            packageName:
              'ssh://git@github.com/prometheus-operator/kube-prometheus.git',
            currentValue: 'v0.9.0',
          },
        ],
      });
    });

    it('extracts dependency with custom name', () => {
      const res = extractPackageFile(jsonnetfileWithName, 'jsonnetfile.json');
      expect(res).toMatchSnapshot({
        deps: [
          {
            depName:
              'github.com/prometheus-operator/prometheus-operator/jsonnet/mixin',
            packageName:
              'https://github.com/prometheus-operator/prometheus-operator',
            currentValue: 'v0.50.0',
          },
        ],
      });
    });
  });
});

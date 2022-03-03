import { loadFixture } from '../../../../test/util';
import { extractPackageFile } from '.';

const jsonnetfile = loadFixture('jsonnetfile.json');
const jsonnetfileWithName = loadFixture('jsonnetfile-with-name.json');
const jsonnetfileNoDependencies = loadFixture(
  'jsonnetfile-no-dependencies.json'
);
const jsonnetfileLocalDependencies = loadFixture(
  'jsonnetfile-local-dependencies.json'
);

describe('modules/manager/jsonnet-bundler/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for invalid jsonnetfile', () => {
      expect(
        extractPackageFile('this is not a jsonnetfile', 'jsonnetfile.json')
      ).toBeNull();
    });
    it('returns null for jsonnetfile with no dependencies', () => {
      expect(
        extractPackageFile(jsonnetfileNoDependencies, 'jsonnetfile.json')
      ).toBeNull();
    });
    it('returns null for local dependencies', () => {
      expect(
        extractPackageFile(jsonnetfileLocalDependencies, 'jsonnetfile.json')
      ).toBeNull();
    });
    it('returns null for vendored dependencies', () => {
      expect(
        extractPackageFile(jsonnetfile, 'vendor/jsonnetfile.json')
      ).toBeNull();
    });
    it('extracts dependency', () => {
      const res = extractPackageFile(jsonnetfile, 'jsonnetfile.json');
      expect(res).toMatchSnapshot({
        deps: [
          {
            depName: 'prometheus-operator',
            lookupName:
              'https://github.com/prometheus-operator/prometheus-operator.git',
            currentValue: 'v0.50.0',
          },
          {
            depName: 'kube-prometheus',
            lookupName:
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
            depName: 'prometheus-operator-mixin',
            lookupName:
              'https://github.com/prometheus-operator/prometheus-operator',
            currentValue: 'v0.50.0',
          },
        ],
      });
    });
  });
});

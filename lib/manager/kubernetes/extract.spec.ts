import { loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const kubernetesImagesFile = loadFixture('kubernetes.yaml');
const kubernetesConfigMapFile = loadFixture('configmap.yaml');
const kubernetesArraySyntaxFile = loadFixture('array-syntax.yaml');
const otherYamlFile = loadFixture('gitlab-ci.yaml');

describe('manager/kubernetes/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile(kubernetesConfigMapFile)).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(kubernetesImagesFile);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('extracts image line in a YAML array', () => {
      const res = extractPackageFile(kubernetesArraySyntaxFile);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('ignores non-Kubernetes YAML files', () => {
      expect(extractPackageFile(otherYamlFile)).toBeNull();
    });
  });
});

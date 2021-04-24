import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const kubernetesImagesFile = loadFixture(__filename, 'kubernetes.yaml');
const kubernetesConfigMapFile = loadFixture(__filename, 'configmap.yaml');
const kubernetesArraySyntaxFile = loadFixture(__filename, 'array-syntax.yaml');
const otherYamlFile = loadFixture(__filename, 'gitlab-ci.yaml');

describe(getName(__filename), () => {
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

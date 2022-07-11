import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const kubernetesImagesFile = Fixtures.get('kubernetes.yaml');
const kubernetesConfigMapFile = Fixtures.get('configmap.yaml');
const kubernetesArraySyntaxFile = Fixtures.get('array-syntax.yaml');
const otherYamlFile = Fixtures.get('gitlab-ci.yaml');

describe('modules/manager/kubernetes/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile(kubernetesConfigMapFile)).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const res = extractPackageFile(kubernetesImagesFile);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(2);
    });

    it('extracts image line in a YAML array', () => {
      const res = extractPackageFile(kubernetesArraySyntaxFile);
      expect(res?.deps).toMatchSnapshot();
      expect(res?.deps).toHaveLength(1);
    });

    it('ignores non-Kubernetes YAML files', () => {
      expect(extractPackageFile(otherYamlFile)).toBeNull();
    });
  });
});

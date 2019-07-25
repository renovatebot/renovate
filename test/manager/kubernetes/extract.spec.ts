import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/kubernetes/extract';

const kubernetesImagesFile = readFileSync(
  'test/manager/kubernetes/_fixtures/kubernetes.yaml',
  'utf8'
);

const kubernetesConfigMapFile = readFileSync(
  'test/manager/kubernetes/_fixtures/configmap.yaml',
  'utf8'
);

const kubernetesArraySyntaxFile = readFileSync(
  'test/manager/kubernetes/_fixtures/array-syntax.yaml',
  'utf8'
);

const otherYamlFile = readFileSync(
  'test/manager/kubernetes/_fixtures/gitlab-ci.yaml',
  'utf8'
);

describe('lib/manager/kubernetes/extract', () => {
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

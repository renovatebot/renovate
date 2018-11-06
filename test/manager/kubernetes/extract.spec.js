const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/kubernetes/extract');

const kubernetesImagesFile = fs.readFileSync(
  'test/_fixtures/kubernetes/kubernetes.yaml',
  'utf8'
);

const kubernetesConfigMapFile = fs.readFileSync(
  'test/_fixtures/kubernetes/configmap.yaml',
  'utf8'
);

const kubernetesArraySyntaxFile = fs.readFileSync(
  'test/_fixtures/kubernetes/array-syntax.yaml',
  'utf8'
);

const otherYamlFile = fs.readFileSync(
  'test/_fixtures/kubernetes/gitlab-ci.yaml',
  'utf8'
);

describe('lib/manager/kubernetes/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {
        fileMatch: ['(^|/)[^/]*\\.yaml$'],
      };
    });
    it('returns null for empty', () => {
      expect(extractPackageFile(kubernetesConfigMapFile, config)).toBe(null);
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile(kubernetesImagesFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('extracts image line in a YAML array', () => {
      const res = extractPackageFile(kubernetesArraySyntaxFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('ignores non-Kubernetes YAML files', () => {
      expect(extractPackageFile(otherYamlFile, config)).toBe(null);
    });
  });
});

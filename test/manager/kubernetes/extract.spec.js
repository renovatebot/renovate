const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/kubernetes/extract');

const kubernetesImagesFile = fs.readFileSync(
  'test/_fixtures/kubernetes/kubernetes.yaml',
  'utf8'
);

const kubernetesConfigMapFile = fs.readFileSync(
  'test/_fixtures/kubernetes/configmap.yaml',
  'utf8'
);

const otherYamlFile = fs.readFileSync(
  'test/_fixtures/kubernetes/gitlab-ci.yaml',
  'utf8'
);

describe('lib/manager/kubernetes/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {
        fileMatch: ['(^|/)[^/]*\\.yaml$'],
      };
    });
    it('returns null for empty', () => {
      expect(extractDependencies(kubernetesConfigMapFile, config)).toBe(null);
    });
    it('extracts multiple image lines', () => {
      const res = extractDependencies(kubernetesImagesFile, config);
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(2);
    });
    it('ignores non-Kubernetes YAML files', () => {
      expect(extractDependencies(otherYamlFile, config)).toBe(null);
    });
  });
});

const fs = require('fs');
const dcUpdate = require('../../../lib/manager/kubernetes/update');

const yamlFile = fs.readFileSync(
  'test/_fixtures/kubernetes/kubernetes.yaml',
  'utf8'
);

const arraySyntaxFile = fs.readFileSync(
  'test/_fixtures/kubernetes/array-syntax.yaml',
  'utf8'
);

describe('manager/kubernetes/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        lineNumber: 18,
        depName: 'nginx',
        newValue: '1.15.1',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        lineNumber: 46,
        dockerRegistry: 'k8s.gcr.io',
        depName: 'kube-proxy-amd64',
        newValue: 'v1.11.1',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        lineNumber: 1,
        newFrom: 'k8s.gcr.io/kube-proxy-amd64:v1.11.1',
      };
      const res = dcUpdate.updateDependency(yamlFile, upgrade);
      expect(res).toBe(null);
    });
    it('returns null if error', () => {
      const res = dcUpdate.updateDependency(null, null);
      expect(res).toBe(null);
    });
    it('replaces image inside YAML array', () => {
      const upgrade = {
        lineNumber: 14,
        dockerRegistry: 'quay.io',
        depName: 'external_storage/local-volume-provisioner',
        newValue: 'v2.2.0',
      };
      const res = dcUpdate.updateDependency(arraySyntaxFile, upgrade);
      expect(res).not.toEqual(arraySyntaxFile);
      expect(res).toMatchSnapshot();
    });
  });
});

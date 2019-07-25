import { readFileSync } from 'fs';
import { updateDependency } from '../../../lib/manager/kubernetes/update';

const yamlFile = readFileSync(
  'test/manager/kubernetes/_fixtures/kubernetes.yaml',
  'utf8'
);

const arraySyntaxFile = readFileSync(
  'test/manager/kubernetes/_fixtures/array-syntax.yaml',
  'utf8'
);

describe('manager/kubernetes/update', () => {
  describe('updateDependency', () => {
    it('replaces existing value', () => {
      const upgrade = {
        managerData: { lineNumber: 18 },
        depName: 'nginx',
        newValue: '1.15.1',
        newDigest: 'sha256:abcdefghijklmnop',
      };
      const res = updateDependency(yamlFile, upgrade);
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 46 },
        depName: 'k8s.gcr.io/kube-proxy-amd64',
        newValue: 'v1.11.1',
      };
      const res = updateDependency(yamlFile, upgrade);
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 1 },
        newFrom: 'k8s.gcr.io/kube-proxy-amd64:v1.11.1',
      };
      const res = updateDependency(yamlFile, upgrade);
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency(null, null);
      expect(res).toBeNull();
    });
    it('replaces image inside YAML array', () => {
      const upgrade = {
        managerData: { lineNumber: 14 },
        depName: 'quay.io/external_storage/local-volume-provisioner',
        newValue: 'v2.2.0',
      };
      const res = updateDependency(arraySyntaxFile, upgrade);
      expect(res).not.toEqual(arraySyntaxFile);
      expect(res).toMatchSnapshot();
    });
  });
});

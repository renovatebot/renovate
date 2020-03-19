import { readFileSync } from 'fs';
import { updateDependency } from './update';

const yamlFile = readFileSync(
  'lib/manager/kubernetes/__fixtures__/kubernetes.yaml',
  'utf8'
);

const arraySyntaxFile = readFileSync(
  'lib/manager/kubernetes/__fixtures__/array-syntax.yaml',
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
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).not.toEqual(yamlFile);
      expect(res.includes(upgrade.newDigest)).toBe(true);
    });
    it('returns same', () => {
      const upgrade = {
        managerData: { lineNumber: 46 },
        depName: 'k8s.gcr.io/kube-proxy-amd64',
        newValue: 'v1.11.1',
      };
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).toEqual(yamlFile);
    });
    it('returns null if mismatch', () => {
      const upgrade = {
        managerData: { lineNumber: 1 },
        newFrom: 'k8s.gcr.io/kube-proxy-amd64:v1.11.1',
      };
      const res = updateDependency({ fileContent: yamlFile, upgrade });
      expect(res).toBeNull();
    });
    it('returns null if error', () => {
      const res = updateDependency({ fileContent: null, upgrade: null });
      expect(res).toBeNull();
    });
    it('replaces image inside YAML array', () => {
      const upgrade = {
        managerData: { lineNumber: 14 },
        depName: 'quay.io/external_storage/local-volume-provisioner',
        newValue: 'v2.2.0',
      };
      const res = updateDependency({
        fileContent: arraySyntaxFile,
        upgrade,
      });
      expect(res).not.toEqual(arraySyntaxFile);
      expect(res).toMatchSnapshot();
    });
  });
});

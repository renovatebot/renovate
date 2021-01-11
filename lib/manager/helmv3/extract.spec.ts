import { fs } from '../../../test/util';
import { extractPackageFile } from './extract';

jest.mock('../../util/fs');

describe('lib/manager/helm-requirements/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      fs.readLocalFile = jest.fn();
    });
    it('skips invalid registry urls', () => {
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      dependencies:
        - name: redis
          version: 0.9.0
          repository: '@placeholder'
        - name: postgresql
          version: 0.8.1
          repository: nope
        - name: broken
          version: 0.8.1
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toEqual(true);
    });
    it('parses simple Chart.yaml correctly', () => {
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://charts.helm.sh/stable
          enabled: true
        - name: postgresql
          version: 0.8.1
          repository: https://charts.helm.sh/stable
          condition: postgresql.enabled
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
    });
    it('resolves aliased registry urls', () => {
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      dependencies:
        - name: redis
          version: 0.9.0
          repository: '@placeholder'
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          placeholder: 'https://my-registry.gcr.io/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toEqual(false);
    });
    it("doesn't fail if Chart.yaml is invalid", () => {
      const content = `
      Invalid Chart.yaml content.
      arr:
      [
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });
    it('skips local dependencies', () => {
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://charts.helm.sh/stable
        - name: postgresql
          version: 0.8.1
          repository: file:///some/local/path/
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
    });
    it('returns null if no dependencies key', () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      `);
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      hello: world
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if dependencies are an empty list', () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      `);
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      dependencies: []
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if dependencies key is invalid', () => {
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      dependencies:
        Invalid dependencies content.
        [
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if Chart.yaml is empty', () => {
      const content = '';
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if Chart.yaml uses an unsupported apiVersion', () => {
      const content = `
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if name and version are missing for all dependencies', () => {
      const content = `
      apiVersion: v2
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      dependencies:
        - repository: "test"
        - repository: "test"
          alias: "test"
      `;
      const fileName = 'Chart.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });
  });
});

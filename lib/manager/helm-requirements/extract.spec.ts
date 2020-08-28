import { fs } from '../../../test/util';
import { extractPackageFile } from './extract';

jest.mock('../../util/fs');

describe('lib/manager/helm-requirements/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      fs.readLocalFile = jest.fn();
    });
    it('skips invalid registry urls', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
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
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toEqual(true);
    });
    it('parses simple requirements.yaml correctly', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
    });
    it('parses simple requirements.yaml but skips if necessary fields missing', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      `);
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile('', fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).toBeNull();
    });
    it('resolves aliased registry urls', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: '@placeholder'
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          placeholder: 'https://my-registry.gcr.io/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toEqual(false);
    });
    it("doesn't fail if Chart.yaml is invalid", async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      Invalid Chart.yaml content.
      arr:
      [
      `);
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: https://kubernetes-charts.storage.googleapis.com/
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).toBeNull();
    });
    it('skips local dependencies', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
      dependencies:
        - name: redis
          version: 0.9.0
          repository: https://kubernetes-charts.storage.googleapis.com/
        - name: postgresql
          version: 0.8.1
          repository: file:///some/local/path/
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
    });
    it('returns null if no dependencies', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
      hello: world
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if requirements.yaml is invalid', async () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
      Invalid requirements.yaml content.
      dependencies:
      [
      `;
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if Chart.yaml is empty', async () => {
      const content = '';
      const fileName = 'requirements.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).toBeNull();
    });
  });
});

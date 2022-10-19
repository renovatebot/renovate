import { fs, partial } from '../../../../test/util';
import { DockerDatasource } from '../../datasource/docker';
import type { ExtractConfig } from '../types';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');
const config = partial<ExtractConfig>({
  registryAliases: {
    stable: 'https://charts.helm.sh/stable',
  },
});

describe('modules/manager/helmv3/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      fs.readLocalFile = jest.fn();
    });

    it('skips invalid registry urls', async () => {
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
      const result = await extractPackageFile(content, fileName, config);
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBe(true);
    });

    it('parses simple Chart.yaml correctly', async () => {
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
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toMatchSnapshot({
        deps: [
          { depName: 'redis', currentValue: '0.9.0' },
          { depName: 'postgresql', currentValue: '0.8.1' },
        ],
      });
    });

    it('extract correctly oci references', async () => {
      const content = `
      apiVersion: v2
      name: app2
      description: A Helm chart for Kubernetes
      type: application
      version: 0.1.0
      appVersion: "1.16.0"
      dependencies:
      - name: library
        version: 0.1.0
        repository: oci://ghcr.io/ankitabhopatkar13
        import-values:
          - defaults
      - name: postgresql
        version: 0.8.1
        repository: https://charts.helm.sh/stable
        condition: postgresql.enabled
      `;
      const fileName = 'Chart.yaml';
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toMatchSnapshot({
        deps: [
          {
            depName: 'library',
            datasource: DockerDatasource.id,
            currentValue: '0.1.0',
          },
          { depName: 'postgresql', currentValue: '0.8.1' },
        ],
      });
    });

    it('resolves aliased registry urls', async () => {
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
        - name: example
          version: 1.0.0
          repository: alias:longalias
        - name: oci-example
          version: 2.2.0
          repository: alias:ociRegistry
      `;
      const fileName = 'Chart.yaml';
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          placeholder: 'https://my-registry.gcr.io/',
          longalias: 'https://registry.example.com/',
          ociRegistry: 'oci://quay.example.com/organization',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBe(false);
    });

    it("doesn't fail if Chart.yaml is invalid", async () => {
      const content = `
      Invalid Chart.yaml content.
      arr:
      [
      `;
      const fileName = 'Chart.yaml';
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toBeNull();
    });

    it('skips local dependencies', async () => {
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
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toMatchSnapshot({
        deps: [
          { depName: 'redis' },
          { depName: 'postgresql', skipReason: 'local-dependency' },
        ],
      });
    });

    it('returns null if no dependencies key', async () => {
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
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toBeNull();
    });

    it('returns null if dependencies are an empty list', async () => {
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
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toBeNull();
    });

    it('returns null if dependencies key is invalid', async () => {
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
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toBeNull();
    });

    it('returns null if Chart.yaml is empty', async () => {
      const content = '';
      const fileName = 'Chart.yaml';
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toBeNull();
    });

    it('returns null if Chart.yaml uses an unsupported apiVersion', async () => {
      const content = `
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `;
      const fileName = 'Chart.yaml';
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toBeNull();
    });

    it('returns null if name and version are missing for all dependencies', async () => {
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
      const result = await extractPackageFile(content, fileName, config);
      expect(result).toBeNull();
    });
  });
});

import { fs, getName } from '../../../test/util';
import { SkipReason } from '../../types';
import { extractPackageFile } from './extract';

jest.mock('../../util/fs');

describe(getName(__filename), () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      fs.readLocalFile = jest.fn();
    });
    it('skips invalid registry urls', () => {
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
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toEqual(true);
    });
    it('parses simple requirements.yaml correctly', () => {
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
          repository: https://charts.helm.sh/stable/
        - name: postgresql
          version: 0.8.1
          repository: https://charts.helm.sh/stable/
      `;
      const fileName = 'requirements.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
    });
    it('parses simple requirements.yaml but skips if necessary fields missing', () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      `);
      const fileName = 'requirements.yaml';
      const result = extractPackageFile('', fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable/',
        },
      });
      expect(result).toBeNull();
    });
    it('resolves aliased registry urls', () => {
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
        - name: example
          version: 1.0.0
          repository: alias:longalias
      `;
      const fileName = 'requirements.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          placeholder: 'https://my-registry.gcr.io/',
          longalias: 'https://registry.example.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toEqual(false);
    });
    it('skips local dependencies', () => {
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
          repository: https://charts.helm.sh/stable/
        - name: postgresql
          version: 0.8.1
          repository: file:///some/local/path/
      `;
      const fileName = 'requirements.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
    });
    it('returns null if no dependencies', () => {
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
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable/',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if requirements.yaml is invalid', () => {
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
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable/',
        },
      });
      expect(result).toBeNull();
    });
    it('returns null if Chart.yaml is empty', () => {
      const content = '';
      const fileName = 'requirements.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://charts.helm.sh/stable/',
        },
      });
      expect(result).toBeNull();
    });

    describe.each([
      {
        content: `
      dependencies:
        - {}
      `,
        fieldName: 'name',
        want: {
          datasource: 'helm',
          deps: [
            {
              currentValue: undefined,
              depName: undefined,
              skipReason: SkipReason.InvalidName,
            },
          ],
        },
      },
      {
        content: `
      dependencies:
        - name: postgres
      `,
        fieldName: 'version',
        want: {
          datasource: 'helm',
          deps: [
            {
              currentValue: undefined,
              depName: 'postgres',
              skipReason: SkipReason.InvalidVersion,
            },
          ],
        },
      },
      {
        content: `
      dependencies:
        - name: postgres
          version: 0.1.0
      `,
        fieldName: 'repository',
        want: {
          datasource: 'helm',
          deps: [
            {
              currentValue: '0.1.0',
              depName: 'postgres',
              skipReason: SkipReason.NoRepository,
            },
          ],
        },
      },
    ])('validates required fields', (params) => {
      it(`validates ${params.fieldName} is required`, () => {
        fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
        const fileName = 'requirements.yaml';
        const result = extractPackageFile(params.content, fileName, {});
        expect(result).toEqual(params.want);
      });
    });
    it('skips only invalid dependences', () => {
      fs.readLocalFile.mockResolvedValueOnce(`
      apiVersion: v1
      appVersion: "1.0"
      description: A Helm chart for Kubernetes
      name: example
      version: 0.1.0
      `);
      const content = `
      dependencies:
        - name: postgresql
          repository: https://charts.helm.sh/stable/
        - version: 0.0.1
          repository: https://charts.helm.sh/stable/
        - name: redis
          version: 0.0.1
        - name: redis
          version: 0.0.1
          repository: https://charts.helm.sh/stable/
      `;
      const fileName = 'requirements.yaml';
      const result = extractPackageFile(content, fileName, {});
      expect(result).toEqual({
        datasource: 'helm',
        deps: [
          {
            currentValue: undefined,
            depName: 'postgresql',
            skipReason: 'invalid-version',
          },
          {
            currentValue: '0.0.1',
            depName: undefined,
            skipReason: 'invalid-name',
          },
          {
            currentValue: '0.0.1',
            depName: 'redis',
            skipReason: 'no-repository',
          },
          {
            currentValue: '0.0.1',
            depName: 'redis',
            registryUrls: ['https://charts.helm.sh/stable/'],
          },
        ],
      });
    });
  });
});

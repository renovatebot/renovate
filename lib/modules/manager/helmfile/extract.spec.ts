import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

describe('modules/manager/helmfile/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns null if no releases', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });

    it('do not crash on invalid helmfile.yaml', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io

      releases: [
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });

    it('skip if repository details are not specified', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          version: 1.0.0
          chart: experimental/example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip templetized release with invalid characters', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          version: 1.0.0
          chart: stable/!!!!--!
        - name: example-internal
          version: 1.0.0
          chart: stable/example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toMatchSnapshot({
        datasource: 'helm',
        deps: [
          {
            currentValue: '1.0.0',
            skipReason: 'unsupported-chart-type',
          },
          {
            currentValue: '1.0.0',
            depName: 'example',
          },
        ],
      });
    });

    it('skip local charts', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          version: 1.0.0
          chart: ./charts/example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip chart with unknown repository', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          version: 1.0.0
          chart: example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip chart with special character in the name', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          version: 1.0.0
          chart: kiwigrid/example/example
        - name: example2
          version: 1.0.0
          chart: kiwigrid/example?example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip chart that does not have specified version', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          chart: stable/example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('parses multidoc yaml', () => {
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(
        Fixtures.get('multidoc.yaml'),
        fileName,
        {
          registryAliases: {
            stable: 'https://charts.helm.sh/stable',
          },
        }
      );
      expect(result).toMatchSnapshot({
        datasource: 'helm',
        deps: [
          { depName: 'manifests', skipReason: 'local-chart' },
          { depName: 'rabbitmq', currentValue: '7.4.3' },
          { depName: 'kube-prometheus-stack', currentValue: '13.7' },
          { depName: 'invalid', skipReason: 'invalid-name' },
          { depName: 'external-dns', skipReason: 'invalid-version' },
        ],
      });
    });

    it('parses a chart with a go templating', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
      {{- if neq .Values.example.version  "" }}
          version: {{ .Values.example.version }}
      {{- else }}
          version: 1.0.0
      {{- end }}
          chart: stable/example
        - name: example-internal
          version: 1.0.0
          chart: stable/example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toMatchObject({
        datasource: 'helm',
        deps: [
          {
            currentValue: '1.0.0',
            depName: 'example',
          },
          {
            currentValue: '1.0.0',
            depName: 'example',
          },
        ],
      });
    });

    it('parses a chart with empty strings for template values', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          version: {{ .Values.example.version }}
          chart: stable/example
        - name: example-external
          version: 1.0.0
          chart: {{ .Values.example.repository }}
        - name: example-internal
          version: 1.0.0
          chart: stable/example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toMatchObject({
        datasource: 'helm',
        deps: [
          {
            skipReason: 'invalid-version',
          },
          {
            skipReason: 'invalid-name',
          },
          {
            currentValue: '1.0.0',
            depName: 'example',
          },
        ],
      });
    });

    it('parses a chart with an oci repository and non-oci one', () => {
      const content = `
      repositories:
        - name: oci-repo
          url: ghcr.io/example/oci-repo
          oci: true
        - name: jenkins
          url: https://charts.jenkins.io

      releases:
        - name: example
          version: 0.1.0
          chart: oci-repo/example
        - name: jenkins
          chart: jenkins/jenkins
          version: 3.3.0
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toMatchObject({
        datasource: 'helm',
        deps: [
          {
            currentValue: '0.1.0',
            depName: 'example',
            datasource: 'docker',
            packageName: 'ghcr.io/example/oci-repo/example',
          },
          {
            currentValue: '3.3.0',
            depName: 'jenkins',
          },
        ],
      });
    });

    it('parses and replaces templating strings', () => {
      const filename = 'helmfile.yaml';
      const result = extractPackageFile(
        Fixtures.get('go-template.yaml'),
        filename,
        {
          registryAliases: {
            stable: 'https://charts.helm.sh/stable',
          },
        }
      );
      expect(result).toMatchObject({
        datasource: 'helm',
        deps: [
          {
            depName: '',
            skipReason: 'local-chart',
          },
          { depName: null, skipReason: 'local-chart' },
          {
            depName: 'ingress-nginx',
            currentValue: '3.37.0',
            registryUrls: [],
            skipReason: 'unknown-registry',
          },
          {
            depName: 'memcached',
            currentValue: '6.0.0',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
          {
            depName: 'example',
            currentValue: '1.30.0',
            registryUrls: ['https://charts.helm.sh/stable'],
          },
          { depName: 'kube-prometheus-stack', skipReason: 'invalid-version' },
          { depName: 'example-external', skipReason: 'invalid-name' },
          {
            depName: 'external-dns',
            currentValue: '2.0.0',
            registryUrls: ['https://charts.helm.sh/stable'],
          },
        ],
      });
    });
  });
});

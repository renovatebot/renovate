import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { FILE_ACCESS_VIOLATION_ERROR } from '../../../constants/error-messages';
import { extractPackageFile } from '.';

jest.mock('../../../util/fs');

const localDir = '/tmp/github/some/repo';

describe('modules/manager/helmfile/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      GlobalConfig.set({ localDir });
    });

    it('skip null YAML document', async () => {
      const content = codeBlock`
        ~
        `;
      const fileName = 'helmfile.yaml';
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });

    it('returns null if no releases', async () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      `;
      const fileName = 'helmfile.yaml';
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });

    it('do not crash on invalid helmfile.yaml', async () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io

      releases: [
      `;
      const fileName = 'helmfile.yaml';
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).toBeNull();
    });

    it('skip if repository details are not specified', async () => {
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
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip templetized release with invalid characters', async () => {
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
      const result = await extractPackageFile(content, fileName, {
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

    it('skip local charts', async () => {
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
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip chart with unknown repository', async () => {
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
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip chart with special character in the name', async () => {
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
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip chart that does not have specified version', async () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          chart: stable/example
      `;
      const fileName = 'helmfile.yaml';
      const result = await extractPackageFile(content, fileName, {
        registryAliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result?.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('parses multidoc yaml', async () => {
      const fileName = 'helmfile.yaml';
      const result = await extractPackageFile(
        Fixtures.get('multidoc.yaml'),
        fileName,
        {
          registryAliases: {
            stable: 'https://charts.helm.sh/stable',
          },
        },
      );
      expect(result).toMatchObject({
        datasource: 'helm',
        deps: [
          { depName: 'manifests', skipReason: 'local-chart' },
          {
            depName: 'rabbitmq',
            currentValue: '7.4.3',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
          {
            depName: 'kube-prometheus-stack',
            currentValue: '13.7',
            registryUrls: [
              'https://prometheus-community.github.io/helm-charts',
            ],
          },
          { depName: 'external-dns', skipReason: 'invalid-version' },
          {
            depName: 'raw',
            currentValue: '0.1.0',
            registryUrls: ['https://charts.helm.sh/incubator/'],
          },
        ],
        managerData: { needKustomize: true },
      });
    });

    it('parses a chart with a go templating', async () => {
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
      const result = await extractPackageFile(content, fileName, {
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

    it('parses a chart with empty strings for template values', async () => {
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
      const result = await extractPackageFile(content, fileName, {
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
            currentValue: '1.0.0',
            depName: 'example',
          },
        ],
      });
    });

    it('parses a chart with an oci repository and non-oci one', async () => {
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
        - name: oci-url
          version: 0.4.2
          chart: oci://ghcr.io/example/oci-repo/url-example
      `;
      const fileName = 'helmfile.yaml';
      const result = await extractPackageFile(content, fileName, {
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
            registryUrls: ['https://charts.jenkins.io'],
          },
          {
            currentValue: '0.4.2',
            depName: 'url-example',
            datasource: 'docker',
            packageName: 'ghcr.io/example/oci-repo/url-example',
          },
        ],
      });
    });

    it('parses and replaces templating strings', async () => {
      const filename = 'helmfile.yaml';
      fs.localPathExists.mockReturnValue(Promise.resolve(true));
      const result = await extractPackageFile(
        Fixtures.get('go-template.yaml'),
        filename,
        {
          registryAliases: {
            stable: 'https://charts.helm.sh/stable',
          },
        },
      );
      expect(result).toMatchObject({
        datasource: 'helm',
        deps: [
          {
            depName: '',
            skipReason: 'local-chart',
          },
          {
            depName: '',
            skipReason: 'local-chart',
          },
          {
            depName: '',
            skipReason: 'local-chart',
          },
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
          {
            depName: 'external-dns',
            currentValue: '2.0.0',
            registryUrls: ['https://charts.helm.sh/stable'],
          },
        ],
        managerData: { needKustomize: true },
      });
    });

    it('detects kustomize and respects relative paths', async () => {
      fs.localPathExists.mockImplementationOnce((path) => {
        if (!path.startsWith(GlobalConfig.get('localDir', ''))) {
          throw new Error(FILE_ACCESS_VIOLATION_ERROR);
        }
        return Promise.resolve(true);
      });

      const parentDir = `${localDir}/project`;
      fs.getParentDir.mockReturnValue(parentDir);
      const result = await extractPackageFile(
        Fixtures.get('uses-kustomization.yaml'),
        `${parentDir}/helmfile.yaml`, // In subdir
        {
          registryAliases: {
            stable: 'https://charts.helm.sh/stable',
          },
        },
      );
      expect(result).toMatchObject({
        datasource: 'helm',
        deps: [
          {
            depName: 'my-chart',
            skipReason: 'local-chart',
          },
          {
            depName: 'memcached',
            currentValue: '6.0.0',
            registryUrls: ['https://charts.bitnami.com/bitnami'],
          },
        ],
        managerData: { needKustomize: true },
      });
    });
  });
});

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
        aliases: {
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
        aliases: {
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
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('skip templetized release with invalid characters', () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      releases:
        - name: example
          version: 1.0.0
          chart: stable/{{\`{{ .Release.Name }}\`}}
        - name: example-internal
          version: 1.0.0
          chart: stable/example
      `;
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(content, fileName, {
        aliases: {
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
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toBeTruthy();
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
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toBeTruthy();
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
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toBeTruthy();
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
        aliases: {
          stable: 'https://charts.helm.sh/stable',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every((dep) => dep.skipReason)).toBeTruthy();
    });

    it('parses multidoc yaml', () => {
      const fileName = 'helmfile.yaml';
      const result = extractPackageFile(
        Fixtures.get('multidoc.yaml'),
        fileName,
        {
          aliases: {
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
  });
});

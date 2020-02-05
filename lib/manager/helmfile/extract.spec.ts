import { extractPackageFile } from './extract';

describe('lib/manager/helmfile/extract', () => {
  describe('extractPackageFile()', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('returns null if no releases', async () => {
      const content = `
      repositories:
        - name: kiwigrid
          url: https://kiwigrid.github.io
      `;
      const fileName = 'helmfile.yaml';
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
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
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
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
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every(dep => dep.skipReason));
    });

    it('skip templetized release with invalid characters', async () => {
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
      const result = await extractPackageFile(content, fileName, {
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
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
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every(dep => dep.skipReason));
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
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every(dep => dep.skipReason));
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
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every(dep => dep.skipReason));
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
        aliases: {
          stable: 'https://kubernetes-charts.storage.googleapis.com/',
        },
      });
      expect(result).not.toBeNull();
      expect(result).toMatchSnapshot();
      expect(result.deps.every(dep => dep.skipReason));
    });
  });
});

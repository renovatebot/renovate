import { loadFixture } from '../../../test/util';
import { GlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import type { ExtractConfig } from '../types';
import { extractAllPackageFiles, extractPackageFile } from '.';

const config: ExtractConfig = {};
const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('manager/flux/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('extractPackageFile()', () => {
    it('extracts multiple resources', () => {
      const result = extractPackageFile(
        loadFixture('multidoc.yaml'),
        'multidoc.yaml'
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '1.7.0',
            datasource: 'helm',
            depName: 'external-dns',
            registryUrls: ['https://kubernetes-sigs.github.io/external-dns/'],
          },
        ],
      });
    });
    it('extracts version and components from system manifests', () => {
      const result = extractPackageFile(
        loadFixture('system.yaml'),
        'clusters/my-cluster/flux-system/gotk-components.yaml'
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v0.24.1',
            datasource: 'github-releases',
            depName: 'fluxcd/flux2',
            managerData: {
              components:
                'source-controller,kustomize-controller,helm-controller,notification-controller',
            },
          },
        ],
      });
    });
    it('considers components optional in system manifests', () => {
      const result = extractPackageFile(
        `# Flux Version: v0.27.0`,
        'clusters/my-cluster/flux-system/gotk-components.yaml'
      );
      expect(result.deps[0].managerData.components).toBeUndefined();
    });
    it('ignores system manifests without a version', () => {
      const result = extractPackageFile(
        'not actually a system manifest!',
        'clusters/my-cluster/flux-system/gotk-components.yaml'
      );
      expect(result).toBeNull();
    });
    it('extracts releases without repositories', () => {
      const result = extractPackageFile(
        loadFixture('release.yaml'),
        'release.yaml'
      );
      expect(result.deps[0].skipReason).toBe('unknown-registry');
    });
    it('ignores HelmRelease resources without an apiVersion', () => {
      const result = extractPackageFile('kind: HelmRelease', 'test.yaml');
      expect(result).toBeNull();
    });
    it('ignores HelmRepository resources without an apiVersion', () => {
      const result = extractPackageFile('kind: HelmRepository', 'test.yaml');
      expect(result).toBeNull();
    });
    it('ignores HelmRepository resources without metadata', () => {
      const result = extractPackageFile(
        `${loadFixture('release.yaml')}
---
apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: HelmRepository
`,
        'test.yaml'
      );
      expect(result.deps[0].skipReason).toBe('unknown-registry');
    });
    it('ignores HelmRelease resources without a chart name', () => {
      const result = extractPackageFile(
        `apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: sealed-secrets
  namespace: kube-system
spec:
  chart:
    spec:
      sourceRef:
        kind: HelmRepository
        name: sealed-secrets
      version: "2.0.2"
`,
        'test.yaml'
      );
      expect(result).toBeNull();
    });
    it('does not match HelmRelease resources without a namespace to HelmRepository resources without a namespace', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: HelmRepository
metadata:
  name: sealed-secrets
spec:
  url: https://bitnami-labs.github.io/sealed-secrets
---
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
spec:
  chart:
    spec:
      chart: sealed-secrets
      sourceRef:
        kind: HelmRepository
        name: sealed-secrets
      version: "2.0.2"
`,
        'test.yaml'
      );
      expect(result.deps[0].skipReason).toBe('unknown-registry');
    });
    it('does not match HelmRelease resources without a sourceRef', () => {
      const result = extractPackageFile(
        `${loadFixture('source.yaml')}
---
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
metadata:
  name: sealed-secrets
spec:
  chart:
    spec:
      chart: sealed-secrets
      version: "2.0.2"
`,
        'test.yaml'
      );
      expect(result.deps[0].skipReason).toBe('unknown-registry');
    });
    it('does not match HelmRelease resources without a namespace', () => {
      const result = extractPackageFile(
        `${loadFixture('source.yaml')}
---
apiVersion: helm.toolkit.fluxcd.io/v2beta1
kind: HelmRelease
spec:
  chart:
    spec:
      chart: sealed-secrets
      sourceRef:
        kind: HelmRepository
        name: sealed-secrets
      version: "2.0.2"
`,
        'test.yaml'
      );
      expect(result.deps[0].skipReason).toBe('unknown-registry');
    });
    it('ignores HelmRepository resources without a namespace', () => {
      const result = extractPackageFile(
        `${loadFixture('release.yaml')}
---
apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: HelmRepository
metadata:
  name: test
`,
        'test.yaml'
      );
      expect(result.deps[0].skipReason).toBe('unknown-registry');
    });
    it('ignores HelmRepository resources without a URL', () => {
      const result = extractPackageFile(
        `${loadFixture('release.yaml')}
---
apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: HelmRepository
metadata:
  name: sealed-secrets
  namespace: kube-system
`,
        'test.yaml'
      );
      expect(result.deps[0].skipReason).toBe('unknown-registry');
    });
    it('ignores resources of an unknown kind', () => {
      const result = extractPackageFile(
        `kind: SomethingElse
apiVersion: helm.toolkit.fluxcd.io/v2beta1`,
        'test.yaml'
      );
      expect(result).toBeNull();
    });
    it('ignores resources without a kind', () => {
      const result = extractPackageFile(
        'apiVersion: helm.toolkit.fluxcd.io/v2beta1',
        'test.yaml'
      );
      expect(result).toBeNull();
    });
    it('ignores bad manifests', () => {
      const result = extractPackageFile('"bad YAML', 'test.yaml');
      expect(result).toBeNull();
    });
    it('ignores null resources', () => {
      const result = extractPackageFile('null', 'test.yaml');
      expect(result).toBeNull();
    });
  });

  describe('extractAllPackageFiles()', () => {
    it('extracts multiple files', async () => {
      const result = await extractAllPackageFiles(config, [
        'lib/manager/flux/__fixtures__/release.yaml',
        'lib/manager/flux/__fixtures__/source.yaml',
      ]);
      expect(result).toEqual([
        {
          deps: [
            {
              currentValue: '2.0.2',
              datasource: 'helm',
              depName: 'sealed-secrets',
              registryUrls: ['https://bitnami-labs.github.io/sealed-secrets'],
            },
          ],
          packageFile: 'lib/manager/flux/__fixtures__/release.yaml',
        },
      ]);
    });
    it('ignores files that do not exist', async () => {
      const result = await extractAllPackageFiles(config, [
        'lib/manager/flux/__fixtures__/bogus.yaml',
      ]);
      expect(result).toBeNull();
    });
  });
});

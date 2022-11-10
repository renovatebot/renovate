import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { BitBucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { GitRefsDatasource } from '../../datasource/git-refs';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { GitlabTagsDatasource } from '../../datasource/gitlab-tags';
import { HelmDatasource } from '../../datasource/helm';
import type { ExtractConfig } from '../types';
import { extractAllPackageFiles, extractPackageFile } from '.';

const config: ExtractConfig = {};
const adminConfig: RepoGlobalConfig = { localDir: '' };

describe('modules/manager/flux/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('extractPackageFile()', () => {
    it('extracts multiple resources', () => {
      const result = extractPackageFile(
        Fixtures.get('multidoc.yaml'),
        'multidoc.yaml'
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '1.7.0',
            datasource: HelmDatasource.id,
            depName: 'external-dns',
            registryUrls: ['https://kubernetes-sigs.github.io/external-dns/'],
          },
          {
            currentValue: 'v11.35.4',
            datasource: GithubTagsDatasource.id,
            depName: 'renovate-repo',
            packageName: 'renovatebot/renovate',
            sourceUrl: 'https://github.com/renovatebot/renovate',
          },
        ],
      });
    });

    it('extracts version and components from system manifests', () => {
      const result = extractPackageFile(
        Fixtures.get('flux-system/gotk-components.yaml'),
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
      expect(result?.deps[0].managerData?.components).toBeUndefined();
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
        Fixtures.get('helmRelease.yaml'),
        'helmRelease.yaml'
      );
      expect(result?.deps[0].skipReason).toBe('unknown-registry');
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
        `${Fixtures.get('helmRelease.yaml')}
---
apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: HelmRepository
`,
        'test.yaml'
      );
      expect(result?.deps[0].skipReason).toBe('unknown-registry');
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
      expect(result?.deps[0].skipReason).toBe('unknown-registry');
    });

    it('does not match HelmRelease resources without a sourceRef', () => {
      const result = extractPackageFile(
        `${Fixtures.get('helmSource.yaml')}
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
      expect(result?.deps[0].skipReason).toBe('unknown-registry');
    });

    it('does not match HelmRelease resources without a namespace', () => {
      const result = extractPackageFile(
        `${Fixtures.get('helmSource.yaml')}
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
      expect(result?.deps[0].skipReason).toBe('unknown-registry');
    });

    it('ignores HelmRepository resources without a namespace', () => {
      const result = extractPackageFile(
        `${Fixtures.get('helmRelease.yaml')}
---
apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: HelmRepository
metadata:
  name: test
`,
        'test.yaml'
      );
      expect(result?.deps[0].skipReason).toBe('unknown-registry');
    });

    it('ignores HelmRepository resources without a URL', () => {
      const result = extractPackageFile(
        `${Fixtures.get('helmRelease.yaml')}
---
apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: HelmRepository
metadata:
  name: sealed-secrets
  namespace: kube-system
`,
        'test.yaml'
      );
      expect(result?.deps[0].skipReason).toBe('unknown-registry');
    });

    it('ignores GitRepository without a tag nor a commit', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: renovate-repo
  namespace: renovate-system
spec:
  url: https://github.com/renovatebot/renovate
`,
        'test.yaml'
      );
      expect(result?.deps[0].skipReason).toBe('unversioned-reference');
    });

    it('extracts GitRepository with a commit', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: renovate-repo
  namespace: renovate-system
spec:
  ref:
    commit: c93154b
  url: https://github.com/renovatebot/renovate
`,
        'test.yaml'
      );
      expect(result?.deps[0].currentDigest).toBe('c93154b');
      expect(result?.deps[0].replaceString).toBe('c93154b');
      expect(result?.deps[0].datasource).toBe(GitRefsDatasource.id);
    });

    it('extracts GitRepository with a tag from github with ssh', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: renovate-repo
  namespace: renovate-system
spec:
  ref:
    tag: v11.35.9
  url: git@github.com:renovatebot/renovate.git
`,
        'test.yaml'
      );
      expect(result?.deps[0].currentValue).toBe('v11.35.9');
      expect(result?.deps[0].datasource).toBe(GithubTagsDatasource.id);
    });

    it('extracts GitRepository with a tag from github', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: renovate-repo
  namespace: renovate-system
spec:
  ref:
    tag: v11.35.9
  url: https://github.com/renovatebot/renovate
`,
        'test.yaml'
      );
      expect(result?.deps[0].currentValue).toBe('v11.35.9');
      expect(result?.deps[0].datasource).toBe(GithubTagsDatasource.id);
    });

    it('extracts GitRepository with a tag from gitlab', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: renovate-repo
  namespace: renovate-system
spec:
  ref:
    tag: 1.2.3
  url: https://gitlab.com/renovatebot/renovate
`,
        'test.yaml'
      );
      expect(result?.deps[0].currentValue).toBe('1.2.3');
      expect(result?.deps[0].datasource).toBe(GitlabTagsDatasource.id);
    });

    it('extracts GitRepository with a tag from bitbucket', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: renovate-repo
  namespace: renovate-system
spec:
  ref:
    tag: 2020.5.6+staging.ze
  url: https://bitbucket.org/renovatebot/renovate
`,
        'test.yaml'
      );
      expect(result?.deps[0].currentValue).toBe('2020.5.6+staging.ze');
      expect(result?.deps[0].datasource).toBe(BitBucketTagsDatasource.id);
    });

    it('extracts GitRepository with a tag from an unkown domain', () => {
      const result = extractPackageFile(
        `apiVersion: source.toolkit.fluxcd.io/v1beta1
kind: GitRepository
metadata:
  name: renovate-repo
  namespace: renovate-system
spec:
  ref:
    tag: "7.56.4_p1"
  url: https://example.com/renovatebot/renovate
`,
        'test.yaml'
      );
      expect(result?.deps[0].currentValue).toBe('7.56.4_p1');
      expect(result?.deps[0].datasource).toBe(GitTagsDatasource.id);
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
        'lib/modules/manager/flux/__fixtures__/helmRelease.yaml',
        'lib/modules/manager/flux/__fixtures__/helmSource.yaml',
        'lib/modules/manager/flux/__fixtures__/gitSource.yaml',
        'lib/modules/manager/flux/__fixtures__/flux-system/gotk-components.yaml',
      ]);

      expect(result).toEqual([
        {
          deps: [
            {
              currentValue: '2.0.2',
              datasource: HelmDatasource.id,
              depName: 'sealed-secrets',
              registryUrls: ['https://bitnami-labs.github.io/sealed-secrets'],
            },
          ],
          packageFile: 'lib/modules/manager/flux/__fixtures__/helmRelease.yaml',
        },
        {
          deps: [
            {
              currentValue: 'v11.35.4',
              datasource: GithubTagsDatasource.id,
              depName: 'renovate-repo',
              packageName: 'renovatebot/renovate',
              sourceUrl: 'https://github.com/renovatebot/renovate',
            },
          ],
          packageFile: 'lib/modules/manager/flux/__fixtures__/gitSource.yaml',
        },
        {
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
          packageFile:
            'lib/modules/manager/flux/__fixtures__/flux-system/gotk-components.yaml',
        },
      ]);
    });

    it('ignores files that do not exist', async () => {
      const result = await extractAllPackageFiles(config, [
        'lib/modules/manager/flux/__fixtures__/bogus.yaml',
      ]);
      expect(result).toBeNull();
    });
  });
});

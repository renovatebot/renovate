import { codeBlock } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { BitbucketTagsDatasource } from '../../datasource/bitbucket-tags';
import { DockerDatasource } from '../../datasource/docker';
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
        'multidoc.yaml',
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
          {
            autoReplaceStringTemplate:
              '{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest: undefined,
            currentValue: 'v1.8.2',
            datasource: DockerDatasource.id,
            depName: 'ghcr.io/kyverno/manifests/kyverno',
            replaceString: 'v1.8.2',
          },
        ],
      });
    });

    it.each`
      filepath
      ${'clusters/my-cluster/flux-system/gotk-components.yaml'}
      ${'clusters/my-cluster/flux-system/gotk-components.yml'}
      ${'clusters/my-cluster/gotk-components.yaml'}
      ${'clusters/my-cluster/gotk-components.yml'}
      ${'gotk-components.yaml'}
    `(
      'extracts version and components from system manifest at $filepath',
      ({ filepath }) => {
        const result = extractPackageFile(
          Fixtures.get('flux-system/gotk-components.yaml'),
          filepath,
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
      },
    );

    it('considers components optional in system manifests', () => {
      const result = extractPackageFile(
        `# Flux Version: v0.27.0`,
        'clusters/my-cluster/flux-system/gotk-components.yaml',
      );
      expect(result).not.toBeNull();
      expect(result?.deps[0].managerData?.components).toBeUndefined();
    });

    it('ignores system manifests without a version', () => {
      const result = extractPackageFile(
        'not actually a system manifest!',
        'clusters/my-cluster/flux-system/gotk-components.yaml',
      );
      expect(result).toBeNull();
    });

    it('extracts releases without repositories', () => {
      const result = extractPackageFile(
        Fixtures.get('helmRelease.yaml'),
        'helmRelease.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.0.2',
            datasource: 'helm',
            depName: 'sealed-secrets',
            skipReason: 'unknown-registry',
          },
        ],
      });
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
        codeBlock`
          ${Fixtures.get('helmRelease.yaml')}
          ---
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: HelmRepository
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.0.2',
            datasource: HelmDatasource.id,
            depName: 'sealed-secrets',
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('ignores HelmRelease resources without a chart name', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: helm.toolkit.fluxcd.io/v2beta1
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
        'test.yaml',
      );
      expect(result).toBeNull();
    });

    it('does not match HelmRelease resources without a namespace to HelmRepository resources without a namespace', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
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
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.0.2',
            datasource: HelmDatasource.id,
            depName: 'sealed-secrets',
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('does not match HelmRelease resources without a sourceRef', () => {
      const result = extractPackageFile(
        codeBlock`
          ${Fixtures.get('helmSource.yaml')}
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
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.0.2',
            datasource: HelmDatasource.id,
            depName: 'sealed-secrets',
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('does not match HelmRelease resources without a namespace', () => {
      const result = extractPackageFile(
        codeBlock`
          ${Fixtures.get('helmSource.yaml')}
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
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.0.2',
            datasource: HelmDatasource.id,
            depName: 'sealed-secrets',
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('ignores HelmRepository resources without a namespace', () => {
      const result = extractPackageFile(
        codeBlock`
          ${Fixtures.get('helmRelease.yaml')}
          ---
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: HelmRepository
          metadata:
            name: test
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.0.2',
            datasource: HelmDatasource.id,
            depName: 'sealed-secrets',
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('ignores HelmRepository resources without a URL', () => {
      const result = extractPackageFile(
        codeBlock`
          ${Fixtures.get('helmRelease.yaml')}
          ---
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: HelmRepository
          metadata:
            name: sealed-secrets
            namespace: kube-system
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2.0.2',
            datasource: HelmDatasource.id,
            depName: 'sealed-secrets',
            skipReason: 'unknown-registry',
          },
        ],
      });
    });

    it('ignores GitRepository without a tag nor a commit', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: GitRepository
          metadata:
            name: renovate-repo
            namespace: renovate-system
          spec:
            url: https://github.com/renovatebot/renovate
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          { depName: 'renovate-repo', skipReason: 'unversioned-reference' },
        ],
      });
    });

    it('extracts GitRepository with a commit', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: GitRepository
          metadata:
            name: renovate-repo
            namespace: renovate-system
          spec:
            ref:
              commit: c93154b
            url: https://github.com/renovatebot/renovate
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentDigest: 'c93154b',
            datasource: GitRefsDatasource.id,
            depName: 'renovate-repo',
            packageName: 'https://github.com/renovatebot/renovate',
            replaceString: 'c93154b',
            sourceUrl: 'https://github.com/renovatebot/renovate',
          },
        ],
      });
    });

    it('extracts GitRepository with a tag from github with ssh', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: GitRepository
          metadata:
            name: renovate-repo
            namespace: renovate-system
          spec:
            ref:
              tag: v11.35.9
            url: git@github.com:renovatebot/renovate.git
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v11.35.9',
            datasource: GithubTagsDatasource.id,
            depName: 'renovate-repo',
            packageName: 'renovatebot/renovate',
            sourceUrl: 'https://github.com/renovatebot/renovate',
          },
        ],
      });
    });

    it('extracts GitRepository with a tag from github', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: GitRepository
          metadata:
            name: renovate-repo
            namespace: renovate-system
          spec:
            ref:
              tag: v11.35.9
            url: https://github.com/renovatebot/renovate
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: 'v11.35.9',
            datasource: GithubTagsDatasource.id,
            depName: 'renovate-repo',
            packageName: 'renovatebot/renovate',
            sourceUrl: 'https://github.com/renovatebot/renovate',
          },
        ],
      });
    });

    it('extracts GitRepository with a tag from gitlab', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: GitRepository
          metadata:
            name: renovate-repo
            namespace: renovate-system
          spec:
            ref:
              tag: 1.2.3
            url: https://gitlab.com/renovatebot/renovate
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '1.2.3',
            datasource: GitlabTagsDatasource.id,
            depName: 'renovate-repo',
            packageName: 'renovatebot/renovate',
            sourceUrl: 'https://gitlab.com/renovatebot/renovate',
          },
        ],
      });
    });

    it('extracts GitRepository with a tag from bitbucket', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: GitRepository
          metadata:
            name: renovate-repo
            namespace: renovate-system
          spec:
            ref:
              tag: 2020.5.6+staging.ze
            url: https://bitbucket.org/renovatebot/renovate
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '2020.5.6+staging.ze',
            datasource: BitbucketTagsDatasource.id,
            depName: 'renovate-repo',
            packageName: 'renovatebot/renovate',
            sourceUrl: 'https://bitbucket.org/renovatebot/renovate',
          },
        ],
      });
    });

    it('extracts GitRepository with a tag from an unkown domain', () => {
      const result = extractPackageFile(
        codeBlock`
          apiVersion: source.toolkit.fluxcd.io/v1beta1
          kind: GitRepository
          metadata:
            name: renovate-repo
            namespace: renovate-system
          spec:
            ref:
              tag: "7.56.4_p1"
            url: https://example.com/renovatebot/renovate
        `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentValue: '7.56.4_p1',
            datasource: GitTagsDatasource.id,
            depName: 'renovate-repo',
            packageName: 'https://example.com/renovatebot/renovate',
            sourceUrl: 'https://example.com/renovatebot/renovate',
          },
        ],
      });
    });

    it('ignores OCIRepository with no tag and no digest', () => {
      const result = extractPackageFile(
        codeBlock`
        apiVersion: source.toolkit.fluxcd.io/v1beta2
        kind: OCIRepository
        metadata:
          name: kyverno-controller
          namespace: flux-system
        spec:
          url: oci://ghcr.io/kyverno/manifests/kyverno
      `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            depName: 'ghcr.io/kyverno/manifests/kyverno',
            skipReason: 'unversioned-reference',
          },
        ],
      });
    });

    it('extracts OCIRepository with a tag', () => {
      const result = extractPackageFile(
        codeBlock`
        apiVersion: source.toolkit.fluxcd.io/v1beta2
        kind: OCIRepository
        metadata:
          name: kyverno-controller
          namespace: flux-system
        spec:
          ref:
            tag: v1.8.2
          url: oci://ghcr.io/kyverno/manifests/kyverno
      `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentValue: 'v1.8.2',
            currentDigest: undefined,
            depName: 'ghcr.io/kyverno/manifests/kyverno',
            datasource: DockerDatasource.id,
            replaceString: 'v1.8.2',
          },
        ],
      });
    });

    it('extracts OCIRepository with a digest', () => {
      const result = extractPackageFile(
        codeBlock`
        apiVersion: source.toolkit.fluxcd.io/v1beta2
        kind: OCIRepository
        metadata:
          name: kyverno-controller
          namespace: flux-system
        spec:
          ref:
            digest: sha256:761c3189c482d0f1f0ad3735ca05c4c398cae201d2169f6645280c7b7b2ce6fc
          url: oci://ghcr.io/kyverno/manifests/kyverno
      `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentDigest:
              'sha256:761c3189c482d0f1f0ad3735ca05c4c398cae201d2169f6645280c7b7b2ce6fc',
            depName: 'ghcr.io/kyverno/manifests/kyverno',
            datasource: DockerDatasource.id,
          },
        ],
      });
    });

    it('extracts OCIRepository with a tag that contains a digest', () => {
      const result = extractPackageFile(
        codeBlock`
        apiVersion: source.toolkit.fluxcd.io/v1beta2
        kind: OCIRepository
        metadata:
          name: kyverno-controller
          namespace: flux-system
        spec:
          ref:
            tag: v1.8.2@sha256:761c3189c482d0f1f0ad3735ca05c4c398cae201d2169f6645280c7b7b2ce6fc
          url: oci://ghcr.io/kyverno/manifests/kyverno
      `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            autoReplaceStringTemplate:
              '{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
            currentDigest:
              'sha256:761c3189c482d0f1f0ad3735ca05c4c398cae201d2169f6645280c7b7b2ce6fc',
            currentValue: 'v1.8.2',
            depName: 'ghcr.io/kyverno/manifests/kyverno',
            datasource: DockerDatasource.id,
            replaceString:
              'v1.8.2@sha256:761c3189c482d0f1f0ad3735ca05c4c398cae201d2169f6645280c7b7b2ce6fc',
          },
        ],
      });
    });

    it('extracts OCIRepository with a digest and tag but prefers digest', () => {
      const result = extractPackageFile(
        codeBlock`
        apiVersion: source.toolkit.fluxcd.io/v1beta2
        kind: OCIRepository
        metadata:
          name: kyverno-controller
          namespace: flux-system
        spec:
          ref:
            digest: sha256:761c3189c482d0f1f0ad3735ca05c4c398cae201d2169f6645280c7b7b2ce6fc
            tag: v1.8.2
          url: oci://ghcr.io/kyverno/manifests/kyverno
      `,
        'test.yaml',
      );
      expect(result).toEqual({
        deps: [
          {
            currentDigest:
              'sha256:761c3189c482d0f1f0ad3735ca05c4c398cae201d2169f6645280c7b7b2ce6fc',
            datasource: DockerDatasource.id,
            depName: 'ghcr.io/kyverno/manifests/kyverno',
          },
        ],
      });
    });

    it('ignores resources of an unknown kind', () => {
      const result = extractPackageFile(
        codeBlock`
          kind: SomethingElse
          apiVersion: helm.toolkit.fluxcd.io/v2beta1
        `,
        'test.yaml',
      );
      expect(result).toBeNull();
    });

    it('ignores resources without a kind', () => {
      const result = extractPackageFile(
        'apiVersion: helm.toolkit.fluxcd.io/v2beta1',
        'test.yaml',
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
        'lib/modules/manager/flux/__fixtures__/ociSource.yaml',
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
              autoReplaceStringTemplate:
                '{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
              currentDigest: undefined,
              currentValue: 'v1.8.2',
              depName: 'ghcr.io/kyverno/manifests/kyverno',
              datasource: DockerDatasource.id,
              replaceString: 'v1.8.2',
            },
          ],
          packageFile: 'lib/modules/manager/flux/__fixtures__/ociSource.yaml',
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

    it('should handle HelmRepository with type OCI', async () => {
      const result = await extractAllPackageFiles(config, [
        'lib/modules/manager/flux/__fixtures__/helmOCISource.yaml',
        'lib/modules/manager/flux/__fixtures__/helmOCIRelease.yaml',
      ]);
      expect(result).toEqual([
        {
          deps: [
            {
              currentValue: '0.4.0',
              datasource: DockerDatasource.id,
              depName: 'actions-runner-controller-charts/gha-runner-scale-set',
              packageName:
                'ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set',
            },
          ],
          packageFile:
            'lib/modules/manager/flux/__fixtures__/helmOCIRelease.yaml',
        },
      ]);
    });

    it('should handle HelmRepository w/o type oci and url starts with oci', async () => {
      const result = await extractAllPackageFiles(config, [
        'lib/modules/manager/flux/__fixtures__/helmOCISource2.yaml',
        'lib/modules/manager/flux/__fixtures__/helmOCIRelease2.yaml',
      ]);
      expect(result).toEqual([
        {
          deps: [
            {
              currentValue: '2.6.0',
              datasource: DockerDatasource.id,
              depName: 'kyverno',
              packageName: 'ghcr.io/kyverno/charts/kyverno',
            },
          ],
          packageFile:
            'lib/modules/manager/flux/__fixtures__/helmOCIRelease2.yaml',
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

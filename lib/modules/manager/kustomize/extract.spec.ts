import { codeBlock } from 'common-tags';
import { regEx } from '../../../util/regex';
import { DockerDatasource } from '../../datasource/docker';
import { GitTagsDatasource } from '../../datasource/git-tags';
import { GithubTagsDatasource } from '../../datasource/github-tags';
import { HelmDatasource } from '../../datasource/helm';
import {
  extractHelmChart,
  extractImage,
  extractResource,
  parseKustomize,
} from './extract';
import { extractPackageFile } from '.';

describe('modules/manager/kustomize/extract', () => {
  it('should successfully parse a valid kustomize file', () => {
    const content = codeBlock`
    apiVersion: kustomize.config.k8s.io/v1beta1
    kind: Kustomization

    bases:
      - git@github.com:moredhel/remote-kustomize.git?ref=v0.0.1

    namespace: testing-namespace

    resources:
      - deployment.yaml
`;
    const file = parseKustomize(content);
    expect(file).not.toBeNull();
  });

  it('return null on an invalid file', () => {
    const file = parseKustomize('');
    expect(file).toBeNull();
  });

  it('should return null when header has invalid resource kind', () => {
    const file = parseKustomize(`
      kind: NoKustomization
      bases:
      - github.com/fluxcd/flux/deploy?ref=1.19.0
    `);
    expect(file).toBeNull();
  });

  it('should fall back to default resource kind when header is missing', () => {
    const file = parseKustomize(`
      bases:
      - github.com/fluxcd/flux/deploy?ref=1.19.0
    `);
    expect(file).not.toBeNull();
    expect(file?.kind).toBe('Kustomization');
  });

  it('should extract chartHome', () => {
    const file = parseKustomize(`
      helmGlobals:
        chartHome: customPathToCharts
    `);
    expect(file).not.toBeNull();
    expect(file!.helmGlobals?.chartHome).toBe('customPathToCharts');
  });

  describe('extractBase', () => {
    it('should return null for a local base', () => {
      const res = extractResource('./service-1');
      expect(res).toBeNull();
    });

    it('should return null for an http base without ref/version', () => {
      const base = 'https://github.com/user/test-repo.git';
      const res = extractResource(`${base}?timeout=10s`);
      expect(res).toBeNull();
    });

    it('should extract out the version of an http base', () => {
      const base = 'https://github.com/user/test-repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/test-repo',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });

    it('should extract the version of a non http base', () => {
      const pkg = extractResource(
        'ssh://git@bitbucket.com/user/test-repo?ref=v1.2.3',
      );
      expect(pkg).toEqual({
        currentValue: 'v1.2.3',
        datasource: GitTagsDatasource.id,
        depName: 'bitbucket.com/user/test-repo',
        packageName: 'ssh://git@bitbucket.com/user/test-repo',
      });
    });

    it('should extract the depName if the URL includes a port number', () => {
      const pkg = extractResource(
        'ssh://git@bitbucket.com:7999/user/test-repo?ref=v1.2.3',
      );
      expect(pkg).toEqual({
        currentValue: 'v1.2.3',
        datasource: GitTagsDatasource.id,
        depName: 'bitbucket.com:7999/user/test-repo',
        packageName: 'ssh://git@bitbucket.com:7999/user/test-repo',
      });
    });

    it('should extract the version of a non http base with subdir', () => {
      const pkg = extractResource(
        'ssh://git@bitbucket.com/user/test-repo/subdir?ref=v1.2.3',
      );
      expect(pkg).toEqual({
        currentValue: 'v1.2.3',
        datasource: GitTagsDatasource.id,
        depName: 'bitbucket.com/user/test-repo',
        packageName: 'ssh://git@bitbucket.com/user/test-repo',
      });
    });

    it('should extract out the version of an github base', () => {
      const base = 'github.com/fluxcd/flux/deploy';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'fluxcd/flux',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });

    it('should extract out the version of a git base', () => {
      const base = 'git@github.com:user/repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/repo',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });

    it('should extract out the version of a git base with subdir', () => {
      const base = 'git@github.com:user/repo.git/subdir';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/repo',
      };

      const pkg = extractResource(`${base}?ref=${version}`);
      expect(pkg).toEqual(sample);
    });

    it('should extract out the version of an http base with additional params', () => {
      const base = 'https://github.com/user/test-repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/test-repo',
      };

      const pkg = extractResource(
        `${base}?timeout=120&ref=${version}&submodules=false&version=v1`,
      );
      expect(pkg).toEqual(sample);
    });

    it('should extract out the version of an http base from first version param', () => {
      const base = 'https://github.com/user/test-repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/test-repo',
      };

      const pkg = extractResource(`${base}?version=${version}&version=v0`);
      expect(pkg).toEqual(sample);
    });

    it('should extract out the version of an http base from first ref param', () => {
      const base = 'https://github.com/user/test-repo.git';
      const version = 'v1.0.0';
      const sample = {
        currentValue: version,
        datasource: GithubTagsDatasource.id,
        depName: 'user/test-repo',
      };

      const pkg = extractResource(`${base}?ref=${version}&ref=v0`);
      expect(pkg).toEqual(sample);
    });
  });

  describe('extractHelmChart', () => {
    it('should return null on a null input', () => {
      const pkg = extractHelmChart({
        name: '',
        repo: '',
        version: '',
      });
      expect(pkg).toBeNull();
    });

    it('should correctly extract a chart', () => {
      const registryUrl = 'https://docs.renovatebot.com/helm-charts';
      const sample = {
        depName: 'renovate',
        currentValue: '29.6.0',
        registryUrls: [registryUrl],
        datasource: HelmDatasource.id,
      };
      const pkg = extractHelmChart({
        name: sample.depName,
        version: sample.currentValue,
        repo: registryUrl,
      });
      expect(pkg).toEqual(sample);
    });

    it('should correctly extract an OCI chart', () => {
      const sample = {
        depName: 'redis',
        packageName: 'registry-1.docker.io/bitnamicharts/redis',
        currentValue: '18.12.1',
        datasource: DockerDatasource.id,
        pinDigests: false,
      };
      const pkg = extractHelmChart({
        name: sample.depName,
        version: sample.currentValue,
        repo: 'oci://registry-1.docker.io/bitnamicharts',
      });
      expect(pkg).toEqual(sample);
    });

    it('should correctly extract an OCI chart with registryAliases', () => {
      const sample = {
        depName: 'redis',
        packageName: 'registry-1.docker.io/bitnamicharts/redis',
        currentValue: '18.12.1',
        datasource: DockerDatasource.id,
        pinDigests: false,
      };
      const pkg = extractHelmChart(
        {
          name: sample.depName,
          version: sample.currentValue,
          repo: 'oci://localhost:5000/bitnamicharts',
        },
        { 'localhost:5000': 'registry-1.docker.io' },
      );
      expect(pkg).toEqual(sample);
    });
  });

  describe('image extraction', () => {
    it('should return null on a null input', () => {
      const pkg = extractImage({
        name: '',
        newTag: '',
      });
      expect(pkg).toBeNull();
    });

    it('should return null on invalid input', () => {
      const pkg = extractImage({
        // @ts-expect-error: for testing
        name: 3,
        newTag: '',
      });
      expect(pkg).toBeNull();
    });

    it('should correctly extract a default image', () => {
      const sample = {
        autoReplaceStringTemplate:
          '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'node',
        packageName: 'node',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });

    it('should correctly extract an image in a repo', () => {
      const sample = {
        autoReplaceStringTemplate:
          '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'test/node',
        packageName: 'test/node',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });

    it('should correctly extract from a different registry', () => {
      const sample = {
        autoReplaceStringTemplate:
          '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'quay.io/repo/image',
        packageName: 'quay.io/repo/image',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });

    it('should correctly extract from a different port', () => {
      const sample = {
        autoReplaceStringTemplate:
          '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        datasource: DockerDatasource.id,
        replaceString: 'v1.0.0',
        depName: 'localhost:5000/repo/image',
        packageName: 'localhost:5000/repo/image',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });

    it('should correctly extract from a multi-depth registry', () => {
      const sample = {
        autoReplaceStringTemplate:
          '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        replaceString: 'v1.0.0',
        datasource: DockerDatasource.id,
        depName: 'localhost:5000/repo/image/service',
        packageName: 'localhost:5000/repo/image/service',
      };
      const pkg = extractImage({
        name: sample.depName,
        newTag: sample.currentValue,
      });
      expect(pkg).toEqual(sample);
    });

    it('should correctly extract with registryAliases', () => {
      const sample = {
        autoReplaceStringTemplate:
          '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
        currentDigest: undefined,
        currentValue: 'v1.0.0',
        replaceString: 'v1.0.0',
        datasource: DockerDatasource.id,
        depName: 'localhost:5000/repo/image/service',
        packageName: 'docker.io/image/service',
      };
      const pkg = extractImage(
        {
          name: 'localhost:5000/repo/image/service',
          newTag: sample.currentValue,
        },
        { 'localhost:5000/repo': 'docker.io' },
      );
      expect(pkg).toEqual(sample);
    });
  });

  describe('extractPackageFile()', () => {
    it('returns null for non kustomize kubernetes files', () => {
      const content = codeBlock`
      apiVersion: v1
      kind: Service
      metadata:
        name: sample-service
      spec:
        ports:
        - port: 80
          protocol: TCP
          targetPort: http
          name: http
      `;
      expect(extractPackageFile(content, 'kustomization.yaml', {})).toBeNull();
    });

    it('extracts multiple image lines', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      bases:
      - service-1
      - https://moredhel/remote-kustomize.git?ref=v0.0.1
      - https://moredhel/remote-kustomize.git//deploy?ref=v0.0.1
      `;
      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res?.deps).toEqual([
        {
          currentValue: 'v0.0.1',
          datasource: GitTagsDatasource.id,
          depName: 'moredhel/remote-kustomize',
          depType: 'Kustomization',
          packageName: 'https://moredhel/remote-kustomize.git',
        },
        {
          currentValue: 'v0.0.1',
          datasource: GitTagsDatasource.id,
          depName: 'moredhel/remote-kustomize',
          depType: 'Kustomization',
          packageName: 'https://moredhel/remote-kustomize.git',
        },
      ]);
    });

    it('extracts ssh dependency', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      bases:
        - git@github.com:moredhel/remote-kustomize.git?ref=v0.0.1
`;
      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res?.deps).toEqual([
        {
          currentValue: 'v0.0.1',
          datasource: GithubTagsDatasource.id,
          depName: 'moredhel/remote-kustomize',
          depType: 'Kustomization',
        },
      ]);
    });

    it('extracts ssh dependency with a subdir', () => {
      const content = codeBlock`
        apiVersion: kustomize.config.k8s.io/v1beta1
        kind: Kustomization
        bases:
        - git@github.com:kubernetes-sigs/kustomize.git//examples/helloWorld?ref=v2.0.0
`;

      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res?.deps).toEqual([
        {
          currentValue: 'v2.0.0',
          datasource: GithubTagsDatasource.id,
          depName: 'kubernetes-sigs/kustomize',
          depType: 'Kustomization',
        },
      ]);
    });

    it('extracts http dependency', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      bases:
      - github.com/user/repo//deploy?ref=v0.0.1
      - github.com/fluxcd/flux/deploy?ref=1.19.0
      `;
      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res?.deps).toEqual([
        {
          currentValue: 'v0.0.1',
          datasource: GithubTagsDatasource.id,
          depName: 'user/repo',
          depType: 'Kustomization',
        },
        {
          currentValue: '1.19.0',
          datasource: GithubTagsDatasource.id,
          depName: 'fluxcd/flux',
          depType: 'Kustomization',
        },
      ]);
    });

    it('should extract out image versions', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      images:
      - name: node
        newTag: v0.1.0
      - newTag: v0.0.1
        name: group/instance
      - name: quay.io/test/repo
        newTag: v0.0.2
      - name: gitlab.com/org/suborg/image
        newTag: v0.0.3
      - name: this-lives/on-docker-hub
        newName: but.this.lives.on.local/private-registry # and therefore we need to check the versions available here
        newTag: v0.0.4
      - name: nginx
        newTag: 2.5
      `;
      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res?.deps).toEqual([
        {
          autoReplaceStringTemplate:
            '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: 'v0.1.0',
          datasource: DockerDatasource.id,
          depName: 'node',
          depType: 'Kustomization',
          packageName: 'node',
          replaceString: 'v0.1.0',
        },
        {
          autoReplaceStringTemplate:
            '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: 'v0.0.1',
          datasource: DockerDatasource.id,
          depName: 'group/instance',
          depType: 'Kustomization',
          packageName: 'group/instance',
          replaceString: 'v0.0.1',
        },
        {
          autoReplaceStringTemplate:
            '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: 'v0.0.2',
          datasource: DockerDatasource.id,
          depName: 'quay.io/test/repo',
          depType: 'Kustomization',
          packageName: 'quay.io/test/repo',
          replaceString: 'v0.0.2',
        },
        {
          autoReplaceStringTemplate:
            '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: 'v0.0.3',
          datasource: DockerDatasource.id,
          depName: 'gitlab.com/org/suborg/image',
          depType: 'Kustomization',
          packageName: 'gitlab.com/org/suborg/image',
          replaceString: 'v0.0.3',
        },
        {
          autoReplaceStringTemplate:
            '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: 'v0.0.4',
          datasource: DockerDatasource.id,
          depName: 'but.this.lives.on.local/private-registry',
          depType: 'Kustomization',
          packageName: 'but.this.lives.on.local/private-registry',
          replaceString: 'v0.0.4',
        },
        {
          currentValue: 2.5,
          depName: 'nginx',
          depType: 'Kustomization',
          skipReason: 'invalid-value',
        },
      ]);
    });

    it('ignores non-Kubernetes empty files', () => {
      expect(extractPackageFile('', 'kustomization.yaml', {})).toBeNull();
    });

    it('does nothing with kustomize empty kustomize files', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      `;
      expect(extractPackageFile(content, 'kustomization.yaml', {})).toBeNull();
    });

    it('should extract bases resources and components from their respective blocks', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      bases:
      - git@github.com:moredhel/remote-kustomize.git?ref=v0.0.1
      resources:
      - github.com/fluxcd/flux/deploy?ref=1.19.0
      components:
      - github.com/fluxcd/flux/memcache-dep?ref=1.18.0
      `;
      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res?.deps).toEqual([
        {
          currentValue: 'v0.0.1',
          datasource: GithubTagsDatasource.id,
          depName: 'moredhel/remote-kustomize',
          depType: 'Kustomization',
        },
        {
          currentValue: '1.19.0',
          datasource: GithubTagsDatasource.id,
          depName: 'fluxcd/flux',
          depType: 'Kustomization',
        },
        {
          currentValue: '1.18.0',
          datasource: GithubTagsDatasource.id,
          depName: 'fluxcd/flux',
          depType: 'Kustomization',
        },
      ]);
    });

    it('should extract dependencies when kind is Component', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1alpha1
      kind: Component
      resources:
      - deployment.yaml
      - github.com/fluxcd/flux/deploy?ref=1.19.0
      components:
      - github.com/fluxcd/flux/memcache-dep?ref=1.18.0
      images:
      - name: node
        newTag: v0.1.0
      `;
      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res?.deps).toEqual([
        {
          currentValue: '1.19.0',
          datasource: GithubTagsDatasource.id,
          depName: 'fluxcd/flux',
          depType: 'Component',
        },
        {
          currentValue: '1.18.0',
          datasource: GithubTagsDatasource.id,
          depName: 'fluxcd/flux',
          depType: 'Component',
        },
        {
          autoReplaceStringTemplate:
            '{{newValue}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: 'v0.1.0',
          datasource: DockerDatasource.id,
          depName: 'node',
          depType: 'Component',
          packageName: 'node',
          replaceString: 'v0.1.0',
        },
      ]);
    });

    const postgresDigest =
      'sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c';

    it('extracts from newTag', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      namespace: hasura
      images:
        - name: postgres
          newTag: "11"
        - name: postgres
          newTag: 11@sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
        # invalid - renders as \`postgres:sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c\`
        - name: postgres
          newTag: sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
      `;
      expect(
        extractPackageFile(content, 'kustomization.yaml', {}),
      ).toMatchObject({
        deps: [
          {
            currentDigest: undefined,
            currentValue: '11',
            replaceString: '11',
          },
          {
            currentDigest: postgresDigest,
            currentValue: '11',
            replaceString: `11@${postgresDigest}`,
          },
          {
            skipReason: 'invalid-value',
          },
        ],
      });
    });

    it('extracts from digest', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      images:
        - name: postgres
          digest: sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
        - name: postgres:11
          digest: sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
        # invalid - includes newTag and digest
        - name: postgres
          newTag: 11
          digest: sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
        # invalid - not a string
        - name: postgres
          digest: 02641143766
        # invalid - missing prefix
        - name: postgres
          digest: b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
      `;
      expect(
        extractPackageFile(content, 'kustomization.yaml', {}),
      ).toMatchObject({
        deps: [
          {
            currentDigest: postgresDigest,
            currentValue: undefined,
            replaceString: postgresDigest,
          },
          {
            currentDigest: postgresDigest,
            currentValue: '11',
            replaceString: postgresDigest,
          },
          {
            skipReason: 'invalid-dependency-specification',
          },
          {
            skipReason: 'invalid-value',
          },
          {
            skipReason: 'invalid-value',
          },
        ],
      });
    });

    it('extracts newName', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      images:
        - name: postgres
          newName: awesome/postgres:11@sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
        - name: postgres
          newName: awesome/postgres:11
        - name: postgres
          newName: awesome/postgres@sha256:b0cfe264cb1143c7c660ddfd5c482464997d62d6bc9f97f8fdf3deefce881a8c
      `;

      expect(
        extractPackageFile(content, 'kustomization.yaml', {}),
      ).toMatchObject({
        deps: [
          {
            depName: 'awesome/postgres',
            depType: 'Kustomization',
            currentDigest: postgresDigest,
            currentValue: '11',
            replaceString: `awesome/postgres:11@${postgresDigest}`,
          },
          {
            depName: 'awesome/postgres',
            depType: 'Kustomization',
            currentDigest: undefined,
            currentValue: '11',
            replaceString: 'awesome/postgres:11',
          },
          {
            depName: 'awesome/postgres',
            depType: 'Kustomization',
            currentDigest: postgresDigest,
            currentValue: undefined,
            replaceString: `awesome/postgres@${postgresDigest}`,
          },
        ],
      });
    });

    it('parses helmChart field', () => {
      const content = codeBlock`
      apiVersion: kustomize.config.k8s.io/v1beta1
      kind: Kustomization
      helmCharts:
      - name: minecraft
        includeCRDs: false
        valuesInline:
          minecraftServer:
            eula: true
            difficulty: hard
            rcon:
              enabled: true
        releaseName: moria
        version: 3.1.3
        repo: https://itzg.github.io/minecraft-server-charts
      - name: redis
        releaseName: redis
        version: 18.12.1
        repo: oci://registry-1.docker.io/bitnamicharts
      `;
      const res = extractPackageFile(content, 'kustomization.yaml', {});
      expect(res).toEqual({
        deps: [
          {
            depType: 'HelmChart',
            depName: 'minecraft',
            currentValue: '3.1.3',
            datasource: HelmDatasource.id,
            registryUrls: ['https://itzg.github.io/minecraft-server-charts'],
          },
          {
            depType: 'HelmChart',
            depName: 'redis',
            currentValue: '18.12.1',
            datasource: DockerDatasource.id,
            packageName: 'registry-1.docker.io/bitnamicharts/redis',
            pinDigests: false,
          },
        ],
      });
    });
  });

  describe('extractResource', () => {
    const urls = [
      {
        name: 'https aws code commit url',
        url: 'https://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo/somedir',
        host: 'git-codecommit.us-east-2.amazonaws.com/',
        project: 'someorg/somerepo',
        packageName:
          'https://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo',
      },
      {
        name: 'legacy azure https url with params',
        url: 'https://fabrikops2.visualstudio.com/someorg/somerepo',
        host: 'fabrikops2.visualstudio.com/',
        project: 'someorg/somerepo',
        packageName: 'https://fabrikops2.visualstudio.com/someorg/somerepo',
      },
      {
        name: 'http github url without git suffix',
        url: 'http://github.com/someorg/somerepo/somedir',
        host: 'github.com/',
        project: 'someorg/somerepo',
      },
      {
        name: 'scp github url without git suffix',
        url: 'git@github.com:someorg/somerepo/somedir',
        host: 'github.com:',
        project: 'someorg/somerepo',
      },
      {
        name: 'http github url with git suffix',
        url: 'http://github.com/someorg/somerepo.git/somedir',
        host: 'github.com/',
        project: 'someorg/somerepo',
      },
      {
        name: 'scp github url with git suffix',
        url: 'git@github.com:someorg/somerepo.git/somedir',
        host: 'github.com:',
        project: 'someorg/somerepo',
      },
      {
        name: 'non-github_scp',
        url: 'git@gitlab2.sqtools.ru:infra/kubernetes/thanos-base.git',
        host: 'gitlab2.sqtools.ru:',
        project: 'infra/kubernetes/thanos-base',
        packageName: 'git@gitlab2.sqtools.ru:infra/kubernetes/thanos-base.git',
      },
      {
        name: 'non-github_scp with path delimiter',
        url: 'git@bitbucket.org:company/project.git//path',
        host: 'bitbucket.org:',
        project: 'company/project',
        packageName: 'git@bitbucket.org:company/project.git',
      },
      {
        name: 'non-github_scp incorrectly using slash (invalid but currently passed through to git)',
        url: 'git@bitbucket.org/company/project.git//path',
        host: 'bitbucket.org/',
        project: 'company/project',
        packageName: 'git@bitbucket.org/company/project.git',
      },
      {
        name: 'non-github_git-user_ssh',
        url: 'ssh://git@bitbucket.org/company/project.git//path',
        host: 'bitbucket.org/',
        project: 'company/project',
        packageName: 'ssh://git@bitbucket.org/company/project.git',
      },
      {
        name: '_git host delimiter in non-github url',
        url: 'https://itfs.mycompany.com/collection/project/_git/somerepos',
        host: 'itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        name: '_git host delimiter in non-github url with params',
        url: 'https://itfs.mycompany.com/collection/project/_git/somerepos',
        host: 'itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        name: '_git host delimiter in non-github url with kust root path and params',
        url: 'https://itfs.mycompany.com/collection/project/_git/somerepos/somedir',
        host: 'itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        name: '_git host delimiter in non-github url with no kust root path',
        url: 'git::https://itfs.mycompany.com/collection/project/_git/somerepos',
        host: 'itfs.mycompany.com/',
        project: 'collection/project/_git/somerepos',
        packageName:
          'https://itfs.mycompany.com/collection/project/_git/somerepos',
      },
      {
        name: 'https bitbucket url with git suffix',
        url: 'https://bitbucket.example.com/scm/project/repository.git',
        host: 'bitbucket.example.com/',
        project: 'scm/project/repository',
        packageName: 'https://bitbucket.example.com/scm/project/repository.git',
      },
      {
        name: 'ssh aws code commit url',
        url: 'ssh://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo/somepath',
        host: 'git-codecommit.us-east-2.amazonaws.com/',
        project: 'someorg/somerepo',
        packageName:
          'ssh://git-codecommit.us-east-2.amazonaws.com/someorg/somerepo',
      },
      {
        name: 'scp Github with slash fixed to colon',
        url: 'git@github.com/someorg/somerepo/somepath',
        host: 'github.com:',
        project: 'someorg/somerepo',
      },
      {
        name: 'https Github with double slash path delimiter and params',
        url: 'https://github.com/kubernetes-sigs/kustomize//examples/multibases/dev/',
        host: 'github.com/',
        project: 'kubernetes-sigs/kustomize',
      },
      {
        name: 'ssh Github with double-slashed path delimiter and params',
        url: 'ssh://git@github.com/kubernetes-sigs/kustomize//examples/multibases/dev',
        host: 'github.com:',
        project: 'kubernetes-sigs/kustomize',
      },
      {
        name: 'arbitrary https host with double-slash path delimiter',
        url: 'https://example.org/path/to/repo//examples/multibases/dev',
        host: 'example.org/',
        project: 'path/to/repo',
        packageName: 'https://example.org/path/to/repo',
      },
      {
        name: 'arbitrary https host with .git repo suffix',
        url: 'https://example.org/path/to/repo.git/examples/multibases/dev',
        host: 'example.org/',
        project: 'path/to/repo',
        packageName: 'https://example.org/path/to/repo.git',
      },
      {
        name: 'arbitrary ssh host with double-slash path delimiter',
        url: 'ssh://alice@example.com/path/to/repo//examples/multibases/dev',
        host: 'example.com/',
        project: 'path/to/repo',
        packageName: 'ssh://alice@example.com/path/to/repo',
      },
      // {
      //   name: 'query_slash',
      //   url: 'https://authority/org/repo?ref=group/version',
      //   host: 'authority/',
      //   project: 'org/repo',
      //   packageName: 'https://authority/org/repo',
      // },
      // {
      //   name: 'query_git_delimiter',
      //   url: 'https://authority/org/repo/?ref=includes_git/for_some_reason',
      //   host: 'authority/',
      //   project: 'org/repo',
      //   packageName: 'https://authority/org/repo',
      // },
      // {
      //   name: 'query_git_suffix',
      //   url: 'https://authority/org/repo/?ref=includes.git/for_some_reason',
      //   host: 'authority/',
      //   project: 'org/repo',
      //   packageName: 'https://authority/org/repo',
      // },
      {
        name: 'non_parsable_path',
        url: 'https://authority/org/repo/%-invalid-uri-so-not-parsable-by-net/url.Parse',
        host: 'authority/',
        project: 'org/repo',
        packageName: 'https://authority/org/repo',
      },
      {
        name: 'non-git username with non-github host',
        url: 'ssh://myusername@bitbucket.org/ourteamname/ourrepositoryname.git//path',
        host: 'bitbucket.org/',
        project: 'ourteamname/ourrepositoryname',
        packageName:
          'ssh://myusername@bitbucket.org/ourteamname/ourrepositoryname.git',
      },
      {
        name: 'username with http protocol (invalid but currently passed through to git)',
        url: 'http://git@home.com/path/to/repository.git//path',
        host: 'home.com/',
        project: 'path/to/repository',
        packageName: 'http://git@home.com/path/to/repository.git',
      },
      {
        name: 'username with https protocol (invalid but currently passed through to git)',
        url: 'https://git@home.com/path/to/repository.git//path',
        host: 'home.com/',
        project: 'path/to/repository',
        packageName: 'https://git@home.com/path/to/repository.git',
      },
      {
        name: 'complex github ssh url from docs',
        url: 'ssh://git@ssh.github.com:443/YOUR-USERNAME/YOUR-REPOSITORY.git',
        host: 'ssh.github.com:443/',
        project: 'YOUR-USERNAME/YOUR-REPOSITORY',
      },
      {
        name: 'colon behind slash not scp delimiter',
        url: 'git@gitlab.com/user:name/YOUR-REPOSITORY.git/path',
        host: 'gitlab.com/',
        project: 'user:name/YOUR-REPOSITORY',
        packageName: 'git@gitlab.com/user:name/YOUR-REPOSITORY.git',
      },
      {
        name: 'gitlab URLs with explicit git suffix',
        url: 'git@gitlab.com:gitlab-tests/sample-project.git',
        host: 'gitlab.com:',
        project: 'gitlab-tests/sample-project',
        packageName: 'git@gitlab.com:gitlab-tests/sample-project.git',
      },
      {
        name: 'gitlab URLs without explicit git suffix',
        url: 'git@gitlab.com:gitlab-tests/sample-project',
        host: 'gitlab.com:',
        project: 'gitlab-tests/sample-project',
        packageName: 'git@gitlab.com:gitlab-tests/sample-project',
      },
      {
        name: 'azure host with _git and // path separator',
        url: 'https://username@dev.azure.com/org/project/_git/repo//path/to/kustomization/root',
        host: 'dev.azure.com/',
        project: 'org/project/_git/repo',
        packageName: 'https://username@dev.azure.com/org/project/_git/repo',
      },
      {
        name: 'legacy format azure host with _git',
        url: 'https://org.visualstudio.com/project/_git/repo/path/to/kustomization/root',
        host: 'org.visualstudio.com/',
        project: 'project/_git/repo',
        packageName: 'https://org.visualstudio.com/project/_git/repo',
      },
      {
        name: 'ssh on github with custom username for custom ssh certificate authority',
        url: 'ssh://org-12345@github.com/kubernetes-sigs/kustomize',
        host: 'github.com:',
        project: 'kubernetes-sigs/kustomize',
      },
      {
        name: 'scp on github with custom username for custom ssh certificate authority',
        url: 'org-12345@github.com/kubernetes-sigs/kustomize',
        host: 'github.com:',
        project: 'kubernetes-sigs/kustomize',
      },
    ];

    // as per kustomize URL specifications
    it.each(urls)(
      'extracts correct project from $name',
      ({ url, host, project, packageName }) => {
        const version = 'v1.0.0';
        const sample: any = {
          currentValue: version,
        };
        if (regEx(/(?:github\.com)(:|\/)/).test(url)) {
          sample.depName = project;
          sample.datasource = GithubTagsDatasource.id;
        } else {
          sample.depName = host + project;
          sample.packageName = packageName;
          sample.datasource = GitTagsDatasource.id;
        }

        const pkg = extractResource(`${url}?ref=${version}`);
        expect(pkg).toEqual(sample);
      },
    );
  });
});

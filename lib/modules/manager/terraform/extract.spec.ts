import { codeBlock } from 'common-tags';
import { join } from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import * as hashicorp from '../../versioning/hashicorp';
import { extractPackageFile } from '.';

const modules = Fixtures.get('modules.tf');
const bitbucketModules = Fixtures.get('bitbucketModules.tf');
const azureDevOpsModules = Fixtures.get('azureDevOpsModules.tf');
const providers = Fixtures.get('providers.tf');
const docker = Fixtures.get('docker.tf');
const kubernetes = Fixtures.get('kubernetes.tf');

const helm = Fixtures.get('helm.tf');
const lockedVersion = Fixtures.get('lockedVersion.tf');
const lockedVersionLockfile = Fixtures.get('rangeStrategy.hcl');
const terraformBlock = Fixtures.get('terraformBlock.tf');
const tfeWorkspaceBlock = Fixtures.get('tfeWorkspace.tf');

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
  containerbaseDir: join('/tmp/cache/containerbase'),
};

// auto-mock fs
jest.mock('../../../util/fs');

describe('modules/manager/terraform/extract', () => {
  beforeEach(() => {
    GlobalConfig.set(adminConfig);
  });

  describe('extractPackageFile()', () => {
    it('returns null for empty', async () => {
      expect(await extractPackageFile('nothing here', '1.tf', {})).toBeNull();
    });

    it('returns null for no deps', async () => {
      // ModuleExtractor matches `module` at any position.
      const src = codeBlock`
        data "sops_file" "secrets" {
          source_file = "\${path.module}/secrets.enc.json"
        }
        `;

      expect(await extractPackageFile(src, '1.tf', {})).toBeNull();
    });

    it('extracts  modules', async () => {
      const res = await extractPackageFile(modules, 'modules.tf', {});
      expect(res?.deps).toHaveLength(19);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(3);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          packageName: 'hashicorp/example',
          depType: 'module',
          depName: 'github.com/hashicorp/example',
          currentValue: 'next',
          datasource: 'github-tags',
        },
        {
          packageName: 'hashicorp/example',
          depType: 'module',
          depName: 'github.com/hashicorp/example',
          currentValue: 'v1.0.0',
          datasource: 'github-tags',
        },
        {
          packageName: 'hashicorp/example',
          depType: 'module',
          depName: 'github.com/hashicorp/example',
          currentValue: 'next',
          datasource: 'github-tags',
        },
        {
          packageName: 'githubuser/myrepo',
          depType: 'module',
          depName: 'github.com/githubuser/myrepo',
          currentValue: 'tfmodule_one-v0.0.9',
          datasource: 'github-tags',
        },
        {
          packageName: 'hashicorp/example.2.3',
          depType: 'module',
          depName: 'github.com/hashicorp/example.2.3',
          currentValue: 'v1.0.0',
          datasource: 'github-tags',
        },
        {
          packageName: 'hashicorp/example.2.3',
          depType: 'module',
          depName: 'github.com/hashicorp/example.2.3',
          currentValue: 'v1.0.0',
          datasource: 'github-tags',
        },
        {
          currentValue: '0.1.0',
          depType: 'module',
          depName: 'hashicorp/consul/aws',
          datasource: 'terraform-module',
        },
        {
          packageName: 'hashicorp/example',
          depType: 'module',
          depName: 'github.com/hashicorp/example',
          currentValue: 'v2.0.0',
          datasource: 'github-tags',
        },
        {
          currentValue: '~> 1.1.0',
          registryUrls: ['https://app.terraform.io'],
          depType: 'module',
          depName: 'app.terraform.io/example-corp/k8s-cluster/azurerm',
          datasource: 'terraform-module',
        },
        {
          currentValue: '~> 1.1',
          registryUrls: ['https://app.terraform.io'],
          depType: 'module',
          depName: 'app.terraform.io/example-corp/k8s-cluster/azurerm',
          datasource: 'terraform-module',
        },
        {
          currentValue: '~~ 1.1',
          registryUrls: ['https://app.terraform.io'],
          depType: 'module',
          depName: 'app.terraform.io/example-corp/k8s-cluster/azurerm',
          datasource: 'terraform-module',
        },
        {
          currentValue: '>= 1.0.0, <= 2.0.0',
          depType: 'module',
          depName: 'hashicorp/consul/aws',
          datasource: 'terraform-module',
        },
        {
          packageName: 'tieto-cem/terraform-aws-ecs-task-definition',
          depType: 'module',
          depName: 'github.com/tieto-cem/terraform-aws-ecs-task-definition',
          currentValue: 'v0.1.0',
          datasource: 'github-tags',
        },
        {
          packageName: 'tieto-cem/terraform-aws-ecs-task-definition',
          depType: 'module',
          depName: 'github.com/tieto-cem/terraform-aws-ecs-task-definition',
          currentValue: 'v0.1.0',
          datasource: 'github-tags',
        },
        {
          depType: 'module',
          depName: 'terraform-aws-modules/security-group/aws',
          datasource: 'terraform-module',
        },
        {
          currentValue: '<= 2.4.0',
          depType: 'module',
          depName: 'terraform-aws-modules/security-group/aws',
          datasource: 'terraform-module',
        },
        {
          currentValue: '1.28.3',
          depType: 'module',
          depName: 'particuleio/addons/kubernetes',
          datasource: 'terraform-module',
        },
        {
          depName: 'relative',
          depType: 'module',
          currentValue: undefined,
          skipReason: 'local',
        },
        {
          depName: 'relative',
          depType: 'module',
          currentValue: undefined,
          skipReason: 'local',
        },
        {
          depName: 'nosauce',
          depType: 'module',
          currentValue: undefined,
          skipReason: 'no-source',
        },
      ]);
    });

    it('extracts bitbucket modules', async () => {
      const res = await extractPackageFile(bitbucketModules, 'modules.tf', {});
      expect(res?.deps).toHaveLength(11);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          currentValue: 'v1.0.0',
          datasource: 'git-tags',
          depName: 'bitbucket.com/hashicorp/example',
          depType: 'module',
          packageName: 'https://bitbucket.com/hashicorp/example',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'git-tags',
          depName: 'bitbucket.com/hashicorp/example',
          depType: 'module',
          packageName: 'https://bitbucket.com/hashicorp/example',
        },
        {
          currentValue: 'next',
          datasource: 'git-tags',
          depName: 'bitbucket.com/hashicorp/example',
          depType: 'module',
          packageName: 'https://bitbucket.com/hashicorp/example',
        },
        {
          currentValue: 'v1.0.1',
          datasource: 'git-tags',
          depName: 'bitbucket.com/hashicorp/example',
          depType: 'module',
          packageName: 'https://bitbucket.com/hashicorp/example',
        },
        {
          currentValue: 'v1.0.2',
          datasource: 'git-tags',
          depName: 'bitbucket.com/hashicorp/example',
          depType: 'module',
          packageName: 'http://bitbucket.com/hashicorp/example',
        },
        {
          currentValue: 'v1.0.3',
          datasource: 'git-tags',
          depName: 'bitbucket.com/hashicorp/example',
          depType: 'module',
          packageName: 'ssh://git@bitbucket.com/hashicorp/example',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'bitbucket-tags',
          depName: 'hashicorp/example',
          depType: 'module',
          packageName: 'hashicorp/example',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'bitbucket-tags',
          depName: 'hashicorp/example',
          depType: 'module',
          packageName: 'hashicorp/example',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'bitbucket-tags',
          depName: 'hashicorp/example',
          depType: 'module',
          packageName: 'hashicorp/example',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'bitbucket-tags',
          depName: 'hashicorp/example',
          depType: 'module',
          packageName: 'hashicorp/example',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'bitbucket-tags',
          depName: 'hashicorp/example',
          depType: 'module',
          packageName: 'hashicorp/example',
        },
      ]);
    });

    it('extracts azureDevOps modules', async () => {
      const res = await extractPackageFile(
        azureDevOpsModules,
        'modules.tf',
        {},
      );
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          currentValue: 'v1.0.0',
          datasource: 'git-tags',
          depName: 'MyOrg/MyProject/MyRepository',
          depType: 'module',
          packageName: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'git-tags',
          depName: 'MyOrg/MyProject/MyRepository',
          depType: 'module',
          packageName: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
        },
        {
          currentValue: 'v1.0.0',
          datasource: 'git-tags',
          depName: 'MyOrg/MyProject/MyRepository//some-module/path',
          depType: 'module',
          packageName: 'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
        },
      ]);
    });

    it('extracts providers', async () => {
      const res = await extractPackageFile(providers, 'providers.tf', {});
      expect(res?.deps).toHaveLength(15);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(2);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          currentValue: '1.36.1',
          datasource: 'terraform-provider',
          depName: 'azurerm',
          depType: 'provider',
          packageName: 'hashicorp/azurerm',
        },
        {
          currentValue: '=2.4',
          datasource: 'terraform-provider',
          depName: 'gitlab',
          depType: 'provider',
          packageName: 'hashicorp/gitlab',
        },
        {
          currentValue: '=1.3',
          datasource: 'terraform-provider',
          depName: 'gitlab1',
          depType: 'provider',
          packageName: 'hashicorp/gitlab1',
        },
        {
          datasource: 'terraform-provider',
          depName: 'helm',
          depType: 'provider',
          packageName: 'hashicorp/helm',
          skipReason: 'unspecified-version',
        },
        {
          currentValue: 'V1.9',
          datasource: 'terraform-provider',
          depName: 'newrelic',
          depType: 'provider',
          packageName: 'hashicorp/newrelic',
        },
        {
          currentValue: '>= 2.7.0',
          datasource: 'terraform-provider',
          depName: 'aws',
          depType: 'required_provider',
          packageName: 'hashicorp/aws',
        },
        {
          currentValue: '>= 2.0.0',
          datasource: 'terraform-provider',
          depName: 'azurerm',
          depType: 'required_provider',
          packageName: 'hashicorp/azurerm',
        },
        {
          currentValue: '>= 0.13',
          datasource: 'github-releases',
          depName: 'hashicorp/terraform',
          depType: 'required_version',
          extractVersion: 'v(?<version>.*)$',
        },
        {
          currentValue: '2.7.2',
          datasource: 'terraform-provider',
          depName: 'docker',
          depType: 'required_provider',
          packageName: 'hashicorp/docker',
          registryUrls: ['https://releases.hashicorp.com'],
        },
        {
          currentValue: '2.7.0',
          datasource: 'terraform-provider',
          depName: 'aws',
          depType: 'required_provider',
          packageName: 'hashicorp/aws',
        },
        {
          currentValue: '=2.27.0',
          datasource: 'terraform-provider',
          depName: 'azurerm',
          depType: 'required_provider',
          packageName: 'hashicorp/azurerm',
        },
        {
          currentValue: '1.2.4',
          datasource: 'terraform-provider',
          depName: 'invalid',
          depType: 'required_provider',
          skipReason: 'unsupported-url',
        },
        {
          currentValue: '1.2.4',
          datasource: 'terraform-provider',
          depName: 'helm',
          depType: 'required_provider',
          packageName: 'hashicorp/helm',
        },
        {
          currentValue: '>= 1.0',
          datasource: 'terraform-provider',
          depName: 'kubernetes',
          depType: 'required_provider',
          packageName: 'hashicorp/kubernetes',
          registryUrls: ['https://terraform.example.com'],
        },
        {
          currentValue: '>= 4.0',
          datasource: 'terraform-provider',
          depName: 'oci',
          depType: 'required_provider',
          packageName: 'oracle/oci',
          registryUrls: ['https://terraform-company_special.example.com'],
        },
      ]);
    });

    it('extracts docker resources', async () => {
      const res = await extractPackageFile(docker, 'docker.tf', {
        registryAliases: { 'hub.proxy.test': 'index.docker.io' },
      });
      expect(res?.deps).toHaveLength(7);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(3);
      expect(res?.deps).toMatchObject([
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          datasource: 'docker',
          depType: 'docker_image',
          replaceString: '${data.docker_registry_image.ubuntu.name}',
          skipReason: 'contains-variable',
        },
        {
          depType: 'docker_image',
          skipReason: 'invalid-dependency-specification',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.7.8',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'docker_image',
          replaceString: 'nginx:1.7.8',
        },
        {
          autoReplaceStringTemplate:
            'hub.proxy.test/bitnami/nginx:{{#if newValue}}{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.24.0',
          datasource: 'docker',
          depName: 'index.docker.io/bitnami/nginx',
          depType: 'docker_image',
          replaceString: 'hub.proxy.test/bitnami/nginx:1.24.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.7.8',
          datasource: 'docker',
          depName: 'nginx',
          depType: 'docker_container',
          replaceString: 'nginx:1.7.8',
        },
        {
          depType: 'docker_container',
          skipReason: 'invalid-dependency-specification',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest: undefined,
          currentValue: 'v1',
          datasource: 'docker',
          depName: 'repo.mycompany.com:8080/foo-service',
          depType: 'docker_service',
          replaceString: 'repo.mycompany.com:8080/foo-service:v1',
        },
      ]);
    });

    it('extracts kubernetes resources', async () => {
      const res = await extractPackageFile(kubernetes, 'kubernetes.tf', {});
      expect(res?.deps).toHaveLength(18);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(1);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          depName: 'gcr.io/kaniko-project/executor',
          currentValue: 'v1.7.0',
          currentDigest:
            'sha256:8504bde9a9a8c9c4e9a4fe659703d265697a36ff13607b7669a4caa4407baa52',
          depType: 'kubernetes_cron_job_v1',
        },
        {
          depName: 'node',
          currentValue: '14',
          depType: 'kubernetes_cron_job_v1',
        },
        {
          depName: 'gcr.io/kaniko-project/executor',
          currentValue: 'v1.8.0',
          currentDigest:
            'sha256:8504bde9a9a8c9c4e9a4fe659703d265697a36ff13607b7669a4caa4407baa52',
          depType: 'kubernetes_cron_job',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.1',
          depType: 'kubernetes_daemon_set_v1',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.2',
          depType: 'kubernetes_daemonset',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.3',
          depType: 'kubernetes_deployment',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.4',
          depType: 'kubernetes_deployment_v1',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.5',
          depType: 'kubernetes_job',
        },
        {
          depType: 'kubernetes_job',
          skipReason: 'invalid-dependency-specification',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.6',
          depType: 'kubernetes_job_v1',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.7',
          depType: 'kubernetes_pod',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.8',
          depType: 'kubernetes_pod_v1',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.9',
          depType: 'kubernetes_replication_controller',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.10',
          depType: 'kubernetes_replication_controller_v1',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.11',
          depType: 'kubernetes_stateful_set',
        },
        {
          depName: 'prom/prometheus',
          currentValue: 'v2.2.1',
          depType: 'kubernetes_stateful_set',
        },
        {
          depName: 'nginx',
          currentValue: '1.21.12',
          depType: 'kubernetes_stateful_set_v1',
        },
        {
          depName: 'prom/prometheus',
          currentValue: 'v2.2.2',
          depType: 'kubernetes_stateful_set_v1',
        },
      ]);
    });

    it('returns dep with skipReason local', async () => {
      const src = codeBlock`
        module "relative" {
          source = "../fe"
        }
      `;
      expect(await extractPackageFile(src, '2.tf', {})).toMatchObject({
        deps: [{ skipReason: 'local' }],
      });
    });

    it('returns null with only not added resources', async () => {
      const src = codeBlock`
        resource "test_resource" "relative" {
          source = "../fe"
        }
      `;
      expect(await extractPackageFile(src, '2.tf', {})).toBeNull();
    });

    it('extract helm releases', async () => {
      const res = await extractPackageFile(helm, 'helm.tf', {
        registryAliases: { 'hub.proxy.test': 'index.docker.io' },
      });
      expect(res?.deps).toHaveLength(9);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(2);
      expect(res?.deps).toMatchObject([
        {
          currentValue: '4.0.1',
          datasource: 'helm',
          depName: undefined,
          depType: 'helm_release',
          skipReason: 'invalid-name',
        },
        {
          currentValue: '5.0.1',
          datasource: 'helm',
          depName: 'redis',
          depType: 'helm_release',
          registryUrls: ['https://charts.helm.sh/stable'],
        },
        {
          currentValue: '6.0.1',
          datasource: 'helm',
          depName: 'redis',
          depType: 'helm_release',
        },
        {
          currentValue: 'v0.22.1',
          datasource: 'docker',
          depName: 'public.ecr.aws/karpenter/karpenter',
          depType: 'helm_release',
        },
        {
          currentValue: 'v0.22.1',
          datasource: 'docker',
          depName: 'karpenter',
          depType: 'helm_release',
          packageName: 'public.ecr.aws/karpenter/karpenter',
        },
        {
          datasource: 'helm',
          depName: './charts/example',
          depType: 'helm_release',
          skipReason: 'local-chart',
        },
        {
          currentValue: '8.9.1',
          datasource: 'docker',
          depName: 'kube-prometheus',
          depType: 'helm_release',
          packageName: 'index.docker.io/bitnamicharts/kube-prometheus',
        },
        {
          currentValue: '1.0.1',
          datasource: 'helm',
          depName: 'redis',
          depType: 'helm_release',
          registryUrls: ['https://charts.helm.sh/stable'],
        },
        {
          datasource: 'helm',
          depName: 'redis',
          depType: 'helm_release',
          registryUrls: ['https://charts.helm.sh/stable'],
        },
      ]);
    });

    it('update lockfile constraints with range strategy update-lockfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lockedVersionLockfile);
      fs.findLocalSiblingOrParent.mockResolvedValueOnce('aLockFile.hcl');

      const res = await extractPackageFile(
        lockedVersion,
        'lockedVersion.tf',
        {},
      );
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          currentValue: '~> 3.0',
          datasource: 'terraform-provider',
          depName: 'aws',
          depType: 'required_provider',
          lockedVersion: '3.1.0',
          packageName: 'hashicorp/aws',
        },
        {
          currentValue: '~> 2.50.0',
          datasource: 'terraform-provider',
          depName: 'azurerm',
          depType: 'required_provider',
          lockedVersion: '2.50.0',
          packageName: 'hashicorp/azurerm',
        },
        {
          currentValue: '>= 1.0',
          datasource: 'terraform-provider',
          depName: 'kubernetes',
          depType: 'required_provider',
          packageName: 'example/kubernetes',
          registryUrls: ['https://terraform.example.com'],
        },
      ]);
    });

    it('test terraform block with only requirement_terraform_version', async () => {
      const res = await extractPackageFile(
        terraformBlock,
        'terraformBlock.tf',
        {},
      );
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          currentValue: '1.0.0',
          datasource: 'github-releases',
          depName: 'hashicorp/terraform',
          depType: 'required_version',
          extractVersion: 'v(?<version>.*)$',
          versioning: hashicorp.id,
        },
      ]);
    });

    it('extracts terraform_version for tfe_workspace and ignores missing terraform_version keys', async () => {
      const res = await extractPackageFile(
        tfeWorkspaceBlock,
        'tfeWorkspace.tf',
        {},
      );
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(1);
      expect(res?.deps).toIncludeAllPartialMembers([
        {
          currentValue: '1.1.6',
          datasource: 'github-releases',
          depName: 'hashicorp/terraform',
          depType: 'tfe_workspace',
          extractVersion: 'v(?<version>.*)$',
        },
        {
          skipReason: 'unspecified-version',
        },
        {
          currentValue: '1.1.9',
          datasource: 'github-releases',
          depName: 'hashicorp/terraform',
          depType: 'tfe_workspace',
          extractVersion: 'v(?<version>.*)$',
        },
      ]);
    });

    it('return null if invalid HCL file', async () => {
      const res = await extractPackageFile(
        `
          resource my provider
        `,
        'tfeWorkspace.tf',
        {},
      );
      expect(res).toBeNull();
    });
  });
});

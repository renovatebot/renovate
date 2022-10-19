import { join } from 'upath';
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { extractPackageFile } from '.';

const modules = Fixtures?.get('modules.tf');
const bitbucketModules = Fixtures?.get('bitbucketModules.tf');
const azureDevOpsModules = Fixtures?.get('azureDevOpsModules.tf');
const providers = Fixtures?.get('providers.tf');
const docker = Fixtures?.get('docker.tf');
const kubernetes = Fixtures?.get('kubernetes.tf');

const tf2 = `module "relative" {
  source = "../fe"
}
`;
const helm = Fixtures?.get('helm.tf');
const lockedVersion = Fixtures?.get('lockedVersion.tf');
const lockedVersionLockfile = Fixtures?.get('rangeStrategy.hcl');
const terraformBlock = Fixtures?.get('terraformBlock.tf');
const tfeWorkspaceBlock = Fixtures?.get('tfeWorkspace.tf');

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

    it('extracts  modules', async () => {
      const res = await extractPackageFile(modules, 'modules.tf', {});
      expect(res?.deps).toHaveLength(18);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(2);
      expect(res).toMatchSnapshot();
    });

    it('extracts bitbucket modules', async () => {
      const res = await extractPackageFile(bitbucketModules, 'modules.tf', {});
      expect(res?.deps).toHaveLength(11);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
      expect(res).toMatchSnapshot();
    });

    it('extracts azureDevOps modules', async () => {
      const res = await extractPackageFile(
        azureDevOpsModules,
        'modules.tf',
        {}
      );
      expect(res).toEqual({
        deps: [
          {
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depName: 'MyOrg/MyProject/MyRepository',
            depType: 'module',
            packageName:
              'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
          },
          {
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depName: 'MyOrg/MyProject/MyRepository',
            depType: 'module',
            packageName:
              'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
          },
          {
            currentValue: 'v1.0.0',
            datasource: 'git-tags',
            depName: 'MyOrg/MyProject/MyRepository//some-module/path',
            depType: 'module',
            packageName:
              'git@ssh.dev.azure.com:v3/MyOrg/MyProject/MyRepository',
          },
        ],
      });
    });

    it('extracts providers', async () => {
      const res = await extractPackageFile(providers, 'providers.tf', {});
      expect(res?.deps).toHaveLength(14);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(2);
      expect(res).toMatchSnapshot();
    });

    it('extracts docker resources', async () => {
      const res = await extractPackageFile(docker, 'docker.tf', {});
      expect(res?.deps).toHaveLength(8);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(5);
      expect(res).toMatchSnapshot();
    });

    it('extracts kubernetes resources', async () => {
      const res = await extractPackageFile(kubernetes, 'kubernetes.tf', {});
      expect(res?.deps).toHaveLength(18);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(1);
      expect(res?.deps).toMatchObject([
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
        { skipReason: 'invalid-value' },
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

    it('returns null if only local deps', async () => {
      expect(await extractPackageFile(tf2, '2.tf', {})).toBeNull();
    });

    it('extract helm releases', async () => {
      const res = await extractPackageFile(helm, 'helm.tf', {});
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(6);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(2);
    });

    it('update lockfile constraints with range strategy update-lockfile', async () => {
      fs.readLocalFile.mockResolvedValueOnce(lockedVersionLockfile);
      fs.getSiblingFileName.mockReturnValueOnce('aLockFile.hcl');

      const res = await extractPackageFile(
        lockedVersion,
        'lockedVersion.tf',
        {}
      );
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
    });

    it('test terraform block with only requirement_terraform_version', async () => {
      const res = await extractPackageFile(
        terraformBlock,
        'terraformBlock.tf',
        {}
      );
      expect(res?.deps).toHaveLength(1);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(0);
      expect(res).toMatchSnapshot();
    });

    it('extracts terraform_version for tfe_workspace and ignores missing terraform_version keys', async () => {
      const res = await extractPackageFile(
        tfeWorkspaceBlock,
        'tfeWorkspace.tf',
        {}
      );
      expect(res).toMatchSnapshot();
      expect(res?.deps).toHaveLength(3);
      expect(res?.deps.filter((dep) => dep.skipReason)).toHaveLength(1);
    });
  });
});

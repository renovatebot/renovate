import { mockExecAll } from '../../../../test/exec-util';
import { fs } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import { updateArtifacts } from '.';

jest.mock('../../../util/fs');

describe('modules/manager/flux/artifacts', () => {
  beforeAll(() => {
    GlobalConfig.set({
      localDir: '',
    });
  });

  it('replaces existing value', async () => {
    const snapshots = mockExecAll({ stdout: '', stderr: '' });
    fs.readLocalFile.mockResolvedValueOnce('old');
    fs.readLocalFile.mockResolvedValueOnce('test');

    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [
        {
          newVersion: '1.0.1',
          managerData: {
            components:
              'source-controller,kustomize-controller,helm-controller,notification-controller',
          },
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'clusters/my-cluster/flux-system/gotk-components.yaml',
          contents: 'test',
        },
      },
    ]);
    expect(snapshots).toMatchObject([
      {
        cmd: 'flux install --export --components source-controller,kustomize-controller,helm-controller,notification-controller > clusters/my-cluster/flux-system/gotk-components.yaml',
      },
    ]);
  });

  it('detects system manifests in subdirectories', async () => {
    const snapshots = mockExecAll({ stdout: '', stderr: '' });
    fs.readLocalFile.mockResolvedValueOnce('old');
    fs.readLocalFile.mockResolvedValueOnce('test');

    const res = await updateArtifacts({
      packageFileName:
        'clusters/my-cluster/flux-system/gitops-toolkit/gotk-components.yaml',
      updatedDeps: [
        {
          newVersion: '1.0.1',
          managerData: {
            components:
              'source-controller,kustomize-controller,helm-controller,notification-controller',
          },
        },
      ],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toEqual([
      {
        file: {
          type: 'addition',
          path: 'clusters/my-cluster/flux-system/gitops-toolkit/gotk-components.yaml',
          contents: 'test',
        },
      },
    ]);
    expect(snapshots).toMatchObject([
      {
        cmd: 'flux install --export --components source-controller,kustomize-controller,helm-controller,notification-controller > clusters/my-cluster/flux-system/gitops-toolkit/gotk-components.yaml',
      },
    ]);
  });

  it('ignores non-system manifests', async () => {
    const res = await updateArtifacts({
      packageFileName: 'not-a-system-manifest.yaml',
      updatedDeps: [{ newVersion: '1.0.1' }],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toBeNull();
  });

  it('ignores unchanged system manifests', async () => {
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    fs.readLocalFile.mockResolvedValueOnce('old');
    fs.readLocalFile.mockResolvedValueOnce('old');
    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [{ newVersion: '1.0.1' }],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toBeNull();
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'flux install --export > clusters/my-cluster/flux-system/gotk-components.yaml',
      },
    ]);
  });

  it('ignores system manifests without a new version', async () => {
    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [{ newVersion: undefined }],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toBeNull();
  });

  it('failed to generate system manifest', async () => {
    mockExecAll(new Error('failed'));
    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [{ newVersion: '1.0.1' }],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toStrictEqual([
      {
        artifactError: {
          lockFile: 'clusters/my-cluster/flux-system/gotk-components.yaml',
          stderr: 'failed',
        },
      },
    ]);
  });

  it('failed to read system manifest', async () => {
    mockExecAll({ stdout: '', stderr: 'Error' });
    fs.readLocalFile.mockResolvedValueOnce('old');
    fs.readLocalFile.mockResolvedValueOnce('');
    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [{ newVersion: '1.0.1' }],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toStrictEqual([
      {
        artifactError: {
          lockFile: 'clusters/my-cluster/flux-system/gotk-components.yaml',
          stderr: 'Error',
        },
      },
    ]);
  });
});

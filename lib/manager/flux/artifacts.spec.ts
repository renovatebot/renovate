import { exec, mockExecAll } from '../../../test/exec-util';
import { updateArtifacts } from '.';

jest.mock('child_process');

describe('manager/flux/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('replaces existing value', async () => {
    mockExecAll(exec, { stdout: 'test', stderr: '' });

    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [{ newVersion: '1.0.1' }],
      newPackageFileContent: undefined,
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
  });

  it('ignores non-system manifests', async () => {
    const res = await updateArtifacts({
      packageFileName: 'not-a-system-manifest.yaml',
      updatedDeps: [{ newVersion: '1.0.1' }],
      newPackageFileContent: undefined,
      config: {},
    });

    expect(res).toBeNull();
  });

  it('ignores system manifests without a new version', async () => {
    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [{ newVersion: undefined }],
      newPackageFileContent: undefined,
      config: {},
    });

    expect(res).toBeNull();
  });

  it('failed to generate manifests', async () => {
    mockExecAll(exec, new Error('failed'));
    const res = await updateArtifacts({
      packageFileName: 'clusters/my-cluster/flux-system/gotk-components.yaml',
      updatedDeps: [{ newVersion: '1.0.1' }],
      newPackageFileContent: undefined,
      config: {},
    });

    expect(res[0].artifactError.lockFile).toBe(
      'clusters/my-cluster/flux-system/gotk-components.yaml'
    );
  });
});

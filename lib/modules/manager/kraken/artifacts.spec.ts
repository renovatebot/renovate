import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs } from '../../../../test/util';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from './artifacts';

jest.mock('../../../util/fs');
jest.mock('../../../util/exec/env');

const config: UpdateArtifactsConfig = {};

describe('modules/manager/kraken/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });

  it('returns null if no .kraken.lock found', async () => {
    const execSnapshots = mockExecAll();
    fs.statLocalFile.mockRejectedValue(new Error('not found'));
    const updatedDeps = [{ depName: 'dep' }];
    expect(
      await updateArtifacts({
        packageFileName: '.kraken.lock',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if .kraken.lock is empty', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: '.kraken.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.kraken.lock');
    fs.readLocalFile.mockResolvedValueOnce('');
    const execSnapshots = mockExecAll();

    const updatedDeps = [{ depName: 'dep' }];
    expect(
      await updateArtifacts({
        packageFileName: '.kraken.lock',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns null if .kraken.lock is unchanged', async () => {
    const execSnapshots = mockExecAll();
    fs.statLocalFile.mockResolvedValueOnce({ name: '.kraken.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.kraken.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current .kraken.lock');
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.kraken.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current .kraken.lock');

    const updatedDeps = [{ depName: 'dep' }];
    expect(
      await updateArtifacts({
        packageFileName: '.kraken.lock',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });

  it('returns null if updatedDeps is empty', async () => {
    const execSnapshots = mockExecAll();
    expect(
      await updateArtifacts({
        packageFileName: '.kraken.lock',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toEqual([]);
  });

  it('returns updated .kraken.lock', async () => {
    const execSnapshots = mockExecAll();

    fs.statLocalFile.mockResolvedValueOnce({ name: '.kraken.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.kraken.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current .kraken.lock');
    fs.readLocalFile.mockResolvedValueOnce('New .kraken.lock');

    const updatedDeps = [{ depName: 'dep' }];
    expect(
      await updateArtifacts({
        packageFileName: '.kraken.lock',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toEqual([
      {
        file: {
          type: 'addition',
          path: '.kraken.lock',
          contents: 'New .kraken.lock',
        },
      },
    ]);
    expect(execSnapshots).toMatchSnapshot();
  });

  it('catches errors', async () => {
    fs.statLocalFile.mockResolvedValueOnce({ name: '.kraken.lock' } as any);
    fs.findLocalSiblingOrParent.mockResolvedValueOnce('.kraken.lock');
    fs.readLocalFile.mockResolvedValueOnce('Current .kraken.lock');
    mockExecAll(new Error('failed'));

    const updatedDeps = [{ depName: 'dep' }];
    expect(
      await updateArtifacts({
        packageFileName: '.kraken.lock',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toEqual([
      { artifactError: { lockFile: '.kraken.lock', stderr: 'failed' } },
    ]);
  });
});

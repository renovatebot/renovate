import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { envMock, mockExecAll } from '../../../test/exec-util';
import { mocked } from '../../../test/util';
import { BinarySource } from '../../util/exec/common';
import * as _env from '../../util/exec/env';
import { updateArtifacts } from '.';

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('returns null if no mix.lock found', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if no updatedDeps were provided', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if no local directory found', async () => {
    const noLocalDirConfig = {
      localDir: null,
    };
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '',
        config: noLocalDirConfig,
      })
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    fs.readFile.mockResolvedValueOnce('Current mix.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('Current mix.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated mix.lock', async () => {
    fs.readFile.mockResolvedValueOnce('Old mix.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockResolvedValueOnce('New mix.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '{}',
        config: {
          ...config,
          binarySource: BinarySource.Docker,
        },
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current mix.lock' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await updateArtifacts({
        packageFileName: 'mix.exs',
        updatedDeps: ['plug'],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
});

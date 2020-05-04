import { exec as _exec } from 'child_process';
import _fs from 'fs-extra';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../test/execUtil';
import { mocked } from '../../../test/util';
import { setExecConfig } from '../../util/exec';
import { BinarySource } from '../../util/exec/common';
import { resetPrefetchedImages } from '../../util/exec/docker';
import * as _env from '../../util/exec/env';
import { updateArtifacts } from './artifacts';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/exec/docker/index', () =>
  require('../../../test/util').mockPartial('../../util/exec/docker/index', {
    removeDanglingContainers: jest.fn(),
  })
);

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);

const config = {
  localDir: join('/tmp/github/some/repo'),
};

describe('.updateArtifacts()', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    await setExecConfig(config);
    resetPrefetchedImages();
  });
  it('returns null if no poetry.lock found', async () => {
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    fs.readFile.mockReturnValueOnce('Current poetry.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('Current poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated poetry.lock', async () => {
    fs.readFile.mockResolvedValueOnce(
      '[metadata]\npython-versions = ">3.6"' as never
    );
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated poetry.lock using docker', async () => {
    await setExecConfig({
      ...config,
      binarySource: BinarySource.Docker,
      dockerUser: 'foobar',
    });
    fs.readFile.mockResolvedValueOnce('Old poetry.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config: {
          ...config,
          compatibility: { python: '3.7' },
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    fs.readFile.mockResolvedValueOnce('Current poetry.lock' as any);
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps,
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
  it('returns updated poetry.lock when doing lockfile maintenance', async () => {
    fs.readFile.mockResolvedValueOnce('Old poetry.lock' as any);
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'pyproject.toml',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: {
          ...config,
          isLockFileMaintenance: true,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
});

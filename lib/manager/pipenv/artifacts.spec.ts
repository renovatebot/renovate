import { join } from 'upath';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as pipenv from './artifacts';
import { platform as _platform } from '../../platform';
import { mocked } from '../../../test/util';
import { StatusResult } from '../../platform/git/storage';
import { envMock, mockExecAll } from '../../../test/execUtil';
import * as _env from '../../util/exec/env';
import { BinarySource } from '../../util/exec/common';
import { resetPrefetchedImages } from '../../util/exec/docker';
import { setUtilConfig } from '../../util';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/host-rules');
jest.mock('../../util/exec/docker/index', () =>
  require('../../../test/util').mockPartial('../../util/exec/docker/index', {
    removeDanglingContainers: jest.fn(),
  })
);

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);

const config = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  dockerUser: 'foobar',
};

const dockerConfig = { ...config, binarySource: BinarySource.Docker };

describe('.updateArtifacts()', () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    await setUtilConfig(config);
    resetPrefetchedImages();
  });

  it('returns if no Pipfile.lock found', async () => {
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('Current Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated Pipfile.lock', async () => {
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode', async () => {
    await setUtilConfig(dockerConfig);
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValue({
      modified: ['Pipfile.lock'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New Pipfile.lock' as any);
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config: dockerConfig,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    platform.getFile.mockResolvedValueOnce('Current Pipfile.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    expect(
      await pipenv.updateArtifacts({
        packageFileName: 'Pipfile',
        updatedDeps: [],
        newPackageFileContent: '{}',
        config,
      })
    ).toMatchSnapshot();
  });
});

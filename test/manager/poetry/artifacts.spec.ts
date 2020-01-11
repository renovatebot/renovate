import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import { updateArtifacts } from '../../../lib/manager/poetry/artifacts';
import { platform as _platform } from '../../../lib/platform';
import { mocked } from '../../util';
import { envMock, mockExecAll } from '../../execUtil';
import * as _env from '../../../lib/util/exec/env';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/exec/env');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    env.getChildProcessEnv.mockReturnValue(envMock.basic);
  });
  it('returns null if no poetry.lock found', async () => {
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(await updateArtifacts('pyproject.toml', [], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockResolvedValueOnce('Current poetry.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('Current poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '', config)
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated poetry.lock', async () => {
    platform.getFile.mockResolvedValueOnce('Old poetry.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '{}', config)
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated poetry.lock using docker', async () => {
    platform.getFile.mockResolvedValueOnce('Old poetry.lock');
    const execSnapshots = mockExecAll(exec);
    fs.readFile.mockReturnValueOnce('New poetry.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '{}', {
        ...config,
        binarySource: 'docker',
        dockerUser: 'foobar',
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('catches errors', async () => {
    platform.getFile.mockResolvedValueOnce('Current poetry.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});

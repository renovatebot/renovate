import _fs from 'fs-extra';
import { exec as _exec } from '../../../lib/util/exec';
import { updateArtifacts } from '../../../lib/manager/poetry/artifacts';

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');

const platform: any = global.platform;
const exec: any = _exec;
const fs: any = _fs;

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  afterEach(() => {
    delete global.trustLevel;
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
    platform.getFile.mockReturnValueOnce('Current poetry.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current poetry.lock');
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns updated poetry.lock', async () => {
    platform.getFile.mockReturnValueOnce('Old poetry.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New poetry.lock');
    const updatedDeps = ['dep1'];
    global.trustLevel = 'high';
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '{}', config)
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current poetry.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await updateArtifacts('pyproject.toml', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});

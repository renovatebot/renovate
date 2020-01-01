import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as cargo from '../../../lib/manager/cargo/artifacts';
import { platform as _platform } from '../../../lib/platform';
import { mocked } from '../../util';

jest.mock('fs-extra');
jest.mock('child_process');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const platform = mocked(_platform);

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns null if no Cargo.lock found', async () => {
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(
      await cargo.updateArtifacts('Cargo.toml', [], '', config)
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockResolvedValueOnce('Current Cargo.lock');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push({
        ...options,
        env: { ...options.env, PATH: null, HOME: null },
      });
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile.mockReturnValueOnce('Current Cargo.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '', config)
    ).toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('returns updated Cargo.lock', async () => {
    platform.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push({
        ...options,
        env: { ...options.env, PATH: null, HOME: null },
      });
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile.mockReturnValueOnce('New Cargo.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '{}', config)
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('returns updated Cargo.lock with docker', async () => {
    platform.getFile.mockResolvedValueOnce('Old Cargo.lock');
    const execCommands = [];
    const execOptions = [];
    exec.mockImplementation((cmd, options, callback) => {
      execCommands.push(cmd.replace(/\\(\w)/g, '/$1'));
      execOptions.push({
        ...options,
        env: { ...options.env, PATH: null, HOME: null },
      });
      callback(null, { stdout: '', stderr: '' });
      return undefined;
    });
    fs.readFile.mockReturnValueOnce('New Cargo.lock' as any);
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '{}', {
        ...config,
        binarySource: 'docker',
        dockerUser: 'foobar',
      })
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('catches errors', async () => {
    platform.getFile.mockResolvedValueOnce('Current Cargo.lock');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});

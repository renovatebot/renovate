import _fs from 'fs-extra';
import * as cargo from '../../../lib/manager/cargo/artifacts';
import { platform as _platform } from '../../../lib/platform';

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
const { exec } = require('../../../lib/util/exec');

const platform: any = _platform;
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
    platform.getFile.mockReturnValueOnce('Current Cargo.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current Cargo.lock');
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns updated Cargo.lock', async () => {
    platform.getFile.mockReturnValueOnce('Old Cargo.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New Cargo.lock');
    const updatedDeps = ['dep1'];
    global.trustLevel = 'high';
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '{}', config)
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current Cargo.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    const updatedDeps = ['dep1'];
    expect(
      await cargo.updateArtifacts('Cargo.toml', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});

jest.mock('fs-extra');
jest.mock('child-process-promise');

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const cargo = require('../../../lib/manager/cargo/artifacts');

const config = {
  localDir: '/tmp/github/some/repo',
};

describe('.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns null if no Cargo.lock found', async () => {
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    expect(
      await cargo.getArtifacts('Cargo.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns null if updatedDeps is empty', async () => {
    expect(await cargo.getArtifacts('Cargo.toml', [], '', config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current Cargo.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    expect(
      await cargo.getArtifacts('Cargo.toml', updatedDeps, '', config)
    ).toBeNull();
  });
  it('returns updated Cargo.lock', async () => {
    platform.getFile.mockReturnValueOnce('Old Cargo.lock');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New Cargo.lock');
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    expect(
      await cargo.getArtifacts('Cargo.toml', updatedDeps, '{}', config)
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current Cargo.lock');
    fs.outputFile = jest.fn(() => {
      throw new Error('not found');
    });
    const updatedDeps = [
      {
        depName: 'dep1',
        currentValue: '1.2.3',
      },
    ];
    expect(
      await cargo.getArtifacts('Cargo.toml', updatedDeps, '{}', config)
    ).toMatchSnapshot();
  });
});

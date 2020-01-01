import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as gomod from '../../../lib/manager/gomod/artifacts';
import { platform as _platform } from '../../../lib/platform';
import { mocked } from '../../util';
import { StatusResult } from '../../../lib/platform/git/storage';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../../lib/util/host-rules');

const hostRules = require('../../../lib/util/host-rules');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const platform = mocked(_platform);

const gomod1 = `module github.com/renovate-tests/gomod1

require github.com/pkg/errors v0.7.0
require github.com/aws/aws-sdk-go v1.15.21
require github.com/davecgh/go-spew v1.0.0
require golang.org/x/foo v1.0.0
require github.com/rarkins/foo abcdef1
require gopkg.in/russross/blackfriday.v1 v1.0.0

replace github.com/pkg/errors => ../errors
`;

const config = {
  localDir: '/tmp/github/some/repo',
  cacheDir: '/tmp/renovate/cache',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns if no go.sum found', async () => {
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
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockResolvedValueOnce('Current go.sum');
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
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as StatusResult);
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('returns updated go.sum', async () => {
    platform.getFile.mockResolvedValueOnce('Current go.sum');
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
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('supports docker mode without credentials', async () => {
    platform.getFile.mockResolvedValueOnce('Current go.sum');
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
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, {
        ...config,
        binarySource: 'docker',
        dockerUser: 'foobar',
      })
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('supports global mode', async () => {
    platform.getFile.mockResolvedValueOnce('Current go.sum');
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
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, {
        ...config,
        binarySource: 'global',
      })
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('supports docker mode with credentials', async () => {
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    platform.getFile.mockResolvedValueOnce('Current go.sum');
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
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
  it('supports docker mode with credentials and appMode enabled', async () => {
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    platform.getFile.mockResolvedValueOnce('Current go.sum');
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
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum 1' as any);
    fs.readFile.mockResolvedValueOnce('New go.sum 2' as any);
    fs.readFile.mockResolvedValueOnce('New go.sum 3' as any);
    try {
      global.appMode = true;
      expect(
        await gomod.updateArtifacts('go.mod', [], gomod1, {
          ...config,
          binarySource: 'docker',
          postUpdateOptions: ['gomodTidy'],
        })
      ).not.toBeNull();
      expect(execCommands).toMatchSnapshot();
      expect(execOptions).toMatchSnapshot();
    } finally {
      delete global.appMode;
    }
  });
  it('catches errors', async () => {
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
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('This update totally doesnt work');
    });
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).toMatchSnapshot();
    expect(execCommands).toMatchSnapshot();
    expect(execOptions).toMatchSnapshot();
  });
});

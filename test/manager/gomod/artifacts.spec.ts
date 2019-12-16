import _fs from 'fs-extra';
import * as gomod from '../../../lib/manager/gomod/artifacts';
import { platform as _platform } from '../../../lib/platform';

jest.mock('fs-extra');
jest.mock('../../../lib/util/exec');
jest.mock('../../../lib/util/host-rules');

const { exec } = require('../../../lib/util/exec');
const hostRules = require('../../../lib/util/host-rules');

const fs: any = _fs;
const platform: any = _platform;

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
    exec.mockResolvedValue({
      stdout: '',
      stderror: '',
    });
  });
  it('returns if no go.sum found', async () => {
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: [] });
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).toBeNull();
  });
  it('returns updated go.sum', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['go.sum'] });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).not.toBeNull();
  });
  it('supports docker mode without credentials', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['go.sum'] });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('supports global mode', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['go.sum'] });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, {
        ...config,
        binarySource: 'global',
      })
    ).not.toBeNull();
  });
  it('supports docker mode with credentials', async () => {
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    platform.getRepoStatus.mockResolvedValue({ modified: ['go.sum'] });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('supports docker mode with credentials, appMode and trustLevel=high', async () => {
    hostRules.find.mockReturnValue({
      token: 'some-token',
    });
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    platform.getRepoStatus.mockResolvedValue({ modified: ['go.sum'] });
    fs.readFile.mockResolvedValue('New go.sum 1');
    fs.readFile.mockResolvedValue('New go.sum 2');
    fs.readFile.mockResolvedValue('New go.sum 3');
    try {
      global.appMode = true;
      global.trustLevel = 'high';
      expect(
        await gomod.updateArtifacts('go.mod', [], gomod1, {
          ...config,
          binarySource: 'docker',
          postUpdateOptions: ['gomodTidy'],
        })
      ).not.toBeNull();
    } finally {
      delete global.appMode;
      delete global.trustLevel;
    }
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    fs.outputFile = jest.fn(() => {
      throw new Error('This update totally doesnt work');
    });
    expect(
      await gomod.updateArtifacts('go.mod', [], gomod1, config)
    ).toMatchSnapshot();
  });
});

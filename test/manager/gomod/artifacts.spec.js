jest.mock('fs-extra');
jest.mock('child-process-promise');

const fs = require('fs-extra');
const { exec } = require('child-process-promise');
const gomod = require('../../../lib/manager/gomod/artifacts');

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
};

describe('.getArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });
  it('returns if no go.sum found', async () => {
    expect(await gomod.getArtifacts('go.mod', [], gomod1, config)).toBeNull();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'Current go.sum');
    expect(await gomod.getArtifacts('go.mod', [], gomod1, config)).toBeNull();
  });
  it('returns updated go.sum', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.getArtifacts('go.mod', [], gomod1, config)
    ).not.toBeNull();
  });
  it('supports docker mode', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    exec.mockReturnValueOnce({
      stdout: '',
      stderror: '',
    });
    fs.readFile = jest.fn(() => 'New go.sum');
    expect(
      await gomod.getArtifacts('go.mod', [], gomod1, {
        ...config,
        binarySource: 'docker',
      })
    ).not.toBeNull();
  });
  it('catches errors', async () => {
    platform.getFile.mockReturnValueOnce('Current go.sum');
    fs.outputFile = jest.fn(() => {
      throw new Error('This update totally doesnt work');
    });
    expect(
      await gomod.getArtifacts('go.mod', [], gomod1, config)
    ).toMatchSnapshot();
  });
});

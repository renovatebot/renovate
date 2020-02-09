import { join } from 'upath';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import * as gomod from '../../../lib/manager/gomod/artifacts';
import { platform as _platform } from '../../../lib/platform';
import { mocked } from '../../../test/util';
import { StatusResult } from '../../../lib/platform/git/storage';
import { envMock, mockExecAll } from '../../../test/execUtil';
import * as _env from '../../../lib/util/exec/env';
import { setUtilConfig } from '../../../lib/util';
import { BinarySource } from '../../../lib/util/exec/common';
import { resetPrefetchedImages } from '../../../lib/util/exec/docker';

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../util/host-rules');

const hostRules = require('../../util/host-rules');

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
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
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/renovate/cache'),
  dockerUser: 'foobar',
};

const goEnv = {
  GONOSUMDB: '1',
  GOPROXY: 'proxy.example.com',
  CGO_ENABLED: '1',
};

describe('.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    env.getChildProcessEnv.mockReturnValue({ ...envMock.basic, ...goEnv });
    setUtilConfig(config);
    resetPrefetchedImages();
  });
  it('returns if no go.sum found', async () => {
    const execSnapshots = mockExecAll(exec);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns null if unchanged', async () => {
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as StatusResult);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('returns updated go.sum', async () => {
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode without credentials', async () => {
    setUtilConfig({ ...config, binarySource: BinarySource.Docker });
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          binarySource: BinarySource.Docker,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports global mode', async () => {
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          binarySource: BinarySource.Global,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode with credentials', async () => {
    setUtilConfig({ ...config, binarySource: BinarySource.Docker });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockReturnValueOnce('New go.sum' as any);
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config: {
          ...config,
          binarySource: BinarySource.Docker,
        },
      })
    ).not.toBeNull();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('supports docker mode with credentials and appMode enabled', async () => {
    setUtilConfig({ ...config, binarySource: BinarySource.Docker });
    hostRules.find.mockReturnValueOnce({
      token: 'some-token',
    });
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['go.sum'],
    } as StatusResult);
    fs.readFile.mockResolvedValueOnce('New go.sum 1' as any);
    fs.readFile.mockResolvedValueOnce('New go.sum 2' as any);
    fs.readFile.mockResolvedValueOnce('New go.sum 3' as any);
    try {
      global.appMode = true;
      expect(
        await gomod.updateArtifacts({
          packageFileName: 'go.mod',
          updatedDeps: [],
          newPackageFileContent: gomod1,
          config: {
            ...config,
            binarySource: BinarySource.Docker,
            postUpdateOptions: ['gomodTidy'],
          },
        })
      ).not.toBeNull();
      expect(execSnapshots).toMatchSnapshot();
    } finally {
      delete global.appMode;
    }
  });
  it('catches errors', async () => {
    const execSnapshots = mockExecAll(exec);
    platform.getFile.mockResolvedValueOnce('Current go.sum');
    fs.outputFile.mockImplementationOnce(() => {
      throw new Error('This update totally doesnt work');
    });
    expect(
      await gomod.updateArtifacts({
        packageFileName: 'go.mod',
        updatedDeps: [],
        newPackageFileContent: gomod1,
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
});

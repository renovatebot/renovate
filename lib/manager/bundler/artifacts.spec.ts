import { join } from 'upath';
import _fs from 'fs-extra';
import { exec as _exec } from 'child_process';
import Git from 'simple-git/promise';
import { updateArtifacts } from '.';
import { platform as _platform } from '../../platform';
import * as _datasource from '../../datasource/docker';
import { mocked } from '../../../test/util';
import { envMock, mockExecAll } from '../../../test/execUtil';
import * as _env from '../../util/exec/env';
import { BinarySource } from '../../util/exec/common';
import { setUtilConfig } from '../../util';
import { resetPrefetchedImages } from '../../util/exec/docker';

const fs: jest.Mocked<typeof _fs> = _fs as any;
const exec: jest.Mock<typeof _exec> = _exec as any;
const env = mocked(_env);
const platform = mocked(_platform);
const datasource = mocked(_datasource);

jest.mock('fs-extra');
jest.mock('child_process');
jest.mock('../../util/exec/env');
jest.mock('../../platform');
jest.mock('../../datasource/docker');

let config;

describe('bundler.updateArtifacts()', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.resetModules();

    config = {
      // `join` fixes Windows CI
      localDir: join('/tmp/github/some/repo'),
      dockerUser: 'foobar',
    };

    env.getChildProcessEnv.mockReturnValue(envMock.basic);
    resetPrefetchedImages();
    setUtilConfig(config);
  });
  it('returns null by default', async () => {
    expect(
      await updateArtifacts({
        packageFileName: '',
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: '',
        config,
      })
    ).toBeNull();
  });
  it('returns null if Gemfile.lock was not changed', async () => {
    platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: [],
    } as Git.StatusResult);
    fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('works for default binarySource', async () => {
    platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as Git.StatusResult);
    fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: 'Updated Gemfile content',
        config,
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  it('works explicit global binarySource', async () => {
    platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
    fs.outputFile.mockResolvedValueOnce(null as never);
    const execSnapshots = mockExecAll(exec);
    platform.getRepoStatus.mockResolvedValueOnce({
      modified: ['Gemfile.lock'],
    } as Git.StatusResult);
    fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
    expect(
      await updateArtifacts({
        packageFileName: 'Gemfile',
        updatedDeps: ['foo', 'bar'],
        newPackageFileContent: 'Updated Gemfile content',
        config: {
          ...config,
          binarySource: BinarySource.Global,
        },
      })
    ).toMatchSnapshot();
    expect(execSnapshots).toMatchSnapshot();
  });
  describe('Docker', () => {
    beforeEach(() => {
      setUtilConfig({ ...config, binarySource: BinarySource.Docker });
    });
    it('.ruby-version', async () => {
      platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.outputFile.mockResolvedValueOnce(null as never);
      platform.getFile.mockResolvedValueOnce('1.2.0');
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      const execSnapshots = mockExecAll(exec);
      platform.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as Git.StatusResult);
      fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            binarySource: BinarySource.Docker,
          },
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });
    it('compatibility options', async () => {
      platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.outputFile.mockResolvedValueOnce(null as never);
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      const execSnapshots = mockExecAll(exec);
      platform.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as Git.StatusResult);
      fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            binarySource: BinarySource.Docker,
            dockerUser: 'foobar',
            compatibility: {
              ruby: '1.2.5',
              bundler: '3.2.1',
            },
          },
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });
    it('invalid compatibility options', async () => {
      platform.getFile.mockResolvedValueOnce('Current Gemfile.lock');
      fs.outputFile.mockResolvedValueOnce(null as never);
      datasource.getPkgReleases.mockResolvedValueOnce({
        releases: [
          { version: '1.0.0' },
          { version: '1.2.0' },
          { version: '1.3.0' },
        ],
      });
      const execSnapshots = mockExecAll(exec);
      platform.getRepoStatus.mockResolvedValueOnce({
        modified: ['Gemfile.lock'],
      } as Git.StatusResult);
      fs.readFile.mockResolvedValueOnce('Updated Gemfile.lock' as any);
      expect(
        await updateArtifacts({
          packageFileName: 'Gemfile',
          updatedDeps: ['foo', 'bar'],
          newPackageFileContent: 'Updated Gemfile content',
          config: {
            ...config,
            binarySource: BinarySource.Docker,
            dockerUser: 'foobar',
            compatibility: {
              ruby: 'foo',
              bundler: 'bar',
            },
          },
        })
      ).toMatchSnapshot();
      expect(execSnapshots).toMatchSnapshot();
    });
  });
});

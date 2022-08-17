import type { Stats } from 'fs';
import os from 'os';
import type { StatusResult } from 'simple-git';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { env, fs, git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { updateArtifacts } from '.';
import * as execModule from '../../../util/exec';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.spyOn(os, 'platform').mockImplementation(() => 'darwin');
jest.mock('../../../util/exec/env');

const adminConfig: RepoGlobalConfig = {
  localDir: './',
};

describe('modules/manager/maven-wrapper/artifacts', () => {
  beforeEach(() => {
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => true,
        mode: 0o555,
      })
    );

    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('Should not update if there is no dep with maven:wrapper', async () => {
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'not-mavenwrapper' }],
      config: {},
    });
    expect(updatedDeps).toBeNull();
  });

  it('Should return java 7.0 when current maven version is 3.0.0', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/maven-wrapper.properties'],
      })
    );
    GlobalConfig.set(adminConfig);
    const execSnapshots = mockExecAll();
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    const expected = [
      {
        file: {
          contents: undefined,
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ];
    expect(execSnapshots).toMatchSnapshot();
    expect(updatedDeps).toEqual(expected);
  });

  it('Should update when it is maven wrapper', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/maven-wrapper.properties'],
      })
    );
    GlobalConfig.set(adminConfig);
    const execSnapshots = mockExecAll();

    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { currentValue: '3.3.1', newValue: '3.3.1' },
    });

    const expected = [
      {
        file: {
          contents: undefined,
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ];
    expect(execSnapshots).toMatchSnapshot();
    expect(updatedDeps).toEqual(expected);
  });

  it('Should not update deps when maven-wrapper.properties is not in git change', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/not-maven-wrapper.properties'],
      })
    );
    GlobalConfig.set(adminConfig);
    const execSnapshots = mockExecAll();
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });
    expect(execSnapshots).toMatchSnapshot();
    expect(updatedDeps).toEqual([]);
  });

  it('Should return an error when config is not set', async () => {
    const updatedDeps = await updateArtifacts({
      packageFileName: '',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });
    const execSnapshots = mockExecAll();

    const expectedError = [
      {
        artifactError: {
          lockFile: '',
          stderr:
            'The "path" argument must be of type string. Received undefined',
        },
      },
    ];
    expect(execSnapshots).toMatchSnapshot();
    expect(updatedDeps).toEqual(expectedError);
  });

  it('Should return null when cmd is not found', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/not-maven-wrapper.properties'],
      })
    );
    GlobalConfig.set(adminConfig);
    const execSnapshots = mockExecAll();
    jest.spyOn(os, 'platform').mockImplementation(() => 'win32');

    fs.statLocalFile.mockResolvedValue(null);
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });
    expect(execSnapshots).toMatchSnapshot();
    expect(updatedDeps).toBeNull();
  });

  it('Should throw an error when it cant update', async () => {
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['maven.mvn/wrapper/maven-wrapper.properties'],
      })
    );
    GlobalConfig.set(adminConfig);
    const execSnapshots = mockExecAll();
    jest.spyOn(execModule, 'exec').mockImplementation(() => {
      throw new Error();
    });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(execSnapshots).toMatchSnapshot();
    expect(updatedDeps).toEqual([]);
  });
});

import type { Stats } from 'fs';
import os from 'os';
import type { StatusResult } from 'simple-git';
import {
  envMock,
  ExecSnapshots,
  mockExecAll,
} from '../../../../test/exec-util';
import { env, fs, git, mockedFunction, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { updateArtifacts } from '.';
import { resetPrefetchedImages } from '../../../util/exec/docker';
import { getPkgReleases } from '../../datasource';
import * as execModule from '../../../util/exec/';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.spyOn(os, 'platform').mockImplementation(() => 'darwin');
jest.mock('../../../util/exec/env');
jest.mock('../../datasource');

const adminConfig: RepoGlobalConfig = {
  localDir: './',
};

function mockMavenFileChangedInGit(
  fileName: string = 'maven-wrapper.properties'
) {
  git.getRepoStatus.mockResolvedValueOnce(
    partial<StatusResult>({
      modified: [`maven.mvn/wrapper/${fileName}`],
    })
  );
}

describe('modules/manager/maven-wrapper/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => true,
        mode: 0o555,
      })
    );

    fs.readLocalFile.mockResolvedValue('test');
    resetPrefetchedImages();

    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [
        { version: '8.0.1' },
        { version: '11.0.1' },
        { version: '16.0.1' },
        { version: '17.0.0' },
      ],
    });
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('Should not update if there is no dep with maven:wrapper', async () => {
    mockExecAll({ stdout: '', stderr: '' });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven-wrapper',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'not-mavenwrapper' }],
      config: {},
    });
    expect(updatedDeps).toBeNull();
  });

  it('Docker should use java 8 if version is lower then 2.0.0', async () => {
    mockMavenFileChangedInGit();
    let execSnapshots = mockExecAll();
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: {
        currentValue: '2.0.0',
        newValue: '3.3.1',
        constraints: undefined,
      },
    });

    const expected = [
      {
        file: {
          contents: 'test',
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ];
    expect(execSnapshots[2].cmd).toContain('java 8.0.1');
    expect(updatedDeps).toEqual(expected);
  });

  it('Should update when it is maven wrapper', async () => {
    mockMavenFileChangedInGit();
    GlobalConfig.set(adminConfig);
    mockExecAll({ stdout: '', stderr: '' });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { currentValue: '3.3.1', newValue: '3.3.1' },
    });

    const expected = [
      {
        file: {
          contents: 'test',
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ];
    expect(updatedDeps).toEqual(expected);
  });

  it('Should not update deps when maven-wrapper.properties is not in git change', async () => {
    mockMavenFileChangedInGit('not-maven-wrapper.properties');
    mockExecAll({ stdout: '', stderr: '' });
    GlobalConfig.set(adminConfig);
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });
    expect(updatedDeps).toEqual([]);
  });

  it('Should return an error when config is not set', async () => {
    const updatedDeps = await updateArtifacts({
      packageFileName: '',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });

    const expectedError = [
      {
        artifactError: {
          lockFile: '',
          stderr:
            'The "path" argument must be of type string. Received undefined',
        },
      },
    ];

    expect(updatedDeps).toEqual(expectedError);
  });

  it('updates with docker', async () => {
    mockMavenFileChangedInGit();
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    const result = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { currentValue: '3.3.0', newValue: '3.3.1' },
    });
    expect(result).toEqual([
      {
        file: {
          contents: 'test',
          path: 'maven.mvn/wrapper/maven-wrapper.properties',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      {
        cmd: 'docker pull renovate/sidecar',
        options: { encoding: 'utf-8' },
      },
      {
        cmd: 'docker ps --filter name=renovate_sidecar -aq',
      },
      {
        cmd: 'docker run --rm --name=renovate_sidecar --label=renovate_child -v "./":"./" -e BUILDPACK_CACHE_DIR -e CONTAINERBASE_CACHE_DIR -w "./" renovate/sidecar bash -l -c "install-tool java 17.0.0 && ./mvnw wrapper:wrapper"',
        options: {
          cwd: './',
          encoding: 'utf-8',
          env: {
            HOME: '/home/user',
            HTTPS_PROXY: 'https://example.com',
            HTTP_PROXY: 'http://example.com',
            LANG: 'en_US.UTF-8',
            LC_ALL: 'en_US',
            NO_PROXY: 'localhost',
            PATH: '/tmp/path',
          },
          maxBuffer: 10485760,
          timeout: 900000,
        },
      },
    ]);
  });

  it('Should return null when cmd is not found', async () => {
    mockMavenFileChangedInGit('also-not-maven-wrapper.properties');
    GlobalConfig.set(adminConfig);
    jest.spyOn(os, 'platform').mockImplementation(() => 'win32');
    const execSnapshots = mockExecAll({ stdout: '', stderr: '' });
    fs.statLocalFile.mockResolvedValue(null);
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { newValue: '3.3.1' },
    });
    expect(updatedDeps).toBeNull();
    expect(execSnapshots).toMatchObject([]);
  });

  it('Should throw an error when it cant execute', async () => {
    mockMavenFileChangedInGit();
    GlobalConfig.set(adminConfig);
    jest.spyOn(execModule, 'exec').mockImplementation(() => {
      throw new Error('temporary-error');
    });
    const updatedDeps = await updateArtifacts({
      packageFileName: 'maven',
      newPackageFileContent: '',
      updatedDeps: [{ depName: 'org.apache.maven.wrapper:maven-wrapper' }],
      config: { currentValue: '3.0.0', newValue: '3.3.1' },
    });

    expect(updatedDeps).toEqual([
      {
        artifactError: {
          lockFile: 'maven',
          stderr: 'temporary-error',
        },
      },
    ]);
  });
});

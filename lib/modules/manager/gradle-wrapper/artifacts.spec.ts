import type { Stats } from 'fs';
import os from 'os';
import { join } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import { Fixtures } from '../../../../test/fixtures';
import * as httpMock from '../../../../test/http-mock';
import { env, fs, git, mockedFunction, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { resetPrefetchedImages } from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import { getPkgReleases } from '../../datasource';
import type { UpdateArtifactsConfig } from '../types';
import { updateArtifacts } from '.';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/exec/env');
jest.mock('../../datasource');

process.env.BUILDPACK = 'true';

const adminConfig: RepoGlobalConfig = {
  // `join` fixes Windows CI
  localDir: join('/tmp/github/some/repo'),
  cacheDir: join('/tmp/cache'),
};

const config: UpdateArtifactsConfig = {
  newValue: '5.6.4',
};

jest.spyOn(os, 'platform').mockReturnValue('linux');

describe('modules/manager/gradle-wrapper/artifacts', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    GlobalConfig.set(adminConfig);
    resetPrefetchedImages();

    fs.readLocalFile.mockResolvedValue('test');
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => true,
        mode: 0o555,
      })
    );

    // java
    mockedFunction(getPkgReleases).mockResolvedValueOnce({
      releases: [
        { version: '8.0.1' },
        { version: '11.0.1' },
        { version: '16.0.1' },
        { version: '17.0.0' },
      ],
    });
  });

  it('replaces existing value', async () => {
    const execSnapshots = mockExecAll();
    git.getRepoStatus.mockResolvedValue(
      partial<StatusResult>({
        modified: [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradlew',
          'gradlew.bat',
        ],
      })
    );

    const res = await updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: Fixtures.get(
        'expectedFiles/gradle/wrapper/gradle-wrapper.properties'
      ),
      config: { ...config, newValue: '6.3' },
    });

    expect(res).toEqual(
      [
        'gradle/wrapper/gradle-wrapper.properties',
        'gradlew',
        'gradlew.bat',
      ].map((fileProjectPath) => ({
        file: {
          type: 'addition',
          path: fileProjectPath,
          contents: 'test',
        },
      }))
    );
    expect(execSnapshots).toMatchObject([
      {
        cmd: './gradlew wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip',
        options: {
          cwd: '/tmp/github/some/repo',
          encoding: 'utf-8',
          env: {
            GRADLE_OPTS:
              '-Dorg.gradle.parallel=true -Dorg.gradle.configureondemand=true -Dorg.gradle.daemon=false -Dorg.gradle.caching=false',
          },
        },
      },
    ]);
  });

  it('gradlew not found', async () => {
    const execSnapshots = mockExecAll();
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => false,
        mode: 0o555,
      })
    );

    const result = await updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: '',
      config: {},
    });

    expect(result).toBeNull();
    expect(execSnapshots).toBeEmptyArray();
  });

  it('gradlew failed', async () => {
    const execSnapshots = mockExecAll(new Error('failed'));
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      })
    );
    const result = await updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: '',
      config,
    });

    expect(result).toBeEmptyArray();
    expect(execSnapshots).toMatchObject([
      {
        cmd: './gradlew wrapper --gradle-version 5.6.4',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('updates distributionSha256Sum (docker)', async () => {
    const execSnapshots = mockExecAll();
    httpMock
      .scope('https://services.gradle.org')
      .get('/distributions/gradle-6.3-bin.zip.sha256')
      .reply(
        200,
        '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768'
      );
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['gradle/wrapper/gradle-wrapper.properties'],
      })
    );
    GlobalConfig.set({ ...adminConfig, binarySource: 'docker' });

    const result = await updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
      config,
    });

    expect(result).toEqual([
      {
        file: {
          contents: 'test',
          path: 'gradle/wrapper/gradle-wrapper.properties',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'docker pull renovate/sidecar' },
      { cmd: 'docker ps --filter name=renovate_sidecar -aq' },
      {
        cmd:
          'docker run --rm --name=renovate_sidecar --label=renovate_child ' +
          '-v "/tmp/github/some/repo":"/tmp/github/some/repo" ' +
          '-v "/tmp/cache":"/tmp/cache" ' +
          '-e GRADLE_OPTS ' +
          '-e BUILDPACK_CACHE_DIR ' +
          '-w "/tmp/github/some/repo" ' +
          'renovate/sidecar' +
          ' bash -l -c "' +
          'install-tool java 11.0.1' +
          ' && ' +
          './gradlew wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip --gradle-distribution-sha256-sum 038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768' +
          '"',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('updates distributionSha256Sum (install)', async () => {
    const execSnapshots = mockExecAll();
    httpMock
      .scope('https://services.gradle.org')
      .get('/distributions/gradle-6.3-bin.zip.sha256')
      .reply(
        200,
        '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768'
      );
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: ['gradle/wrapper/gradle-wrapper.properties'],
      })
    );
    GlobalConfig.set({ ...adminConfig, binarySource: 'install' });

    const result = await updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
      config,
    });

    expect(result).toEqual([
      {
        file: {
          contents: 'test',
          path: 'gradle/wrapper/gradle-wrapper.properties',
          type: 'addition',
        },
      },
    ]);
    expect(execSnapshots).toMatchObject([
      { cmd: 'install-tool java 11.0.1' },
      {
        cmd: './gradlew wrapper --gradle-distribution-url https://services.gradle.org/distributions/gradle-6.3-bin.zip --gradle-distribution-sha256-sum 038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
        options: { cwd: '/tmp/github/some/repo' },
      },
    ]);
  });

  it('distributionSha256Sum 404', async () => {
    const execSnapshots = mockExecAll();
    httpMock
      .scope('https://services.gradle.org')
      .get('/distributions/gradle-6.3-bin.zip.sha256')
      .reply(404);

    const result = await updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
      config,
    });

    expect(result).toEqual([
      {
        artifactError: {
          lockFile: 'gradle/wrapper/gradle-wrapper.properties',
          stderr: 'Response code 404 (Not Found)',
        },
      },
    ]);
    expect(execSnapshots).toBeEmptyArray();
  });
});

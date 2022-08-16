import type { Stats } from 'fs';
import { readFile } from 'fs-extra';
import { resolve } from 'upath';
import { envMock, mockExecAll } from '../../../../test/exec-util';
import * as httpMock from '../../../../test/http-mock';
import {
  addReplacingSerializer,
  env,
  fs,
  git,
  partial,
} from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import { resetPrefetchedImages } from '../../../util/exec/docker';
import type { StatusResult } from '../../../util/git/types';
import type { UpdateArtifactsConfig } from '../types';
import * as gradleWrapper from '.';

jest.mock('../../../util/fs');
jest.mock('../../../util/git');
jest.mock('../../../util/exec/env');

const fixtures = resolve(__dirname, './__fixtures__');

const adminConfig: RepoGlobalConfig = {
  localDir: resolve(fixtures, './testFiles'),
};

const dockerAdminConfig = { ...adminConfig, binarySource: 'docker' };

const config: UpdateArtifactsConfig = {
  newValue: '5.6.4',
};

addReplacingSerializer('gradlew.bat', '<gradlew>');
addReplacingSerializer('./gradlew', '<gradlew>');

function readString(...paths: string[]): Promise<string> {
  return readFile(resolve(fixtures, ...paths), 'utf8');
}

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
  });

  afterEach(() => {
    GlobalConfig.reset();
  });

  it('replaces existing value', async () => {
    git.getRepoStatus.mockResolvedValue({
      modified: [
        'gradle/wrapper/gradle-wrapper.properties',
        'gradlew',
        'gradlew.bat',
      ],
    } as StatusResult);

    const execSnapshots = mockExecAll();

    const res = await gradleWrapper.updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: await readString(
        `./expectedFiles/gradle/wrapper/gradle-wrapper.properties`
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
    expect(execSnapshots).toMatchSnapshot();
  });

  it('gradlew not found', async () => {
    fs.statLocalFile.mockResolvedValue(
      partial<Stats>({
        isFile: () => false,
        mode: 0o555,
      })
    );
    GlobalConfig.set({ ...adminConfig, localDir: 'some-dir' });
    const res = await gradleWrapper.updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: '',
      config: {},
    });

    expect(res).toBeNull();
  });

  it('gradlew failed', async () => {
    const execSnapshots = mockExecAll(new Error('failed'));
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      })
    );
    const res = await gradleWrapper.updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: '',
      config,
    });

    expect(execSnapshots).toMatchSnapshot();
    expect(res).toBeEmptyArray();
  });

  it('updates distributionSha256Sum', async () => {
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

    const execSnapshots = mockExecAll();

    const result = await gradleWrapper.updateArtifacts({
      packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
      config: {
        ...config,
        ...dockerAdminConfig,
      },
    });

    expect(result).toHaveLength(1);
    expect(result?.[0].artifactError).toBeUndefined();

    expect(execSnapshots).toMatchSnapshot();
  });

  it('distributionSha256Sum 404', async () => {
    httpMock
      .scope('https://services.gradle.org')
      .get('/distributions/gradle-6.3-bin.zip.sha256')
      .reply(404);

    const result = await gradleWrapper.updateArtifacts({
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
  });

  it('handles gradle-wrapper in subdirectory', async () => {
    git.getRepoStatus.mockResolvedValue({
      modified: [
        'sub/gradle/wrapper/gradle-wrapper.properties',
        'sub/gradlew',
        'sub/gradlew.bat',
      ],
    } as StatusResult);

    const execSnapshots = mockExecAll();

    const res = await gradleWrapper.updateArtifacts({
      packageFileName: 'sub/gradle/wrapper/gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: await readString(
        `./expectedFiles/gradle/wrapper/gradle-wrapper.properties`
      ),
      config: { ...config, newValue: '6.3' },
    });

    expect(res).toEqual(
      [
        'sub/gradle/wrapper/gradle-wrapper.properties',
        'sub/gradlew',
        'sub/gradlew.bat',
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
        cmd: '<gradlew> wrapper --gradle-version 6.3',
        options: {
          cwd: '/root/project/lib/modules/manager/gradle-wrapper/__fixtures__/testFiles/sub',
        },
      },
    ]);
  });
});

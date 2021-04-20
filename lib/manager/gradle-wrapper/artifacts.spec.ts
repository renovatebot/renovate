/* eslint jest/no-standalone-expect: 0 */
import { exec as _exec } from 'child_process';
import { readFile } from 'fs-extra';
import { resolve } from 'upath';
import { envMock, mockExecAll } from '../../../test/exec-util';
import * as httpMock from '../../../test/http-mock';
import {
  addReplacingSerializer,
  env,
  fs,
  getName,
  git,
  partial,
} from '../../../test/util';
import { setUtilConfig } from '../../util';
import { BinarySource } from '../../util/exec/common';
import { resetPrefetchedImages } from '../../util/exec/docker';
import { StatusResult } from '../../util/git';
import * as dcUpdate from '.';

jest.mock('child_process');
jest.mock('../../util/fs');
jest.mock('../../util/git');
jest.mock('../../util/exec/env');

const exec: jest.Mock<typeof _exec> = _exec as any;
const fixtures = resolve(__dirname, './__fixtures__');
const config = {
  localDir: resolve(fixtures, './testFiles'),
  newValue: '5.6.4',
};
const dockerConfig = { ...config, binarySource: BinarySource.Docker };

addReplacingSerializer('gradlew.bat', '<gradlew>');
addReplacingSerializer('./gradlew', '<gradlew>');

function readString(...paths: string[]): Promise<string> {
  return readFile(resolve(fixtures, ...paths), 'utf8');
}

describe(getName(__filename), () => {
  beforeEach(async () => {
    jest.resetAllMocks();
    httpMock.setup();

    env.getChildProcessEnv.mockReturnValue({
      ...envMock.basic,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US',
    });

    await setUtilConfig(config);
    resetPrefetchedImages();

    fs.readLocalFile.mockResolvedValue('test');
  });

  afterEach(() => {
    httpMock.reset();
  });

  it('replaces existing value', async () => {
    git.getRepoStatus.mockResolvedValue({
      modified: [
        'gradle/wrapper/gradle-wrapper.properties',
        'gradlew',
        'gradlew.bat',
      ],
    } as StatusResult);

    const execSnapshots = mockExecAll(exec);

    const res = await dcUpdate.updateArtifacts({
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
          name: fileProjectPath,
          contents: 'test',
        },
      }))
    );
    expect(execSnapshots).toMatchSnapshot();
  });

  it('gradlew not found', async () => {
    const res = await dcUpdate.updateArtifacts({
      packageFileName: 'gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: undefined,
      config: {
        localDir: 'some-dir',
      },
    });

    expect(res).toBeNull();
  });

  it('gradlew failed', async () => {
    const execSnapshots = mockExecAll(exec, new Error('failed'));
    git.getRepoStatus.mockResolvedValueOnce(
      partial<StatusResult>({
        modified: [],
      })
    );
    const res = await dcUpdate.updateArtifacts({
      packageFileName: 'gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: '',
      config,
    });

    expect(execSnapshots).toMatchSnapshot();
    expect(res).toEqual([]);
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

    const execSnapshots = mockExecAll(exec);

    const result = await dcUpdate.updateArtifacts({
      packageFileName: 'gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
      config: dockerConfig,
    });

    expect(result).toHaveLength(1);
    expect(result[0].artifactError).toBeUndefined();

    expect(execSnapshots).toMatchSnapshot();
    expect(httpMock.getTrace()).toEqual([
      {
        headers: {
          'accept-encoding': 'gzip, deflate, br',
          host: 'services.gradle.org',
          'user-agent': 'https://github.com/renovatebot/renovate',
        },
        method: 'GET',
        url:
          'https://services.gradle.org/distributions/gradle-6.3-bin.zip.sha256',
      },
    ]);
  });

  it('distributionSha256Sum 404', async () => {
    httpMock
      .scope('https://services.gradle.org')
      .get('/distributions/gradle-6.3-bin.zip.sha256')
      .reply(404);

    const result = await dcUpdate.updateArtifacts({
      packageFileName: 'gradle-wrapper.properties',
      updatedDeps: [],
      newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
      config,
    });

    expect(result).toEqual([
      {
        artifactError: {
          lockFile: 'gradle-wrapper.properties',
          stderr: 'Response code 404 (Not Found)',
        },
      },
    ]);
    expect(httpMock.getTrace()).toEqual([
      {
        headers: {
          'accept-encoding': 'gzip, deflate, br',
          host: 'services.gradle.org',
          'user-agent': 'https://github.com/renovatebot/renovate',
        },
        method: 'GET',
        url:
          'https://services.gradle.org/distributions/gradle-6.3-bin.zip.sha256',
      },
    ]);
  });
});

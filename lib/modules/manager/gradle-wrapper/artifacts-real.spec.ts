import { readFile } from 'fs-extra';
import Git from 'simple-git';
import { resolve } from 'upath';
import * as httpMock from '../../../../test/http-mock';
import { git, partial } from '../../../../test/util';
import { GlobalConfig } from '../../../config/global';
import type { RepoGlobalConfig } from '../../../config/types';
import type { StatusResult } from '../../../util/git/types';
import { ifSystemSupportsGradle } from '../gradle/deep/__testutil__/gradle';
import type { UpdateArtifactsConfig } from '../types';
import * as gradleWrapper from '.';

jest.mock('../../../util/git');

const fixtures = resolve(__dirname, './__fixtures__');

const adminConfig: RepoGlobalConfig = {
  localDir: resolve(fixtures, './testFiles'),
};

const config: UpdateArtifactsConfig = {
  newValue: '5.6.4',
};

function readString(...paths: string[]): Promise<string> {
  return readFile(resolve(fixtures, ...paths), 'utf8');
}

async function readBin(...paths: string[]): Promise<Buffer> {
  return await readFile(resolve(fixtures, ...paths));
}

async function compareFile(file: string, path: string): Promise<void> {
  expect(await readBin(`./testFiles/${file}`)).toEqual(
    await readBin(`./${path}/${file}`)
  );
}

describe('modules/manager/gradle-wrapper/artifacts-real', () => {
  ifSystemSupportsGradle(6).describe('real tests', () => {
    jest.setTimeout(60 * 1000);

    beforeEach(() => {
      jest.resetAllMocks();
      GlobalConfig.set(adminConfig);
    });

    afterEach(async () => {
      await Git(fixtures).checkout(['HEAD', '--', '.']);
      GlobalConfig.reset();
    });

    it('replaces existing value', async () => {
      git.getRepoStatus.mockResolvedValue({
        modified: [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradle/wrapper/gradle-wrapper.jar',
          'gradlew',
          'gradlew.bat',
        ],
      } as StatusResult);

      const res = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./expectedFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config: { ...config, newValue: '6.3' },
      });

      expect(res).toEqual(
        await Promise.all(
          [
            'gradle/wrapper/gradle-wrapper.properties',
            'gradle/wrapper/gradle-wrapper.jar',
            'gradlew',
            'gradlew.bat',
          ].map(async (fileProjectPath) => ({
            file: {
              contents: await readBin(`./testFiles/${fileProjectPath}`),
              path: fileProjectPath,
              type: 'addition',
            },
          }))
        )
      );

      for (const file of [
        'gradle/wrapper/gradle-wrapper.properties',
        'gradle/wrapper/gradle-wrapper.jar',
        'gradlew',
        'gradlew.bat',
      ]) {
        await compareFile(file, 'expectedFiles');
      }
    });

    it('updates from version', async () => {
      git.getRepoStatus.mockResolvedValueOnce(
        partial<StatusResult>({
          modified: ['gradle/wrapper/gradle-wrapper.properties'],
        })
      );

      const result = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: ``,
        config: { ...config, newValue: '6.3' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].artifactError).toBeUndefined();

      await compareFile(
        'gradle/wrapper/gradle-wrapper.properties',
        'expectedFiles'
      );
    });

    it('up to date', async () => {
      git.getRepoStatus.mockResolvedValue({
        modified: [],
      } as StatusResult);

      const res = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./testFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config,
      });

      expect(res).toBeEmptyArray();

      // 5.6.4 => 5.6.4 (updates execs)
      // 6.3 => (5.6.4) (downgrades execs)
      // looks like a bug in Gradle
      for (const file of ['gradle/wrapper/gradle-wrapper.properties']) {
        await compareFile(file, 'testFiles-copy');
      }
    });

    it('getRepoStatus fails', async () => {
      git.getRepoStatus.mockImplementation(() => {
        throw new Error('failed');
      });

      const res = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./testFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config,
      });

      expect(res[0].artifactError.lockFile).toBe(
        'gradle/wrapper/gradle-wrapper.properties'
      );
      expect(res[0].artifactError.stderr).toBe('failed');

      // 5.6.4 => 5.6.4 (updates execs) - unexpected behavior (looks like a bug in Gradle)
      for (const file of ['gradle/wrapper/gradle-wrapper.properties']) {
        await compareFile(file, 'testFiles-copy');
      }
    });

    it('gradlew failed', async () => {
      const wrongCmdConfig = {
        ...adminConfig,
        localDir: resolve(fixtures, './wrongCmd'),
      };

      GlobalConfig.set(wrongCmdConfig);
      const res = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./testFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config,
      });

      expect(res[0].artifactError.lockFile).toBe(
        'gradle/wrapper/gradle-wrapper.properties'
      );
      expect(res[0].artifactError.stderr).not.toBeNull();
      expect(res[0].artifactError.stderr).not.toBe('');

      // 5.6.4 => 5.6.4 (updates execs) - unexpected behavior (looks like a bug in Gradle)
      for (const file of ['gradle/wrapper/gradle-wrapper.properties']) {
        await compareFile(file, 'testFiles-copy');
      }
    });

    it('gradlew not found', async () => {
      GlobalConfig.set({ localDir: 'some-dir' });
      const res = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: undefined,
        config: {},
      });

      expect(res).toBeNull();
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

      const newContent = await readString(`./gradle-wrapper-sum.properties`);

      const result = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: newContent.replace(
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
          '1f3067073041bc44554d0efe5d402a33bc3d3c93cc39ab684f308586d732a80d'
        ),
        config: {
          ...config,
          newValue: '6.3',
          currentValue: '5.6.4',
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].artifactError).toBeUndefined();

      expect(
        await readString(
          adminConfig.localDir,
          `gradle/wrapper/gradle-wrapper.properties`
        )
      ).toEqual(newContent);

      expect(httpMock.getTrace()).toEqual([
        {
          headers: {
            'accept-encoding': 'gzip, deflate, br',
            host: 'services.gradle.org',
            'user-agent':
              'RenovateBot/0.0.0-semantic-release (https://github.com/renovatebot/renovate)',
          },
          method: 'GET',
          url: 'https://services.gradle.org/distributions/gradle-6.3-bin.zip.sha256',
        },
      ]);
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
      expect(httpMock.getTrace()).toEqual([
        {
          headers: {
            'accept-encoding': 'gzip, deflate, br',
            host: 'services.gradle.org',
            'user-agent':
              'RenovateBot/0.0.0-semantic-release (https://github.com/renovatebot/renovate)',
          },
          method: 'GET',
          url: 'https://services.gradle.org/distributions/gradle-6.3-bin.zip.sha256',
        },
      ]);
    });
  });
});

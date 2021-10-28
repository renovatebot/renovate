import { readFile, readFileSync } from 'fs-extra';
import Git from 'simple-git';
import { resolve } from 'upath';
import * as httpMock from '../../../test/http-mock';
import { git, partial } from '../../../test/util';
import { setGlobalConfig } from '../../config/global';
import type { RepoGlobalConfig } from '../../config/types';
import type { StatusResult } from '../../util/git';
import { ifSystemSupportsGradle } from '../gradle/deep/__testutil__/gradle';
import type { UpdateArtifactsConfig } from '../types';
import * as gradleWrapper from '.';

jest.mock('../../util/git');

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

function readBinSync(...paths: string[]): Buffer {
  return readFileSync(resolve(fixtures, ...paths));
}

function compareFile(file: string, path: string) {
  expect(readBinSync(`./testFiles/${file}`)).toEqual(
    readBinSync(`./${path}/${file}`)
  );
}

describe('manager/gradle-wrapper/artifacts-real', () => {
  ifSystemSupportsGradle(6).describe('real tests', () => {
    jest.setTimeout(60 * 1000);

    beforeEach(() => {
      jest.resetAllMocks();
      setGlobalConfig(adminConfig);
    });

    afterEach(async () => {
      await Git(fixtures).checkout(['HEAD', '--', '.']);
      setGlobalConfig();
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
        [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradle/wrapper/gradle-wrapper.jar',
          'gradlew',
          'gradlew.bat',
        ].map((fileProjectPath) => ({
          file: {
            name: fileProjectPath,
            contents: readBinSync(`./testFiles/${fileProjectPath}`),
          },
        }))
      );

      [
        'gradle/wrapper/gradle-wrapper.properties',
        'gradle/wrapper/gradle-wrapper.jar',
        'gradlew',
        'gradlew.bat',
      ].forEach((file) => {
        compareFile(file, 'expectedFiles');
      });
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

      compareFile('gradle/wrapper/gradle-wrapper.properties', 'expectedFiles');
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
      ['gradle/wrapper/gradle-wrapper.properties'].forEach((file) => {
        compareFile(file, 'testFiles-copy');
      });
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

      expect(res[0].artifactError.lockFile).toEqual(
        'gradle/wrapper/gradle-wrapper.properties'
      );
      expect(res[0].artifactError.stderr).toEqual('failed');

      // 5.6.4 => 5.6.4 (updates execs) - unexpected behavior (looks like a bug in Gradle)
      ['gradle/wrapper/gradle-wrapper.properties'].forEach((file) => {
        compareFile(file, 'testFiles-copy');
      });
    });

    it('gradlew failed', async () => {
      const wrongCmdConfig = {
        ...adminConfig,
        localDir: resolve(fixtures, './wrongCmd'),
      };

      setGlobalConfig(wrongCmdConfig);
      const res = await gradleWrapper.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./testFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config,
      });

      expect(res[0].artifactError.lockFile).toEqual(
        'gradle/wrapper/gradle-wrapper.properties'
      );
      expect(res[0].artifactError.stderr).not.toBeNull();
      expect(res[0].artifactError.stderr).not.toEqual('');

      // 5.6.4 => 5.6.4 (updates execs) - unexpected behavior (looks like a bug in Gradle)
      ['gradle/wrapper/gradle-wrapper.properties'].forEach((file) => {
        compareFile(file, 'testFiles-copy');
      });
    });

    it('gradlew not found', async () => {
      setGlobalConfig({ localDir: 'some-dir' });
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
          `./gradle/wrapper/gradle-wrapper.properties`
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

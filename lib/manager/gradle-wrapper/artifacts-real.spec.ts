import { resolve } from 'path';
import { readFile, readFileSync } from 'fs-extra';
import Git from 'simple-git/promise';
import * as httpMock from '../../../test/httpMock';
import { getName, partial, platform } from '../../../test/util';
import { setUtilConfig } from '../../util';
import * as runCache from '../../util/cache/run';
import { ifSystemSupportsGradle } from '../gradle/__testutil__/gradle';
import * as dcUpdate from '.';

const fixtures = resolve(__dirname, './__fixtures__');
const config = {
  localDir: resolve(fixtures, './testFiles'),
  toVersion: '5.6.4',
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

describe(getName(__filename), () => {
  ifSystemSupportsGradle(6).describe('real tests', () => {
    jest.setTimeout(60 * 1000);

    beforeEach(async () => {
      jest.resetAllMocks();
      await setUtilConfig(config);
      httpMock.setup();
      runCache.clear();
    });

    afterEach(async () => {
      await Git(fixtures).checkout(['HEAD', '--', '.']);
      httpMock.reset();
    });

    it('replaces existing value', async () => {
      platform.getRepoStatus.mockResolvedValue({
        modified: [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradle/wrapper/gradle-wrapper.jar',
          'gradlew',
          'gradlew.bat',
        ],
      } as Git.StatusResult);

      const res = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./expectedFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config: { ...config, toVersion: '6.3' },
      });

      expect(res).toEqual(
        [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradle/wrapper/gradle-wrapper.jar',
          'gradlew',
          'gradlew.bat',
        ].map((fileProjectPath) => {
          return {
            file: {
              name: fileProjectPath,
              contents: readBinSync(`./testFiles/${fileProjectPath}`),
            },
          };
        })
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
      platform.getRepoStatus.mockResolvedValueOnce(
        partial<Git.StatusResult>({
          modified: ['gradle/wrapper/gradle-wrapper.properties'],
        })
      );

      const result = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: ``,
        config: { ...config, toVersion: '6.3' },
      });

      expect(result).toHaveLength(1);
      expect(result[0].artifactError).toBeUndefined();

      compareFile('gradle/wrapper/gradle-wrapper.properties', 'expectedFiles');
    });

    it('up to date', async () => {
      platform.getRepoStatus.mockResolvedValue({
        modified: [],
      } as Git.StatusResult);

      const res = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./testFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config,
      });

      expect(res).toEqual([]);

      // 5.6.4 => 5.6.4 (updates execs)
      // 6.3 => (5.6.4) (downgrades execs)
      // looks like a bug in Gradle
      ['gradle/wrapper/gradle-wrapper.properties'].forEach((file) => {
        compareFile(file, 'testFiles-copy');
      });
    });

    it('getRepoStatus fails', async () => {
      platform.getRepoStatus.mockImplementation(() => {
        throw new Error('failed');
      });

      const res = await dcUpdate.updateArtifacts({
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
      const cfg = { ...config, localDir: resolve(fixtures, './wrongCmd') };

      await setUtilConfig(cfg);
      const res = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: await readString(
          `./testFiles/gradle/wrapper/gradle-wrapper.properties`
        ),
        config: cfg,
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

    it('updates distributionSha256Sum', async () => {
      httpMock
        .scope('https://services.gradle.org')
        .get('/distributions/gradle-6.3-bin.zip.sha256')
        .reply(
          200,
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768'
        );

      platform.getRepoStatus.mockResolvedValueOnce(
        partial<Git.StatusResult>({
          modified: ['gradle/wrapper/gradle-wrapper.properties'],
        })
      );

      const newContent = await readString(`./gradle-wrapper-sum.properties`);

      const result = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle/wrapper/gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: newContent.replace(
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768',
          '1f3067073041bc44554d0efe5d402a33bc3d3c93cc39ab684f308586d732a80d'
        ),
        config: {
          ...config,
          toVersion: '6.3',
          currentValue: '5.6.4',
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].artifactError).toBeUndefined();

      expect(
        await readString(
          config.localDir,
          `./gradle/wrapper/gradle-wrapper.properties`
        )
      ).toEqual(newContent);

      expect(httpMock.getTrace()).toEqual([
        {
          headers: {
            'accept-encoding': 'gzip, deflate',
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
            'accept-encoding': 'gzip, deflate',
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
});

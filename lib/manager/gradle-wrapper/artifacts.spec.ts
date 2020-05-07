import { readFileSync } from 'fs';
import { resolve } from 'path';
import Git from 'simple-git/promise';
import { mockExecAll } from '../../../test/execUtil';
import * as httpMock from '../../../test/httpMock';
import { bufferSerializer, getName, mocked, partial } from '../../../test/util';
import { platform as _platform } from '../../platform';
import { setUtilConfig } from '../../util';
import { clearRepoCache } from '../../util/cache';
import { ifSystemSupportsGradle } from '../gradle/__testutil__/gradle';
import * as dcUpdate from '.';

const platform = mocked(_platform);
const config = {
  localDir: resolve(__dirname, './__fixtures__/testFiles'),
  toVersion: '5.6.4',
};

jest.mock('../../platform');

async function resetTestFiles() {
  await dcUpdate.updateArtifacts({
    packageFileName: 'gradle-wrapper.properties',
    updatedDeps: [],
    newPackageFileContent: `https://services.gradle.org/distributions/gradle-5.6.4-bin.zip`,
    config,
  });
}

expect.addSnapshotSerializer(bufferSerializer());

describe(getName(__filename), () => {
  beforeEach(async () => {
    jest.setTimeout(5 * 60 * 1000);
    jest.resetAllMocks();
    await setUtilConfig(config);
    await resetTestFiles();
  });
  describe('updateArtifacts - replaces existing value', () => {
    ifSystemSupportsGradle(6).it('replaces existing value', async () => {
      platform.getRepoStatus.mockResolvedValue({
        modified: [
          'gradle/wrapper/gradle-wrapper.properties',
          'gradle/wrapper/gradle-wrapper.jar',
          'gradlew',
          'gradlew.bat',
        ],
      } as Git.StatusResult);

      const res = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: readFileSync(
          resolve(
            __dirname,
            `./__fixtures__/expectedFiles/gradle/wrapper/gradle-wrapper.properties`
          ),
          'utf8'
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
              contents: readFileSync(
                resolve(
                  __dirname,
                  `./__fixtures__/testFiles/${fileProjectPath}`
                )
              ),
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
        expect(
          readFileSync(
            resolve(__dirname, `./__fixtures__/testFiles/${file}`),
            'utf8'
          )
        ).toEqual(
          readFileSync(
            resolve(__dirname, `./__fixtures__/expectedFiles/${file}`),
            'utf8'
          )
        );
      });
    });
  });
  describe('updateArtifacts - up to date', () => {
    ifSystemSupportsGradle(6).it('up to date', async () => {
      platform.getRepoStatus.mockResolvedValue({
        modified: [],
      } as Git.StatusResult);

      const res = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: readFileSync(
          resolve(
            __dirname,
            `./__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties`
          ),
          'utf8'
        ),
        config,
      });

      expect(res).toEqual([]);

      // 5.6.4 => 5.6.4 (updates execs)
      // 6.3 => (5.6.4) (downgrades execs)
      // looks like a bug in Gradle
      ['gradle/wrapper/gradle-wrapper.properties'].forEach((file) => {
        expect(
          readFileSync(
            resolve(__dirname, `./__fixtures__/testFiles/${file}`),
            'utf8'
          )
        ).toEqual(
          readFileSync(
            resolve(__dirname, `./__fixtures__/testFiles-copy/${file}`),
            'utf8'
          )
        );
      });
    });
  });
  describe('updateArtifacts - error handling - getRepoStatus', () => {
    ifSystemSupportsGradle(6).it('error handling - getRepoStatus', async () => {
      platform.getRepoStatus.mockImplementation(() => {
        throw new Error('failed');
      });

      const res = await dcUpdate.updateArtifacts({
        packageFileName: 'gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: readFileSync(
          resolve(
            __dirname,
            `./__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties`
          ),
          'utf8'
        ),
        config,
      });

      expect(res[0].artifactError.lockFile).toEqual(
        'gradle-wrapper.properties'
      );
      expect(res[0].artifactError.stderr).toEqual('failed');

      // 5.6.4 => 5.6.4 (updates execs) - unexpected behavior (looks like a bug in Gradle)
      ['gradle/wrapper/gradle-wrapper.properties'].forEach((file) => {
        expect(
          readFileSync(
            resolve(__dirname, `./__fixtures__/testFiles/${file}`),
            'utf8'
          )
        ).toEqual(
          readFileSync(
            resolve(__dirname, `./__fixtures__/testFiles-copy/${file}`),
            'utf8'
          )
        );
      });
    });
  });
  describe('updateArtifacts - error handling - command execution', () => {
    ifSystemSupportsGradle(6).it(
      'error handling - command execution',
      async () => {
        const res = await dcUpdate.updateArtifacts({
          packageFileName: 'gradle-wrapper.properties',
          updatedDeps: [],
          newPackageFileContent: readFileSync(
            resolve(
              __dirname,
              `./__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties`
            ),
            'utf8'
          ),
          config: {
            localDir: 'some/incorrect/path',
          },
        });

        expect(res[0].artifactError.lockFile).toEqual(
          'gradle-wrapper.properties'
        );
        expect(res[0].artifactError.stderr).not.toBeNull();
        expect(res[0].artifactError.stderr).not.toEqual('');

        // 5.6.4 => 5.6.4 (updates execs) - unexpected behavior (looks like a bug in Gradle)
        ['gradle/wrapper/gradle-wrapper.properties'].forEach((file) => {
          expect(
            readFileSync(
              resolve(__dirname, `./__fixtures__/testFiles/${file}`),
              'utf8'
            )
          ).toEqual(
            readFileSync(
              resolve(__dirname, `./__fixtures__/testFiles-copy/${file}`),
              'utf8'
            )
          );
        });
      }
    );
  });

  describe('updateArtifacts - distributionSha256Sum', () => {
    let exec: jest.Mock<typeof import('child_process').exec>;
    let api: typeof dcUpdate;

    beforeAll(async () => {
      jest.mock('child_process');
      exec = (await import('child_process')).exec as never;
      api = await import('.');
    });

    beforeEach(() => {
      httpMock.setup();
    });

    afterEach(() => {
      httpMock.reset();
      clearRepoCache();
    });

    it('updates', async () => {
      const execSnapshots = mockExecAll(exec);
      httpMock
        .scope('https://services.gradle.org')
        .get('/distributions/gradle-6.3-bin.zip.sha256')
        .reply(
          200,
          '038794feef1f4745c6347107b6726279d1c824f3fc634b60f86ace1e9fbd1768'
        );

      platform.getRepoStatus.mockResolvedValueOnce(
        partial<Git.StatusResult>({
          modified: [
            'gradle/wrapper/gradle-wrapper.properties',
            'gradle/wrapper/gradle-wrapper.jar',
            'gradlew',
            'gradlew.bat',
          ],
        })
      );

      const result = await api.updateArtifacts({
        packageFileName: 'gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
        config: {
          localDir: 'some-dir',
        },
      });

      expect(result).toMatchSnapshot('result');
      expect(execSnapshots).toMatchSnapshot('exeSnapshots');
      expect(httpMock.getTrace()).toMatchSnapshot('httpSnapshots');
    });

    it('artifact error', async () => {
      const execSnapshots = mockExecAll(exec);
      httpMock
        .scope('https://services.gradle.org')
        .get('/distributions/gradle-6.3-bin.zip.sha256')
        .reply(404);

      const result = await api.updateArtifacts({
        packageFileName: 'gradle-wrapper.properties',
        updatedDeps: [],
        newPackageFileContent: `distributionSha256Sum=336b6898b491f6334502d8074a6b8c2d73ed83b92123106bd4bf837f04111043\ndistributionUrl=https\\://services.gradle.org/distributions/gradle-6.3-bin.zip`,
        config: {
          localDir: 'some-dir',
        },
      });

      expect(result).toEqual([
        {
          artifactError: {
            lockFile: 'gradle-wrapper.properties',
            stderr: 'Response code 404 (Not Found)',
          },
        },
      ]);
      expect(execSnapshots).toEqual([]);
      expect(httpMock.getTrace()).toMatchSnapshot('httpSnapshots');
    });
  });
});

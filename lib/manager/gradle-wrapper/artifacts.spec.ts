import { readFileSync } from 'fs';
import { resolve } from 'path';
import Git from 'simple-git/promise';
import * as dcUpdate from '.';
import { platform as _platform } from '../../platform';
import { mocked, getName } from '../../../test/util';
import { ifSystemSupportsGradle } from '../gradle/__testutil__/gradle';
import { setUtilConfig } from '../../util';

const platform = mocked(_platform);
const config = {
  localDir: resolve(__dirname, './__fixtures__/testFiles'),
};

jest.mock('../../util/got');
jest.mock('../../platform');

async function resetTestFiles() {
  await dcUpdate.updateArtifacts({
    packageFileName: 'gradle-wrapper.properties',
    updatedDeps: [],
    newPackageFileContent: `https://services.gradle.org/distributions/gradle-5.6.4-bin.zip`,
    config,
  });
}

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
        config,
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
          readFileSync(resolve(__dirname, `./__fixtures__/testFiles/${file}`))
        ).toEqual(
          readFileSync(
            resolve(__dirname, `./__fixtures__/expectedFiles/${file}`)
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
        throw new Error();
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
});

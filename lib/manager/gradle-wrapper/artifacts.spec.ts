import { readFileSync } from 'fs';
import { resolve } from 'path';
import Git from 'simple-git/promise';
import * as dcUpdate from '.';
import { platform as _platform } from '../../platform';
import { mocked } from '../../../test/util';
import { ifSystemSupportsGradle } from '../gradle/__testutil__/gradle';

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

describe('manager/gradle-wrapper/update', () => {
  describe('updateArtifacts - replaces existing value', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.resetAllMocks();
      jest.clearAllMocks();
    });

    ifSystemSupportsGradle(6).it('replaces existing value', async () => {
      try {
        jest.setTimeout(5 * 60 * 1000);
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
          ].map(fileProjectPath => {
            return {
              artifactError: null,
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
        ].forEach(file => {
          expect(
            readFileSync(resolve(__dirname, `./__fixtures__/testFiles/${file}`))
          ).toEqual(
            readFileSync(
              resolve(__dirname, `./__fixtures__/expectedFiles/${file}`)
            )
          );
        });
      } finally {
        await resetTestFiles();
      }
    });
  });
  describe('updateArtifacts - up to date', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.resetAllMocks();
      jest.clearAllMocks();
    });

    ifSystemSupportsGradle(6).it('up to date', async () => {
      try {
        jest.setTimeout(5 * 60 * 1000);
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
        ['gradle/wrapper/gradle-wrapper.properties'].forEach(file => {
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
      } finally {
        await resetTestFiles();
      }
    });
  });
  describe('updateArtifacts - error handling - getRepoStatus', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.resetAllMocks();
      jest.clearAllMocks();
    });

    ifSystemSupportsGradle(6).it('error handling - getRepoStatus', async () => {
      try {
        jest.setTimeout(5 * 60 * 1000);
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
        ['gradle/wrapper/gradle-wrapper.properties'].forEach(file => {
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
      } finally {
        await resetTestFiles();
      }
    });
  });

  describe('updateArtifacts - error handling - command execution', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.resetAllMocks();
      jest.clearAllMocks();
    });

    ifSystemSupportsGradle(6).it(
      'error handling - command execution',
      async () => {
        try {
          jest.setTimeout(5 * 60 * 1000);

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
          ['gradle/wrapper/gradle-wrapper.properties'].forEach(file => {
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
        } finally {
          await resetTestFiles();
        }
      }
    );
  });
});

import { readFileSync } from 'fs';
import { resolve } from 'path';
import Git from 'simple-git/promise';
import * as dcUpdate from '.';
import { platform as _platform } from '../../platform';
import { mocked } from '../../../test/util';

const platform = mocked(_platform);

jest.mock('../../util/got');
jest.mock('../../platform');

async function resetTestFiles() {
  await dcUpdate.updateArtifacts({
    packageFileName: resolve(
      __dirname,
      './__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties'
    ),
    updatedDeps: [],
    newPackageFileContent: `https://services.gradle.org/distributions/gradle-5.6.4-bin.zip`,
    config: null,
  });
}

describe('manager/gradle-wrapper/update', () => {
  describe('updateArtifacts - replaces existing value', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.resetAllMocks();
      jest.clearAllMocks();
    });

    it('replaces existing value', async () => {
      try {
        jest.setTimeout(5 * 60 * 1000);
        platform.getRepoStatus.mockResolvedValue({
          modified: [
            'gradle/wrapper/gradle-wrapper.properties',
            'gradle/wrapper/gradle-wrapper.jar',
            'gradlew',
            'gradlew.bat',
          ].map(filename =>
            resolve(__dirname, `./__fixtures__/testFiles/${filename}`)
          ),
        } as Git.StatusResult);

        const res = await dcUpdate.updateArtifacts({
          packageFileName: resolve(
            __dirname,
            './__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties'
          ),
          updatedDeps: [],
          newPackageFileContent: readFileSync(
            resolve(
              __dirname,
              `./__fixtures__/expectedFiles/gradle/wrapper/gradle-wrapper.properties`
            ),
            'utf8'
          ),
          config: null,
        });

        expect(res).toEqual(
          [
            'gradle/wrapper/gradle-wrapper.properties',
            'gradle/wrapper/gradle-wrapper.jar',
            'gradlew',
            'gradlew.bat',
          ]
            .map(filename =>
              resolve(__dirname, `./__fixtures__/testFiles/${filename}`)
            )
            .map(filePath => {
              return {
                artifactError: null,
                file: {
                  name: filePath,
                  contents: readFileSync(filePath, 'utf8'),
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

    it('up to date', async () => {
      try {
        jest.setTimeout(5 * 60 * 1000);
        platform.getRepoStatus.mockResolvedValue({
          modified: [],
        } as Git.StatusResult);

        const res = await dcUpdate.updateArtifacts({
          packageFileName: resolve(
            __dirname,
            './__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties'
          ),
          updatedDeps: [],
          newPackageFileContent: readFileSync(
            resolve(
              __dirname,
              `./__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties`
            ),
            'utf8'
          ),
          config: null,
        });

        expect(res).toEqual([]);

        // 5.6.4 => 5.6.4 (updates execs)
        // 6.3 => (5.6.4) (downgrades execs)
        // look like a bug in Gradle
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
  describe('updateArtifacts - error handling', () => {
    beforeEach(() => {
      jest.resetModules();
      jest.resetAllMocks();
      jest.clearAllMocks();
    });

    it('error handling', async () => {
      try {
        jest.setTimeout(5 * 60 * 1000);
        platform.getRepoStatus.mockImplementation(() => {
          throw new Error();
        });

        const res = await dcUpdate.updateArtifacts({
          packageFileName: resolve(
            __dirname,
            './__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties'
          ),
          updatedDeps: [],
          newPackageFileContent: readFileSync(
            resolve(
              __dirname,
              `./__fixtures__/testFiles/gradle/wrapper/gradle-wrapper.properties`
            ),
            'utf8'
          ),
          config: null,
        });

        expect(res).toEqual(null);

        // 5.6.4 => 5.6.4 (updates execs) -  unexpected behavior (looks like a bug in Gradle)
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
});

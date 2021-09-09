import * as fs from 'fs-extra';
import tmp, { DirectoryResult } from 'tmp-promise';
import * as upath from 'upath';
import { setGlobalConfig } from '../../../config/global';
import { exec } from '../../../util/exec';
import { extraEnv } from '../../gradle-wrapper/utils';
import { ifSystemSupportsGradle } from './__testutil__/gradle';
import {
  GRADLE_DEPENDENCY_REPORT_FILENAME,
  createRenovateGradlePlugin,
} from './gradle-updates-report';
import { GRADLE_DEPENDENCY_REPORT_OPTIONS } from '.';

const fixtures = 'lib/manager/gradle/deep/__fixtures__';

describe('manager/gradle/deep/gradle-updates-report', () => {
  for (const gradleVersion of [5, 6]) {
    ifSystemSupportsGradle(gradleVersion).describe(
      'createRenovateGradlePlugin',
      () => {
        let workingDir: DirectoryResult;

        beforeEach(async () => {
          workingDir = await tmp.dir({ unsafeCleanup: true });
          setGlobalConfig({ localDir: workingDir.path });
        });

        afterEach(() => workingDir.cleanup());

        it(`generates a report for Gradle version ${gradleVersion}`, async () => {
          await fs.copy(`${fixtures}/minimal-project`, workingDir.path);
          await fs.copy(
            `${fixtures}/gradle-wrappers/${gradleVersion}`,
            workingDir.path
          );
          await createRenovateGradlePlugin();

          const gradlew = upath.join(workingDir.path, 'gradlew');
          await exec(`${gradlew} ${GRADLE_DEPENDENCY_REPORT_OPTIONS}`, {
            cwd: workingDir.path,
            extraEnv,
          });
          expect(
            fs.readJSONSync(
              `${workingDir.path}/${GRADLE_DEPENDENCY_REPORT_FILENAME}`
            )
          ).toMatchSnapshot([
            {
              dependencies: [
                {
                  group: 'org.apache.commons',
                  name: 'commons-collections4',
                  version: '4.4',
                },
              ],
              project: 'minimal-test',
              repositories: [
                'https://jcenter.bintray.com/',
                'https://plugins.gradle.org/m2',
              ],
            },
          ]);
        }, 120000);
      }
    );
  }
});

import * as fs from 'fs-extra';
import tmp, { DirectoryResult } from 'tmp-promise';
import * as upath from 'upath';
import { getName } from '../../../test/util';
import { exec } from '../../util/exec';
import { ifSystemSupportsGradle } from './__testutil__/gradle';
import {
  GRADLE_DEPENDENCY_REPORT_FILENAME,
  createRenovateGradlePlugin,
} from './gradle-updates-report';
import { extraEnv } from './utils';
import { GRADLE_DEPENDENCY_REPORT_OPTIONS } from '.';

const fixtures = 'lib/manager/gradle/__fixtures__';

describe(getName(__filename), () => {
  for (const gradleVersion of [5, 6]) {
    ifSystemSupportsGradle(gradleVersion).describe(
      'createRenovateGradlePlugin',
      () => {
        let workingDir: DirectoryResult;

        beforeEach(async () => {
          workingDir = await tmp.dir({ unsafeCleanup: true });
        });

        it(`generates a report for Gradle version ${gradleVersion}`, async () => {
          await fs.copy(`${fixtures}/minimal-project`, workingDir.path);
          await fs.copy(
            `${fixtures}/gradle-wrappers/${gradleVersion}`,
            workingDir.path
          );
          await createRenovateGradlePlugin(workingDir.path);

          const gradlew = upath.join(workingDir.path, 'gradlew');
          await exec(`${gradlew} ${GRADLE_DEPENDENCY_REPORT_OPTIONS}`, {
            cwd: workingDir.path,
            extraEnv,
          });
          expect(
            fs.readJSONSync(
              `${workingDir.path}/${GRADLE_DEPENDENCY_REPORT_FILENAME}`
            )
          ).toMatchSnapshot();
        }, 120000);
      }
    );
  }
});

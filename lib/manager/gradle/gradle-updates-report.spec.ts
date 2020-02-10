import tmp, { DirectoryResult } from 'tmp-promise';
import * as fs from 'fs-extra';
import { exec } from '../../util/exec';
import { GRADLE_DEPENDENCY_REPORT_OPTIONS } from './index';
import {
  createRenovateGradlePlugin,
  GRADLE_DEPENDENCY_REPORT_FILENAME,
} from './gradle-updates-report';

const fixtures = 'lib/manager/gradle/__fixtures__';

const gradleJavaVersionSupport = {
  5: { min: 8, max: 12 },
  6: { min: 8, max: 13 },
};

function parseJavaVersion(javaVersionOutput) {
  const versionMatch = /version "(?:1\.)?(\d+)[\d._-]*"/.exec(
    javaVersionOutput
  );
  if (versionMatch !== null && versionMatch.length === 2) {
    return parseInt(versionMatch[1], 10);
  }
  return 0;
}

describe('lib/manager/gradle/gradle-updates-report', () => {
  let workingDir: DirectoryResult;
  let javaVersion: number;
  const skipJava = process.env.NO_JAVA === 'true';

  beforeAll(async () => {
    if (!skipJava) {
      javaVersion = await exec('java -version').then(({ stderr }) =>
        parseJavaVersion(stderr)
      );
    }
  });

  beforeEach(async () => {
    workingDir = await tmp.dir({ unsafeCleanup: true });
  });

  describe('createRenovateGradlePlugin', () => {
    for (const gradleVersion of [5, 6]) {
      const supportedJavaVersions = gradleJavaVersionSupport[gradleVersion];
      // building functions and variable access are intentional
      // eslint-disable-next-line no-loop-func
      it(`generates a report for Gradle versiradlon ${gradleVersion}`, async () => {
        if (
          skipJava ||
          javaVersion < supportedJavaVersions.min ||
          javaVersion > supportedJavaVersions.max
        ) {
          return;
        }
        await fs.copy(`${fixtures}/minimal-project`, workingDir.path);
        await fs.copy(
          `${fixtures}/gradle-wrappers/${gradleVersion}`,
          workingDir.path
        );
        await createRenovateGradlePlugin(workingDir.path);

        await exec(`./gradlew ${GRADLE_DEPENDENCY_REPORT_OPTIONS}`, {
          cwd: workingDir.path,
        });
        expect(
          fs.readJSONSync(
            `${workingDir.path}/${GRADLE_DEPENDENCY_REPORT_FILENAME}`
          )
        ).toMatchSnapshot();
      }, 120000);
    }
  });
});

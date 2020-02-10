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

  beforeAll(async () => {
    javaVersion = await exec('java -version').then(({ stderr }) =>
      parseJavaVersion(stderr)
    );
  });

  beforeEach(async () => {
    workingDir = await tmp.dir({ unsafeCleanup: true });
  });

  describe('createRenovateGradlePlugin', () => {
    it.each([[5], [6]])(
      `generates a report for Gradle version %i`,
      async (gradleVersion: number) => {
        const supportedJavaVersions = gradleJavaVersionSupport[gradleVersion];
        if (
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
      },
      120000
    );
  });
});

import tmp, { DirectoryResult } from 'tmp-promise';
import * as fs from 'fs-extra';
import { exec } from '../../util/exec';
import { GRADLE_DEPENDENCY_REPORT_OPTIONS } from './index';
import {
  createRenovateGradlePlugin,
  GRADLE_DEPENDENCY_REPORT_FILENAME,
} from './gradle-updates-report';

const fixtures = 'lib/manager/gradle/__fixtures__';
const skipJavaTestsEnv = 'SKIP_JAVA_TESTS';

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
  const skipJava = process.env[skipJavaTestsEnv] !== undefined;

  beforeAll(async () => {
    javaVersion = await exec('java -version')
      .then(({ stderr }) => parseJavaVersion(stderr))
      .catch(reason => {
        throw Error(
          `This test suite needs Java. Please provide Java or set the environment variable ${skipJavaTestsEnv} to true.
Output of java -version:
${reason}`
        );
      });
  });

  beforeEach(async () => {
    workingDir = await tmp.dir({ unsafeCleanup: true });
  });

  describe('createRenovateGradlePlugin', () => {
    (skipJava ? it.skip : it).each([[5], [6]])(
      `generates a report for Gradle version %i`,
      async (gradleVersion: number) => {
        const supportedJavaVersions = gradleJavaVersionSupport[gradleVersion];
        if (
          javaVersion < supportedJavaVersions.min ||
          javaVersion > supportedJavaVersions.max
        ) {
          throw Error(
            `This test needs a Java version between ${supportedJavaVersions.min} and ${supportedJavaVersions.max}`
          );
        }
        await fs.copy(`${fixtures}/minimal-project`, workingDir.path);
        await fs.copy(
          `${fixtures}/gradle-wrappers/${gradleVersion}`,
          workingDir.path
        );
        await createRenovateGradlePlugin(workingDir.path);

        await exec(`gradlew ${GRADLE_DEPENDENCY_REPORT_OPTIONS}`, {
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

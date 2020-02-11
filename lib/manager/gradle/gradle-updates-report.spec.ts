import tmp, { DirectoryResult } from 'tmp-promise';
import * as fs from 'fs-extra';
import * as path from 'path';
import { spawnSync, SpawnSyncReturns } from 'child_process';
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

function parseJavaVersion(javaVersionOutput: string) {
  const versionMatch = /version "(?:1\.)?(\d+)[\d._-]*"/.exec(
    javaVersionOutput
  );
  if (versionMatch !== null && versionMatch.length === 2) {
    return parseInt(versionMatch[1], 10);
  }
  return 0;
}

function determineJavaVersion(): number {
  let error;
  let javaVersionCommand: SpawnSyncReturns<string>;
  try {
    javaVersionCommand = spawnSync('java', ['-version'], {
      encoding: 'utf8',
      windowsHide: true,
    });
  } catch (e) {
    error = e;
  }
  if (error)
    throw Error(
      `This test suite needs Java. Please provide Java or set the environment variable ${skipJavaTestsEnv} to true.
Output of java -version:
${error}`
    );
  return parseJavaVersion(javaVersionCommand.stderr);
}

describe('lib/manager/gradle/gradle-updates-report', () => {
  let workingDir: DirectoryResult;
  const javaVersion = determineJavaVersion();
  const skipJava = process.env[skipJavaTestsEnv] !== undefined;

  beforeEach(async () => {
    workingDir = await tmp.dir({ unsafeCleanup: true });
  });

  describe('createRenovateGradlePlugin', () => {
    for (const gradleVersion of [5, 6]) {
      const supportedJavaVersions = gradleJavaVersionSupport[gradleVersion];
      const gradleSupportsThisJavaVersion =
        javaVersion >= supportedJavaVersions.min &&
        javaVersion <= supportedJavaVersions.max;
      (skipJava || !gradleSupportsThisJavaVersion ? it.skip : it)(
        `generates a report for Gradle version ${gradleVersion}`,
        // the function creation is correct and intended
        // eslint-disable-next-line no-loop-func
        async () => {
          await fs.copy(`${fixtures}/minimal-project`, workingDir.path);
          await fs.copy(
            `${fixtures}/gradle-wrappers/${gradleVersion}`,
            workingDir.path
          );
          await createRenovateGradlePlugin(workingDir.path);

          const gradlew = path.join(workingDir.path, 'gradlew');
          await exec(`${gradlew} ${GRADLE_DEPENDENCY_REPORT_OPTIONS}`, {
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
    }
  });
});

import fsExtra from 'fs-extra';
import tmp, { DirectoryResult } from 'tmp-promise';
import { getName } from '../../../test/util';
import type { ExtractConfig } from '../types';
import { ifSystemSupportsGradle } from './__testutil__/gradle';
import * as manager from '.';

const fixtures = 'lib/manager/gradle/__fixtures__';

const baseConfig = {
  gradle: {
    timeout: 60,
  },
};

describe(getName(__filename), () => {
  ifSystemSupportsGradle(6).describe('executeGradle integration', () => {
    const SUCCESS_FILE_NAME = 'success.indicator';
    let workingDir: DirectoryResult;
    let testRunConfig: ExtractConfig;
    let successFile: string;

    beforeEach(async () => {
      workingDir = await tmp.dir({ unsafeCleanup: true });
      successFile = '';
      testRunConfig = { ...baseConfig, localDir: workingDir.path };
      await fsExtra.copy(`${fixtures}/minimal-project`, workingDir.path);
      await fsExtra.copy(`${fixtures}/gradle-wrappers/6`, workingDir.path);

      const mockPluginContent = `
allprojects {
  tasks.register("renovate") {
    doLast {
      new File('${SUCCESS_FILE_NAME}').write 'success'
    }
  }
}`;
      await fsExtra.writeFile(
        `${workingDir.path}/renovate-plugin.gradle`,
        mockPluginContent
      );
      successFile = `${workingDir.path}/${SUCCESS_FILE_NAME}`;
    });

    it('executes an executable gradle wrapper', async () => {
      const gradlew = await fsExtra.stat(`${workingDir.path}/gradlew`);
      await manager.executeGradle(testRunConfig, workingDir.path, gradlew);
      await expect(fsExtra.readFile(successFile, 'utf8')).resolves.toBe(
        'success'
      );
    }, 120000);

    it('executes a not-executable gradle wrapper', async () => {
      await fsExtra.chmod(`${workingDir.path}/gradlew`, '444');
      const gradlew = await fsExtra.stat(`${workingDir.path}/gradlew`);

      await manager.executeGradle(testRunConfig, workingDir.path, gradlew);
      await expect(fsExtra.readFile(successFile, 'utf8')).resolves.toBe(
        'success'
      );
    }, 120000);
  });
});

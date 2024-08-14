import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const genericCaseFileContent = Fixtures.get('generic-case.sdkmanrc');
const unknownDepFileContent = Fixtures.get('unknown-dep.sdkmanrc');

describe('modules/manager/sdkman/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts dependencies in a generic case', () => {
      // when
      const packageFile = extractPackageFile(genericCaseFileContent);

      // then
      expect(packageFile).toEqual({
        deps: [
          {
            currentValue: '21.0.3-tem',
            datasource: 'java-version',
            depName: 'java',
            replaceString: 'java=21.0.3-tem',
          },
          {
            currentValue: '8.10',
            datasource: 'gradle-version',
            depName: 'gradle',
            replaceString: 'gradle =8.10',
          },
          {
            currentValue: '3.9.8',
            datasource: 'maven',
            depName: 'maven',
            replaceString: 'maven= 3.9.8',
          },
          {
            currentValue: '1.10.1',
            datasource: 'ivy',
            depName: 'sbt',
            replaceString: 'sbt = 1.10.1',
          },
        ],
      });
    });

    it('unknown dependencies', () => {
      // when
      const packageFile = extractPackageFile(unknownDepFileContent);

      // then
      expect(packageFile).toBeNull();
    });
  });
});

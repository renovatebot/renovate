import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const genericCaseFileContent = Fixtures.get('generic-case.main.kts');
const customRepositoriesFileContent = Fixtures.get(
  'custom-repositories.main.kts',
);
const missingPartsFileContent = Fixtures.get('missing-parts.main.kts');

describe('modules/manager/kotlin-script/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts dependencies in a generic case', () => {
      // when
      const packageFile = extractPackageFile(genericCaseFileContent);

      // then
      expect(packageFile).toEqual({
        deps: [
          {
            depName: 'it.krzeminski:github-actions-kotlin-dsl',
            currentValue: '0.22.0',
            replaceString: '"it.krzeminski:github-actions-kotlin-dsl:0.22.0"',
            datasource: 'maven',
          },
          {
            depName: 'org.eclipse.jgit:org.eclipse.jgit',
            currentValue: '4.6.0.201612231935-r',
            replaceString:
              '"org.eclipse.jgit:org.eclipse.jgit:4.6.0.201612231935-r"',
            datasource: 'maven',
          },
          {
            depName: 'org.jetbrains.lets-plot:lets-plot-kotlin-jvm',
            currentValue: '3.0.2',
            replaceString:
              '"org.jetbrains.lets-plot:lets-plot-kotlin-jvm:3.0.2"',
            datasource: 'maven',
          },
        ],
      });
    });

    it('detects custom repository definitions', () => {
      // when
      const packageFile = extractPackageFile(customRepositoriesFileContent);

      // then
      expect(packageFile).toEqual({
        deps: [
          {
            depName: 'it.krzeminski:github-actions-kotlin-dsl',
            currentValue: '0.22.0',
            replaceString: '"it.krzeminski:github-actions-kotlin-dsl:0.22.0"',
            datasource: 'maven',
          },
          {
            depName: 'org.eclipse.jgit:org.eclipse.jgit',
            currentValue: '4.6.0.201612231935-r',
            replaceString:
              '"org.eclipse.jgit:org.eclipse.jgit:4.6.0.201612231935-r"',
            datasource: 'maven',
          },
        ],
        registryUrls: [
          'https://jitpack.io',
          'https://some.other.repo/foo/bar/baz',
        ],
      });
    });

    it('no dependencies', () => {
      // when
      const packageFile = extractPackageFile(`
        #!/usr/bin/env kotlin
        println("Hello world")`);

      // then
      expect(packageFile).toBeNull();
    });

    it('skips dependencies with missing parts', () => {
      // when
      const packageFile = extractPackageFile(missingPartsFileContent);

      // then
      expect(packageFile).toEqual({
        deps: [
          {
            depName: 'it.krzeminski:github-actions-kotlin-dsl',
            currentValue: '0.22.0',
            replaceString: '"it.krzeminski:github-actions-kotlin-dsl:0.22.0"',
            datasource: 'maven',
          },
        ],
      });
    });
  });
});

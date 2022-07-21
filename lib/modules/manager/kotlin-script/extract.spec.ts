import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from '.';

const genericCaseMainKtsFileContent = Fixtures.get('generic-case.main.kts');
const genericCaseKtsFileContent = Fixtures.get('generic-case.kts');
const customRepositoriesFileContent = Fixtures.get(
  'custom-repositories.main.kts'
);

describe('modules/manager/kotlin-script/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts dependencies in a generic case - .main.kts', () => {
      // when
      const packageFile = extractPackageFile(
        genericCaseMainKtsFileContent,
        'generic-case.main.kts'
      );

      // then
      expect(packageFile?.deps).toEqual([
        {
          depName: 'it.krzeminski:github-actions-kotlin-dsl',
          currentValue: '0.22.0',
          replaceString: '"it.krzeminski:github-actions-kotlin-dsl:0.22.0"',
          datasource: 'maven',
          registryUrls: null,
        },
        {
          depName: 'org.eclipse.jgit:org.eclipse.jgit',
          currentValue: '4.6.0.201612231935-r',
          replaceString:
            '"org.eclipse.jgit:org.eclipse.jgit:4.6.0.201612231935-r"',
          datasource: 'maven',
          registryUrls: null,
        },
        {
          depName: 'org.jetbrains.lets-plot:lets-plot-kotlin-jvm',
          currentValue: '3.0.2',
          replaceString: '"org.jetbrains.lets-plot:lets-plot-kotlin-jvm:3.0.2"',
          datasource: 'maven',
          registryUrls: null,
        },
      ]);
    });

    it('extracts dependencies in a generic case - .kts', () => {
      // when
      const packageFile = extractPackageFile(
        genericCaseKtsFileContent,
        'generic-case.kts'
      );

      // then
      expect(packageFile?.deps).toEqual([
        {
          depName: 'it.krzeminski:github-actions-kotlin-dsl',
          currentValue: '0.22.0',
          replaceString: '"it.krzeminski:github-actions-kotlin-dsl:0.22.0"',
          datasource: 'maven',
          registryUrls: null,
        },
      ]);
    });

    it('detects custom repository definitions - .main.kts', () => {
      // when
      const packageFile = extractPackageFile(
        customRepositoriesFileContent,
        'custom-repositories.main.kts'
      );

      // then
      expect(packageFile?.deps).toEqual([
        {
          depName: 'it.krzeminski:github-actions-kotlin-dsl',
          currentValue: '0.22.0',
          replaceString: '"it.krzeminski:github-actions-kotlin-dsl:0.22.0"',
          datasource: 'maven',
          registryUrls: [
            'https://jitpack.io',
            'https://some.other.repo/foo/bar/baz',
          ],
        },
        {
          depName: 'org.eclipse.jgit:org.eclipse.jgit',
          currentValue: '4.6.0.201612231935-r',
          replaceString:
            '"org.eclipse.jgit:org.eclipse.jgit:4.6.0.201612231935-r"',
          datasource: 'maven',
          registryUrls: [
            'https://jitpack.io',
            'https://some.other.repo/foo/bar/baz',
          ],
        },
      ]);
    });

    it('ignores build.gradle.kts file', () => {
      // when
      const packageFile = extractPackageFile('irrelevant', 'build.gradle.kts');

      // then
      expect(packageFile).toBeNull();
    });

    it('ignores settings.gradle.kts file', () => {
      // when
      const packageFile = extractPackageFile(
        'irrelevant',
        'settings.gradle.kts'
      );

      // then
      expect(packageFile).toBeNull();
    });
  });
});

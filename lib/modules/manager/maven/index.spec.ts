// TODO #22198
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import type { PackageDependency, PackageFileContent } from '../types';
import { extractPackage, resolveParents } from './extract';
import { extractAllPackageFiles, updateDependency } from '.';

jest.mock('../../../util/fs');

const pomContent = Fixtures.get('simple.pom.xml');
const pomParent = Fixtures.get('parent.pom.xml');
const pomChild = Fixtures.get('child.pom.xml');
const origContent = Fixtures.get('grouping.pom.xml');
const settingsContent = Fixtures.get('mirror.settings.xml');

function selectDep(deps: PackageDependency[], name = 'org.example:quuz') {
  return deps.find((dep) => dep.depName === name);
}

describe('modules/manager/maven/index', () => {
  describe('extractAllPackageFiles', () => {
    it('should return empty if package has no content', async () => {
      fs.readLocalFile.mockResolvedValueOnce('');
      const res = await extractAllPackageFiles({}, ['random.pom.xml']);
      expect(res).toBeEmptyArray();
    });

    it('should return empty for packages with invalid content', async () => {
      fs.readLocalFile.mockResolvedValueOnce('invalid content');
      const res = await extractAllPackageFiles({}, ['random.pom.xml']);
      expect(res).toBeEmptyArray();
    });

    it('should return packages with urls from a settings file', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(settingsContent)
        .mockResolvedValueOnce(pomContent);
      const packages = await extractAllPackageFiles({}, [
        'settings.xml',
        'simple.pom.xml',
      ]);
      const urls = [
        'https://repo.maven.apache.org/maven2',
        'https://maven.atlassian.com/content/repositories/atlassian-public/',
        'https://artifactory.company.com/artifactory/my-maven-repo',
      ];
      for (const pkg of packages) {
        for (const dep of pkg.deps) {
          const depUrls = [...dep.registryUrls!];
          expect(depUrls).toEqual(urls);
        }
      }
    });

    it('should return package files info', async () => {
      fs.readLocalFile.mockResolvedValueOnce(pomContent);
      const packages = await extractAllPackageFiles({}, ['random.pom.xml']);
      expect(packages).toMatchObject([
        {
          deps: [
            { depName: 'org.example:parent', currentValue: '42' },
            { depName: 'org.example:foo', currentValue: '0.0.1' },
            { depName: 'org.example:bar', currentValue: '1.0.0' },
            {
              depName: 'org.apache.maven.plugins:maven-release-plugin',
              currentValue: '2.4.2',
            },
            {
              depName: 'org.apache.maven.scm:maven-scm-provider-gitexe',
              currentValue: '1.8.1',
            },
            {
              depName: 'org.example:extension-artefact',
              currentValue: '1.0',
            },
            {
              depName: 'org.example:${artifact-id-placeholder}',
              skipReason: 'name-placeholder',
            },
            {
              depName: '${group-id-placeholder}:baz',
              skipReason: 'name-placeholder',
            },
            {
              depName: 'org.example:quux',
              currentValue: '1.2.3.4',
              groupName: 'quuxVersion',
            },
            {
              depName: 'org.example:quux-test',
              currentValue: '1.2.3.4',
              groupName: 'quuxVersion',
            },
            {
              depName: 'org.example:quuz',
              currentValue: '1.2.3',
            },
            {
              depName: 'org.example:quuuz',
              currentValue: "it's not a version",
            },
            { depName: 'org.example:hard-range', currentValue: '[1.0.0]' },
            {
              depName: 'org.example:optional',
              currentValue: '1.0.0',
            },
            {
              depName: 'org.example:relocation-artifact',
              currentValue: '1.0',
            },
            {
              depName: 'org.example:profile-artifact',
              currentValue: '${profile-placeholder}',
              skipReason: 'version-placeholder',
            },
            {
              depName: 'org.example:profile-build-artefact',
              currentValue: '2.17',
            },
            {
              depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
              currentValue: '2.17',
            },
          ],
          packageFile: 'random.pom.xml',
        },
      ]);
    });

    describe('root pom handling', () => {
      it('should skip root pom.xml', async () => {
        fs.readLocalFile.mockResolvedValueOnce(`
          <project>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>root</artifactId>
            <version>1.0.0</version>
          </project>
        `);
        fs.readLocalFile.mockResolvedValueOnce(`
          <project>
            <parent>
              <groupId>org.example</groupId>
              <artifactId>root</artifactId>
              <version>1.0.0</version>
            </parent>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>child</artifactId>
          </project>
        `);
        const packages = await extractAllPackageFiles({}, [
          'pom.xml',
          'foo.bar/pom.xml',
        ]);
        expect(packages).toMatchObject([
          { packageFile: 'pom.xml', deps: [] },
          {
            packageFile: 'foo.bar/pom.xml',
            deps: [{ depName: 'org.example:root', depType: 'parent-root' }],
          },
        ]);
      });

      it('handles cross-referencing', async () => {
        fs.readLocalFile.mockResolvedValueOnce(`
          <project>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>foo</artifactId>
            <version>1.0.0</version>
            <dependencies>
              <dependency>
                <groupId>org.example</groupId>
                <artifactId>bar</artifactId>
                <version>1.0.0</version>
              </dependency>
            </dependencies>
          </project>
        `);
        fs.readLocalFile.mockResolvedValueOnce(`
          <project>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>bar</artifactId>
            <version>1.0.0</version>
            <dependencies>
              <dependency>
                <groupId>org.example</groupId>
                <artifactId>foo</artifactId>
                <version>1.0.0</version>
              </dependency>
            </dependencies>
          </project>
        `);
        const packages = await extractAllPackageFiles({}, [
          'foo.xml',
          'bar.xml',
        ]);
        expect(packages).toMatchObject([
          { packageFile: 'foo.xml', deps: [{ depName: 'org.example:bar' }] },
          { packageFile: 'bar.xml', deps: [{ depName: 'org.example:foo' }] },
        ]);
        const [foo, bar] = packages;
        expect(foo.deps[0].skipReason).toBeUndefined();
        expect(bar.deps[0].skipReason).toBeUndefined();
      });
    });
  });

  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
      const newValue = '9.9.9.9-final';

      const { deps } = extractPackage(pomContent, 'some-file')!;
      const dep = selectDep(deps);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency({
        fileContent: pomContent,
        upgrade,
      })!;
      const updatedDep = selectDep(
        extractPackage(updatedContent, 'some-file')!.deps,
      );

      expect(updatedDep?.currentValue).toEqual(newValue);
    });

    it('should update existing dependency defined via properties', () => {
      const finder = ({ depName }: PackageDependency) =>
        depName === 'org.example:quux';
      const newValue = '9.9.9.9-final';

      const packages = resolveParents([
        extractPackage(pomParent, 'parent.pom.xml')!,
        extractPackage(pomChild, 'child.pom.xml')!,
      ]);
      const [{ deps }] = packages;
      const dep = deps.find(finder);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency({
        fileContent: pomParent,
        upgrade,
      })!;
      const [updatedPkg] = resolveParents([
        extractPackage(updatedContent, 'parent.pom.xml')!,
        extractPackage(pomChild, 'child.pom.xml')!,
      ]);
      const updatedDep = updatedPkg.deps.find(finder);

      expect(updatedDep?.registryUrls).toContain('http://example.com/');
      expect(updatedDep?.currentValue).toEqual(newValue);
    });

    it('should apply props recursively', () => {
      const [{ deps }] = resolveParents([
        extractPackage(Fixtures.get('recursive_props.pom.xml'), 'some-file')!,
      ]);
      expect(deps).toMatchObject([
        {
          depName: 'com.sksamuel.scapegoat:scalac-scapegoat-plugin_2.13.7',
          currentValue: '1.4.11',
        },
      ]);
    });

    it('should apply props multiple times', () => {
      const [{ deps }] = resolveParents([
        extractPackage(
          Fixtures.get('multiple_usages_props.pom.xml'),
          'some-file',
        )!,
      ]);
      expect(deps).toMatchObject([
        {
          depName: 'org.apache.lucene:lucene-core-1.2.3.1.2.3',
          currentValue: '1.2.3',
        },
      ]);
    });

    it('should detect props infinitely recursing props', () => {
      const [{ deps }] = resolveParents([
        extractPackage(
          Fixtures.get('infinite_recursive_props.pom.xml'),
          'some-file',
        )!,
      ]);
      expect(deps).toMatchObject([
        {
          depName: 'org.apache.lucene:lucene-core',
          currentValue: '${foo}',
          skipReason: 'recursive-placeholder',
        },
        {
          depName: 'org.apache.lucene:lucene-core-${var1}',
          currentValue: '1.2',
          skipReason: 'recursive-placeholder',
        },
      ]);
    });

    it('should include registryUrls from parent pom files', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(pomParent)
        .mockResolvedValueOnce(pomChild);
      const packages = await extractAllPackageFiles({}, [
        'parent.pom.xml',
        'child.pom.xml',
      ]);
      const urls = new Set([
        'https://repo.maven.apache.org/maven2',
        'http://example.com/',
        'http://example.com/nexus/xyz',
      ]);
      packages.forEach(({ deps }) => {
        deps.forEach(({ registryUrls }) => {
          const depUrls = new Set([...registryUrls!]);
          expect(depUrls).toEqual(urls);
        });
      });
      expect(packages).toMatchSnapshot();
    });

    it('should not touch content if new and old versions are equal', () => {
      const newValue = '1.2.3';

      const { deps } = extractPackage(pomContent, 'some-file')!;
      const dep = selectDep(deps);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency({
        fileContent: pomContent,
        upgrade,
      });

      expect(pomContent).toBe(updatedContent);
    });

    it('should update to version of the latest dep in implicit group', async () => {
      fs.readLocalFile.mockResolvedValueOnce(origContent);
      const [{ deps }] = await extractAllPackageFiles({}, ['pom.xml']);

      const dep1 = selectDep(deps, 'org.example:foo-1');
      const upgrade1 = { ...dep1, newValue: '1.0.2' };

      const dep2 = selectDep(deps, 'org.example:foo-2');
      const upgrade2 = { ...dep2, newValue: '1.0.3' };

      const updatedOutside = origContent.replace('1.0.0', '1.0.1');

      expect(
        updateDependency({ fileContent: origContent, upgrade: upgrade1 }),
      ).toEqual(origContent.replace('1.0.0', '1.0.2'));
      expect(
        updateDependency({
          fileContent: updatedOutside,
          upgrade: upgrade1,
        }),
      ).toEqual(origContent.replace('1.0.0', '1.0.2'));

      const updatedByPrevious = updateDependency({
        fileContent: origContent,
        upgrade: upgrade1,
      })!;

      expect(
        updateDependency({
          fileContent: updatedByPrevious,
          upgrade: upgrade2,
        }),
      ).toEqual(origContent.replace('1.0.0', '1.0.3'));
      expect(
        updateDependency({
          fileContent: updatedOutside,
          upgrade: upgrade2,
        }),
      ).toEqual(origContent.replace('1.0.0', '1.0.3'));

      expect(
        updateDependency({ fileContent: origContent, upgrade: upgrade2 }),
      ).toEqual(origContent.replace('1.0.0', '1.0.3'));
    });

    it('should return null for ungrouped deps if content was updated outside', async () => {
      fs.readLocalFile.mockResolvedValueOnce(origContent);
      const [{ deps }] = await extractAllPackageFiles({}, ['pom.xml']);
      const dep = selectDep(deps, 'org.example:bar');
      const upgrade = { ...dep, newValue: '2.0.2' };
      const updatedOutside = origContent.replace('2.0.0', '2.0.1');
      expect(
        updateDependency({ fileContent: updatedOutside, upgrade }),
      ).toBeNull();
    });

    it('should return null if current versions in content and upgrade are not same', () => {
      const currentValue = '1.2.2';
      const newValue = '1.2.4';

      const { deps } = extractPackage(pomContent, 'some-file')!;
      const dep = selectDep(deps);
      const upgrade = { ...dep, currentValue, newValue };
      const updatedContent = updateDependency({
        fileContent: pomContent,
        upgrade,
      });

      expect(updatedContent).toBeNull();
    });

    it('should update ranges', () => {
      const newValue = '[1.2.3]';
      const select = (depSet: PackageFileContent) =>
        selectDep(depSet.deps, 'org.example:hard-range');
      const oldContent = extractPackage(pomContent, 'some-file');
      const dep = select(oldContent!);
      const upgrade = { ...dep, newValue };
      const newContent = extractPackage(
        updateDependency({ fileContent: pomContent, upgrade })!,
        'some-file',
      );
      const newDep = select(newContent!);
      expect(newDep?.currentValue).toEqual(newValue);
    });

    it('should preserve ranges', () => {
      const newValue = '[1.0.0]';
      const select = (depSet: PackageFileContent) =>
        depSet?.deps ? selectDep(depSet.deps, 'org.example:hard-range') : null;
      const oldContent = extractPackage(pomContent, 'some-file');
      const dep = select(oldContent!);
      expect(dep).not.toBeNull();
      const upgrade = { ...dep, newValue };
      expect(updateDependency({ fileContent: pomContent, upgrade })).toEqual(
        pomContent,
      );
    });

    it('should return null for replacement', () => {
      const res = updateDependency({
        fileContent: '',
        upgrade: { updateType: 'replacement' },
      });
      expect(res).toBeNull();
    });
  });
});

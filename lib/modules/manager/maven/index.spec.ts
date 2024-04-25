// TODO #22198
import { Fixtures } from '../../../../test/fixtures';
import { fs } from '../../../../test/util';
import type { PackageDependency, PackageFileContent } from '../types';
import {
  extractAllPackageFiles,
  extractPackage,
  resolveParents,
} from './extract';
import { updateDependency } from './update';

jest.mock('../../../util/fs');

const simpleContent = Fixtures.get('simple.pom.xml');
const parentPomContent = Fixtures.get('parent.pom.xml');
const childPomContent = Fixtures.get('child.pom.xml');
const groupingContent = Fixtures.get('grouping.pom.xml');

function selectDep(deps: PackageDependency[], name = 'org.example:quuz') {
  return deps.find((dep) => dep.depName === name);
}

describe('modules/manager/maven/index', () => {
  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
      const newValue = '9.9.9.9-final';

      const { deps } = extractPackage(simpleContent, 'some-file')!;
      const dep = selectDep(deps);
      const updatedContent = updateDependency({
        fileContent: simpleContent,
        upgrade: { ...dep, newValue },
      })!;

      const updatedDep = selectDep(
        extractPackage(updatedContent, 'some-file')!.deps,
      );
      expect(updatedDep?.currentValue).toEqual(newValue);
    });

    it('should update existing dependency defined via properties', () => {
      const newValue = '9.9.9.9-final';

      const packages = resolveParents([
        extractPackage(parentPomContent, 'parent.pom.xml')!,
        extractPackage(childPomContent, 'child.pom.xml')!,
      ]);
      const [{ deps }] = packages;
      const dep = selectDep(deps, 'org.example:quux');
      const updatedContent = updateDependency({
        fileContent: parentPomContent,
        upgrade: { ...dep, newValue },
      })!;

      const [updatedPkg] = resolveParents([
        extractPackage(updatedContent, 'parent.pom.xml')!,
        extractPackage(childPomContent, 'child.pom.xml')!,
      ]);
      const updatedDep = selectDep(updatedPkg.deps, 'org.example:quux');
      expect(updatedDep?.registryUrls).toContain('http://example.com/');
      expect(updatedDep?.currentValue).toEqual(newValue);
    });

    it('should not touch content if new and old versions are equal', () => {
      const { deps } = extractPackage(simpleContent, 'some-file')!;
      const dep = selectDep(deps);
      const updatedContent = updateDependency({
        fileContent: simpleContent,
        upgrade: { ...dep, newValue: '1.2.3' },
      });

      expect(simpleContent).toBe(updatedContent);
    });

    it('should update to version of the latest dep in implicit group', async () => {
      fs.readLocalFile.mockResolvedValueOnce(groupingContent);
      const [{ deps }] = await extractAllPackageFiles({}, ['pom.xml']);

      const dep1 = selectDep(deps, 'org.example:foo-1');
      const upgrade1 = { ...dep1, newValue: '1.0.2' };
      const dep2 = selectDep(deps, 'org.example:foo-2');
      const upgrade2 = { ...dep2, newValue: '1.0.3' };
      const updatedOutside = groupingContent.replace('1.0.0', '1.0.1');

      expect(
        updateDependency({ fileContent: groupingContent, upgrade: upgrade1 }),
      ).toEqual(groupingContent.replace('1.0.0', '1.0.2'));
      expect(
        updateDependency({
          fileContent: updatedOutside,
          upgrade: upgrade1,
        }),
      ).toEqual(groupingContent.replace('1.0.0', '1.0.2'));

      const updatedByPrevious = updateDependency({
        fileContent: groupingContent,
        upgrade: upgrade1,
      })!;

      expect(
        updateDependency({
          fileContent: updatedByPrevious,
          upgrade: upgrade2,
        }),
      ).toEqual(groupingContent.replace('1.0.0', '1.0.3'));
      expect(
        updateDependency({
          fileContent: updatedOutside,
          upgrade: upgrade2,
        }),
      ).toEqual(groupingContent.replace('1.0.0', '1.0.3'));

      expect(
        updateDependency({ fileContent: groupingContent, upgrade: upgrade2 }),
      ).toEqual(groupingContent.replace('1.0.0', '1.0.3'));
    });

    it('should return null for ungrouped deps if content was updated outside', async () => {
      fs.readLocalFile.mockResolvedValueOnce(groupingContent);
      const [{ deps }] = await extractAllPackageFiles({}, ['pom.xml']);

      const dep = selectDep(deps, 'org.example:bar');
      const updatedOutside = groupingContent.replace('2.0.0', '2.0.1');

      const updatedContent = updateDependency({
        fileContent: updatedOutside,
        upgrade: { ...dep, newValue: '2.0.2' },
      });
      expect(updatedContent).toBeNull();
    });

    it('should return null if current versions in content and upgrade are not same', () => {
      const { deps } = extractPackage(simpleContent, 'some-file')!;
      const dep = selectDep(deps);

      const updatedContent = updateDependency({
        fileContent: simpleContent,
        upgrade: { ...dep, currentValue: '1.2.2', newValue: '1.2.4' },
      });
      expect(updatedContent).toBeNull();
    });

    it('should update ranges', () => {
      const newValue = '[1.2.3]';
      const select = (depSet: PackageFileContent) =>
        selectDep(depSet.deps, 'org.example:hard-range');
      const oldContent = extractPackage(simpleContent, 'some-file');
      const dep = select(oldContent!);
      const newContent = extractPackage(
        updateDependency({
          fileContent: simpleContent,
          upgrade: { ...dep, newValue },
        })!,
        'some-file',
      );
      const newDep = select(newContent!);
      expect(newDep?.currentValue).toEqual(newValue);
    });

    it('should preserve ranges', () => {
      const select = (depSet: PackageFileContent) =>
        depSet?.deps ? selectDep(depSet.deps, 'org.example:hard-range') : null;
      const oldContent = extractPackage(simpleContent, 'some-file');
      const dep = select(oldContent!);
      expect(dep).not.toBeNull();

      const upgrade = { ...dep, newValue: '[1.0.0]' };
      expect(updateDependency({ fileContent: simpleContent, upgrade })).toEqual(
        simpleContent,
      );
    });
  });
});

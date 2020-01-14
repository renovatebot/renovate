import { readFileSync } from 'fs';
import { extractPackage, resolveParents } from './extract';
import { extractAllPackageFiles, updateDependency } from './index';
import { PackageDependency, PackageFile } from '../common';
import { platform as _platform } from '../../platform';

const platform: any = _platform;

const pomContent = readFileSync(
  'lib/manager/maven/__fixtures__/simple.pom.xml',
  'utf8'
);
const pomParent = readFileSync(
  'lib/manager/maven/__fixtures__/parent.pom.xml',
  'utf8'
);
const pomChild = readFileSync(
  'lib/manager/maven/__fixtures__/child.pom.xml',
  'utf8'
);
const origContent = readFileSync(
  'lib/manager/maven/__fixtures__/grouping.pom.xml',
  'utf8'
);

function selectDep(deps: PackageDependency[], name = 'org.example:quuz') {
  return deps.find(dep => dep.depName === name);
}

describe('manager/maven', () => {
  describe('extractAllPackageFiles', () => {
    it('should return empty if package has no content', async () => {
      platform.getFile.mockReturnValueOnce(null);
      const res = await extractAllPackageFiles({}, ['random.pom.xml']);
      expect(res).toEqual([]);
    });

    it('should return empty for packages with invalid content', async () => {
      platform.getFile.mockReturnValueOnce('invalid content');
      const res = await extractAllPackageFiles({}, ['random.pom.xml']);
      expect(res).toEqual([]);
    });

    it('should return package files info', async () => {
      platform.getFile.mockReturnValueOnce(pomContent);
      const packages = await extractAllPackageFiles({}, ['random.pom.xml']);
      // windows path fix
      for (const p of packages) {
        if (p.parent) {
          p.parent = p.parent.replace(/\\/g, '/');
        }
      }
      expect(packages).toMatchSnapshot();
    });
  });

  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
      const newValue = '9.9.9.9-final';

      const { deps } = extractPackage(pomContent);
      const dep = selectDep(deps);
      const updateOptions = { ...dep, newValue };
      const updatedContent = updateDependency({
        fileContent: pomContent,
        updateOptions,
      });
      const updatedDep = selectDep(extractPackage(updatedContent).deps);

      expect(updatedDep.currentValue).toEqual(newValue);
    });

    it('should update existing dependency defined via properties', () => {
      const finder = ({ depName }: PackageDependency) =>
        depName === 'org.example:quux';
      const newValue = '9.9.9.9-final';

      const packages = resolveParents([
        extractPackage(pomParent, 'parent.pom.xml'),
        extractPackage(pomChild, 'child.pom.xml'),
      ]);
      const [{ deps }] = packages;
      const dep = deps.find(finder);
      const updateOptions = { ...dep, newValue };
      const updatedContent = updateDependency({
        fileContent: pomParent,
        updateOptions,
      });
      const [updatedPkg] = resolveParents([
        extractPackage(updatedContent, 'parent.pom.xml'),
        extractPackage(pomChild, 'child.pom.xml'),
      ]);
      const updatedDep = updatedPkg.deps.find(finder);

      expect(updatedDep.registryUrls).toContain('http://example.com/');
      expect(updatedDep.currentValue).toEqual(newValue);
    });

    it('should include registryUrls from parent pom files', async () => {
      platform.getFile
        .mockReturnValueOnce(pomParent)
        .mockReturnValueOnce(pomChild);
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
          const depUrls = new Set([...registryUrls]);
          expect(depUrls).toEqual(urls);
        });
      });
    });

    it('should not touch content if new and old versions are equal', () => {
      const newValue = '1.2.3';

      const { deps } = extractPackage(pomContent);
      const dep = selectDep(deps);
      const updateOptions = { ...dep, newValue };
      const updatedContent = updateDependency({
        fileContent: pomContent,
        updateOptions,
      });

      expect(pomContent).toBe(updatedContent);
    });

    it('should update to version of the latest dep in implicit group', async () => {
      platform.getFile.mockReturnValueOnce(origContent);
      const [{ deps }] = await extractAllPackageFiles({}, ['pom.xml']);

      const dep1 = selectDep(deps, 'org.example:foo-1');
      const upgrade1 = { ...dep1, newValue: '1.0.2' };

      const dep2 = selectDep(deps, 'org.example:foo-2');
      const upgrade2 = { ...dep2, newValue: '1.0.3' };

      const updatedOutside = origContent.replace('1.0.0', '1.0.1');

      expect(
        updateDependency({ fileContent: origContent, updateOptions: upgrade1 })
      ).toEqual(origContent.replace('1.0.0', '1.0.2'));
      expect(
        updateDependency({
          fileContent: updatedOutside,
          updateOptions: upgrade1,
        })
      ).toEqual(origContent.replace('1.0.0', '1.0.2'));

      const updatedByPrevious = updateDependency({
        fileContent: origContent,
        updateOptions: upgrade1,
      });

      expect(
        updateDependency({
          fileContent: updatedByPrevious,
          updateOptions: upgrade2,
        })
      ).toEqual(origContent.replace('1.0.0', '1.0.3'));
      expect(
        updateDependency({
          fileContent: updatedOutside,
          updateOptions: upgrade2,
        })
      ).toEqual(origContent.replace('1.0.0', '1.0.3'));

      expect(
        updateDependency({ fileContent: origContent, updateOptions: upgrade2 })
      ).toEqual(origContent.replace('1.0.0', '1.0.3'));
    });

    it('should return null for ungrouped deps if content was updated outside', async () => {
      platform.getFile.mockReturnValueOnce(origContent);
      const [{ deps }] = await extractAllPackageFiles({}, ['pom.xml']);
      const dep = selectDep(deps, 'org.example:bar');
      const updateOptions = { ...dep, newValue: '2.0.2' };
      const updatedOutside = origContent.replace('2.0.0', '2.0.1');
      expect(
        updateDependency({ fileContent: updatedOutside, updateOptions })
      ).toBeNull();
    });

    it('should return null if current versions in content and upgrade are not same', () => {
      const currentValue = '1.2.2';
      const newValue = '1.2.4';

      const { deps } = extractPackage(pomContent);
      const dep = selectDep(deps);
      const updateOptions = { ...dep, currentValue, newValue };
      const updatedContent = updateDependency({
        fileContent: pomContent,
        updateOptions,
      });

      expect(updatedContent).toBeNull();
    });
    it('should update ranges', () => {
      const newValue = '[1.2.3]';
      const select = (depSet: PackageFile) =>
        selectDep(depSet.deps, 'org.example:hard-range');
      const oldContent = extractPackage(pomContent);
      const dep = select(oldContent);
      const updateOptions = { ...dep, newValue };
      const newContent = extractPackage(
        updateDependency({ fileContent: pomContent, updateOptions })
      );
      const newDep = select(newContent);
      expect(newDep.currentValue).toEqual(newValue);
    });
    it('should preserve ranges', () => {
      const newValue = '[1.0.0]';
      const select = (depSet: PackageFile) =>
        depSet && depSet.deps
          ? selectDep(depSet.deps, 'org.example:hard-range')
          : null;
      const oldContent = extractPackage(pomContent);
      const dep = select(oldContent);
      expect(dep).not.toEqual(null);
      const updateOptions = { ...dep, newValue };
      expect(
        updateDependency({ fileContent: pomContent, updateOptions })
      ).toEqual(pomContent);
    });
  });
});

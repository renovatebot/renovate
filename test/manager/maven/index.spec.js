const fs = require('fs');
const {
  extractPackage,
  resolveProps,
} = require('../../../lib/manager/maven/extract');
const {
  extractAllPackageFiles,
  updateDependency,
} = require('../../../lib/manager/maven/index');

const pomContent = fs.readFileSync(
  'test/manager/maven/_fixtures/simple.pom.xml',
  'utf8'
);
const pomParent = fs.readFileSync(
  'test/manager/maven/_fixtures/parent.pom.xml',
  'utf8'
);
const pomChild = fs.readFileSync(
  'test/manager/maven/_fixtures/child.pom.xml',
  'utf8'
);

function selectDep(deps, name = 'org.example:quuz') {
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
      expect(packages).toMatchSnapshot();
    });
  });

  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
      const newValue = '9.9.9.9-final';

      const { deps } = extractPackage(pomContent);
      const dep = selectDep(deps);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency(pomContent, upgrade);
      const updatedDep = selectDep(extractPackage(updatedContent).deps);

      expect(updatedDep.currentValue).toEqual(newValue);
    });

    it('should update existing dependency defined via properties', () => {
      const finder = ({ depName }) => depName === 'org.example:quux';
      const newValue = '9.9.9.9-final';

      const packages = resolveProps([
        extractPackage(pomParent, 'parent.pom.xml'),
        extractPackage(pomChild, 'child.pom.xml'),
      ]);
      const [{ deps }] = packages;
      const dep = deps.find(finder);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency(pomParent, upgrade);
      const [updatedPkg] = resolveProps([
        extractPackage(updatedContent, 'parent.pom.xml'),
        extractPackage(pomChild, 'child.pom.xml'),
      ]);
      const updatedDep = updatedPkg.deps.find(finder);

      expect(updatedDep.registryUrls.pop()).toEqual('http://example.com/');
      expect(updatedDep.currentValue).toEqual(newValue);
    });

    it('should not touch content if new and old versions are equal', () => {
      const newValue = '1.2.3';

      const { deps } = extractPackage(pomContent);
      const dep = selectDep(deps);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency(pomContent, upgrade);

      expect(pomContent).toBe(updatedContent);
    });

    it('should return null if current versions in content and upgrade are not same', () => {
      const currentValue = '1.2.2';
      const newValue = '1.2.4';

      const { deps } = extractPackage(pomContent);
      const dep = selectDep(deps);
      const upgrade = { ...dep, currentValue, newValue };
      const updatedContent = updateDependency(pomContent, upgrade);

      expect(updatedContent).toBeNull();
    });
    it('should update ranges', () => {
      const newValue = '[1.2.3]';
      const select = depSet => selectDep(depSet.deps, 'org.example:hard-range');
      const oldContent = extractPackage(pomContent);
      const dep = select(oldContent);
      const upgrade = { ...dep, newValue };
      const newContent = extractPackage(updateDependency(pomContent, upgrade));
      const newDep = select(newContent);
      expect(newDep.currentValue).toEqual(newValue);
    });
    it('should preserve ranges', () => {
      const newValue = '[1.0.0]';
      const select = depSet =>
        depSet && depSet.deps
          ? selectDep(depSet.deps, 'org.example:hard-range')
          : null;
      const oldContent = extractPackage(pomContent);
      const dep = select(oldContent);
      expect(dep).not.toEqual(null);
      const upgrade = { ...dep, newValue };
      expect(updateDependency(pomContent, upgrade)).toEqual(pomContent);
    });
  });
});

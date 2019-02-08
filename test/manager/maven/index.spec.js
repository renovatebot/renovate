const fs = require('fs');
const { extractDependencies } = require('../../../lib/manager/maven/extract');
const {
  extractAllPackageFiles,
  updateDependency,
} = require('../../../lib/manager/maven/index');

const pomContent = fs.readFileSync(
  'test/_fixtures/maven/simple.pom.xml',
  'utf8'
);

const findFn = ({ depName }) => depName === 'org.example:quuz';

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
      expect(packages.length).toEqual(1);

      const pkg = packages[0];
      expect(pkg.packageFile).toEqual('random.pom.xml');
      expect(pkg.manager).toEqual('maven');
      expect(pkg.deps).not.toBeNull();
    });
  });

  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
      const newValue = '9.9.9.9-final';

      const { deps } = extractDependencies(pomContent);
      const dep = deps.find(findFn);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency(pomContent, upgrade);
      const updatedDep = extractDependencies(updatedContent).deps.find(findFn);

      expect(updatedDep.currentValue).toEqual(newValue);
    });

    it('should not touch content if new and old versions are equal', () => {
      const newValue = '1.2.3';

      const { deps } = extractDependencies(pomContent);
      const dep = deps.find(findFn);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency(pomContent, upgrade);

      expect(pomContent).toBe(updatedContent);
    });

    it('should return null if current versions in content and upgrade are not same', () => {
      const currentValue = '1.2.2';
      const newValue = '1.2.4';

      const { deps } = extractDependencies(pomContent);
      const dep = deps.find(findFn);
      const upgrade = { ...dep, currentValue, newValue };
      const updatedContent = updateDependency(pomContent, upgrade);

      expect(updatedContent).toBeNull();
    });
  });
});

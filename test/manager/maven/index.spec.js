const fs = require('fs');
const { extractDependencies } = require('../../../lib/manager/maven/extract');
const { updateDependency } = require('../../../lib/manager/maven/index');

const findFn = ({ depName }) => depName === 'org.example/quuz';

describe('manager/maven', () => {
  describe('updateDependency', () => {
    it('should update an existing dependency', () => {
      const newValue = '9.9.9.9-final';

      const content = fs.readFileSync(
        'test/_fixtures/maven/simple.pom.xml',
        'utf8'
      );

      const { deps } = extractDependencies(content);
      const dep = deps.find(findFn);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency(content, upgrade);
      const updatedDep = extractDependencies(updatedContent).deps.find(findFn);

      expect(updatedDep.currentValue).toEqual(newValue);
    });

    it('should not touch content if new and old versions are equal', () => {
      const newValue = '1.2.3';

      const content = fs.readFileSync(
        'test/_fixtures/maven/simple.pom.xml',
        'utf8'
      );

      const { deps } = extractDependencies(content);
      const dep = deps.find(findFn);
      const upgrade = { ...dep, newValue };
      const updatedContent = updateDependency(content, upgrade);

      expect(content).toBe(updatedContent);
    });

    it('should return null if current versions in content and upgrade are not same', () => {
      const currentValue = '1.2.2';
      const newValue = '1.2.4';

      const content = fs.readFileSync(
        'test/_fixtures/maven/simple.pom.xml',
        'utf8'
      );

      const { deps } = extractDependencies(content);
      const dep = deps.find(findFn);
      const upgrade = { ...dep, currentValue, newValue };
      const updatedContent = updateDependency(content, upgrade);

      expect(updatedContent).toBeNull();
    });
  });
});

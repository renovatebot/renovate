const fs = require('fs');
const path = require('path');
const { extractPackageFile } = require('../../../lib/manager/sbt/extract');
const { updateDependency } = require('../../../lib/manager/sbt/update');

const sbtPath = path.resolve(__dirname, `./_fixtures/sample.sbt`);
const fileContent = fs.readFileSync(sbtPath, 'utf8');

describe('lib/manager/terraform/extract', () => {
  describe('updateDependency()', () => {
    it('returns content untouched if versions are same', () => {
      const { deps } = extractPackageFile(fileContent);
      const upgrade = deps.shift();
      upgrade.newValue = upgrade.currentValue;
      const newFileContent = updateDependency(fileContent, upgrade);
      expect(newFileContent).toBe(fileContent);
    });
    it('returns null if content has been updated somewhere', () => {
      const { deps } = extractPackageFile(fileContent);
      const upgrade = deps.shift();
      upgrade.newValue = '0.1.1';
      const newFileContent = updateDependency(
        fileContent.replace('0.0.1', '0.1.0'),
        upgrade
      );
      expect(newFileContent).toBeNull();
    });
    it('updates old deps to newer ones', () => {
      const { deps } = extractPackageFile(fileContent);
      const upgrades = deps.map((dep, idx) => {
        const minor = idx + 1;
        const newValue = `123.456.${minor}`;
        return {
          ...dep,
          newValue,
        };
      });
      upgrades.forEach(upgrade => {
        const { currentValue, newValue } = upgrade;
        const newFileContent = updateDependency(fileContent, upgrade);
        const cmpContent = fileContent.replace(currentValue, newValue);
        expect(newFileContent).toEqual(cmpContent);
      });
    });
  });
});

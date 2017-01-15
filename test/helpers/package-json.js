const expect = require('chai').expect;
const fs = require('fs');
const packageJson = require('../../lib/helpers/package-json');

const inputContent = fs.readFileSync('./test/_fixtures/package.json/inputs/01.json', 'utf8');

describe('helpers/package-json', () => {
  describe('.setNewValue(currentFileContent, depType, depName, newVersion)', () => {
    it('replaces a dependency value', () => {
      const outputContent = fs.readFileSync('./test/_fixtures/package.json/outputs/011.json', 'utf8');
      const testContent =
        packageJson.setNewValue(inputContent, 'dependencies', 'cheerio', '0.22.1');
      expect(testContent).to.equal(outputContent);
    });
    it('replaces only the first instance of a value', () => {
      const outputContent = fs.readFileSync('./test/_fixtures/package.json/outputs/012.json', 'utf8');
      const testContent =
        packageJson.setNewValue(inputContent, 'devDependencies', 'angular-touch', '1.6.1');
      expect(testContent).to.equal(outputContent);
    });
    it('replaces only the second instance of a value', () => {
      const outputContent = fs.readFileSync('./test/_fixtures/package.json/outputs/013.json', 'utf8');
      const testContent =
        packageJson.setNewValue(inputContent, 'devDependencies', 'angular-sanitize', '1.6.1');
      expect(testContent).to.equal(outputContent);
    });
  });
});

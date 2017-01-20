const fs = require('fs');
const packageJson = require('../../lib/helpers/package-json');

const defaultTypes = ['dependencies', 'devDependencies', 'optionalDependencies'];

const input01Content = fs.readFileSync('./test/_fixtures/package.json/inputs/01.json', 'utf8');
const input02Content = fs.readFileSync('./test/_fixtures/package.json/inputs/02.json', 'utf8');

describe('helpers/package-json', () => {
  describe('.extractDependencies(packageJson, sections)', () => {
    it('returns an array of correct length', () => {
      const extractedDependencies =
        packageJson.extractDependencies(JSON.parse(input01Content), defaultTypes);
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(10);
    });
    it('each element contains non-null depType, depName, currentVersion', () => {
      const extractedDependencies =
        packageJson.extractDependencies(JSON.parse(input01Content), defaultTypes);
      extractedDependencies.every(dep => dep.depType && dep.depName && dep.currentVersion)
        .should.eql(true);
    });
    it('supports null devDependencies', () => {
      const extractedDependencies =
        packageJson.extractDependencies(JSON.parse(input02Content), defaultTypes);
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(6);
    });
  });
  describe('.setNewValue(currentFileContent, depType, depName, newVersion)', () => {
    it('replaces a dependency value', () => {
      const outputContent = fs.readFileSync('./test/_fixtures/package.json/outputs/011.json', 'utf8');
      const testContent =
        packageJson.setNewValue(input01Content, 'dependencies', 'cheerio', '0.22.1');
      testContent.should.equal(outputContent);
    });
    it('replaces only the first instance of a value', () => {
      const outputContent = fs.readFileSync('./test/_fixtures/package.json/outputs/012.json', 'utf8');
      const testContent =
        packageJson.setNewValue(input01Content, 'devDependencies', 'angular-touch', '1.6.1');
      testContent.should.equal(outputContent);
    });
    it('replaces only the second instance of a value', () => {
      const outputContent = fs.readFileSync('./test/_fixtures/package.json/outputs/013.json', 'utf8');
      const testContent =
        packageJson.setNewValue(input01Content, 'devDependencies', 'angular-sanitize', '1.6.1');
      testContent.should.equal(outputContent);
    });
  });
});

const fs = require('fs');
const path = require('path');
const packageJson = require('../../../lib/workers/package-file/package-json');

const defaultTypes = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
];

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/package-json/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');
const input02Content = readFixture('inputs/02.json');

describe('helpers/package-json', () => {
  describe('.extractDependencies(packageJson, sections)', () => {
    it('returns an array of correct length', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input01Content),
        defaultTypes
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(10);
    });
    it('each element contains non-null depType, depName, currentVersion', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input01Content),
        defaultTypes
      );
      extractedDependencies
        .every(dep => dep.depType && dep.depName && dep.currentVersion)
        .should.eql(true);
    });
    it('supports null devDependencies', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input02Content),
        defaultTypes
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(6);
    });
  });
});

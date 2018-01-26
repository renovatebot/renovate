const fs = require('fs');
const path = require('path');
const packageJson = require('../../../lib/workers/dep-type/package-json');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/package-json/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');
const input02Content = readFixture('inputs/02.json');

describe('workers/dep-type/package-json', () => {
  describe('.extractDependencies(packageJson, depType)', () => {
    it('returns an array of correct length (dependencies)', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input01Content),
        'dependencies'
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(6);
    });
    it('returns an array of correct length (devDependencies)', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input01Content),
        'devDependencies'
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(4);
    });
    it('each element contains non-null depType, depName, currentVersion', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input01Content),
        'dependencies'
      );
      expect(extractedDependencies).toMatchSnapshot();
      extractedDependencies
        .every(dep => dep.depType && dep.depName && dep.currentVersion)
        .should.eql(true);
    });
    it('supports null devDependencies indirect', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input02Content),
        'dependencies'
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(6);
    });
    it('supports null', () => {
      const extractedDependencies = packageJson.extractDependencies(
        JSON.parse(input02Content),
        'fooDependencies'
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(0);
    });
    it('finds a locked version in package-lock.json', () => {
      const packageLockParsed = {
        dependencies: { chalk: { version: '2.0.1' } },
      };
      const extractedDependencies = packageJson.extractDependencies(
        { dependencies: { chalk: '^2.0.0', foo: '^1.0.0' } },
        'dependencies',
        packageLockParsed
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(2);
      expect(extractedDependencies[0].lockedVersion).toBeDefined();
      expect(extractedDependencies[1].lockedVersion).toBeUndefined();
    });
    it('finds a locked version in yarn.lock', () => {
      const yarnLockParsed = {
        object: { 'chalk@^2.0.0': { version: '2.0.1' } },
      };
      const extractedDependencies = packageJson.extractDependencies(
        { dependencies: { chalk: '^2.0.0', foo: '^1.0.0' } },
        'dependencies',
        undefined,
        yarnLockParsed
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(2);
      expect(extractedDependencies[0].lockedVersion).toBeDefined();
      expect(extractedDependencies[1].lockedVersion).toBeUndefined();
    });
    it('handles lock error', () => {
      const extractedDependencies = packageJson.extractDependencies(
        { dependencies: { chalk: '^2.0.0', foo: '^1.0.0' } },
        'dependencies',
        true
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(2);
      expect(extractedDependencies[0].lockedVersion).toBeUndefined();
      expect(extractedDependencies[1].lockedVersion).toBeUndefined();
    });
  });
});

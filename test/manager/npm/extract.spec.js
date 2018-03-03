const fs = require('fs');
const path = require('path');
const npmExtract = require('../../../lib/manager/npm/extract');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/package-json/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');
const input02Content = readFixture('inputs/02.json');

describe('workers/dep-type/package-json', () => {
  describe('.extractDependencies(npmExtract, depType)', () => {
    it('returns an array of correct length (dependencies)', () => {
      const config = {
        depType: 'dependencies',
      };
      const extractedDependencies = npmExtract.extractDependencies(
        JSON.parse(input01Content),
        config
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(6);
    });
    it('returns an array of correct length (devDependencies)', () => {
      const config = {
        depType: 'devDependencies',
      };
      const extractedDependencies = npmExtract.extractDependencies(
        JSON.parse(input01Content),
        config
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(4);
    });
    it('each element contains non-null depType, depName, currentVersion', () => {
      const config = {
        depType: 'dependencies',
      };
      const extractedDependencies = npmExtract.extractDependencies(
        JSON.parse(input01Content),
        config
      );
      expect(extractedDependencies).toMatchSnapshot();
      extractedDependencies
        .every(dep => dep.depType && dep.depName && dep.currentVersion)
        .should.eql(true);
    });
    it('supports null devDependencies indirect', () => {
      const config = {
        depType: 'dependencies',
      };
      const extractedDependencies = npmExtract.extractDependencies(
        JSON.parse(input02Content),
        config
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(6);
    });
    it('supports null', () => {
      const config = {
        depType: 'fooDpendencies',
      };
      const extractedDependencies = npmExtract.extractDependencies(
        JSON.parse(input02Content),
        config
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(0);
    });
    it('finds a locked version in package-lock.json', () => {
      const packageLockParsed = {
        dependencies: { chalk: { version: '2.0.1' } },
      };
      const config = {
        depType: 'dependencies',
        packageLockParsed,
      };
      const extractedDependencies = npmExtract.extractDependencies(
        { dependencies: { chalk: '^2.0.0', foo: '^1.0.0' } },
        config
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
      const config = {
        depType: 'dependencies',
        yarnLockParsed,
      };
      const extractedDependencies = npmExtract.extractDependencies(
        { dependencies: { chalk: '^2.0.0', foo: '^1.0.0' } },
        config
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(2);
      expect(extractedDependencies[0].lockedVersion).toBeDefined();
      expect(extractedDependencies[1].lockedVersion).toBeUndefined();
    });
    it('handles lock error', () => {
      const config = {
        depType: 'dependencies',
        packageLockParsed: true,
      };
      const extractedDependencies = npmExtract.extractDependencies(
        { dependencies: { chalk: '^2.0.0', foo: '^1.0.0' } },
        config
      );
      extractedDependencies.should.be.instanceof(Array);
      extractedDependencies.should.have.length(2);
      expect(extractedDependencies[0].lockedVersion).toBeUndefined();
      expect(extractedDependencies[1].lockedVersion).toBeUndefined();
    });
  });
});

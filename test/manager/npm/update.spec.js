const fs = require('fs');
const path = require('path');
const npmUpdater = require('../../../lib/manager/npm/update');
const semver = require('semver');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/package-json/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');

describe('workers/branch/package-json', () => {
  describe('.setNewValue(currentFileContent, depType, depName, newVersion)', () => {
    it('replaces a dependency value', () => {
      const upgrade = {
        depType: 'dependencies',
        depName: 'cheerio',
        newVersion: '0.22.1',
      };
      const outputContent = readFixture('outputs/011.json');
      const testContent = npmUpdater.setNewValue(input01Content, upgrade);
      testContent.should.equal(outputContent);
    });
    it('updates resolutions too', () => {
      const upgrade = {
        depType: 'dependencies',
        depName: 'config',
        newVersion: '1.22.0',
      };
      const testContent = npmUpdater.setNewValue(input01Content, upgrade);
      expect(JSON.parse(testContent).dependencies.config).toEqual('1.22.0');
      expect(JSON.parse(testContent).resolutions.config).toEqual('1.22.0');
    });
    it('replaces only the first instance of a value', () => {
      const upgrade = {
        depType: 'devDependencies',
        depName: 'angular-touch',
        newVersion: '1.6.1',
      };
      const outputContent = readFixture('outputs/012.json');
      const testContent = npmUpdater.setNewValue(input01Content, upgrade);
      testContent.should.equal(outputContent);
    });
    it('replaces only the second instance of a value', () => {
      const upgrade = {
        depType: 'devDependencies',
        depName: 'angular-sanitize',
        newVersion: '1.6.1',
      };
      const outputContent = readFixture('outputs/013.json');
      const testContent = npmUpdater.setNewValue(input01Content, upgrade);
      testContent.should.equal(outputContent);
    });
    it('handles the case where the desired version is already supported', () => {
      const upgrade = {
        depType: 'devDependencies',
        depName: 'angular-touch',
        newVersion: '1.5.8',
      };
      const testContent = npmUpdater.setNewValue(input01Content, upgrade);
      testContent.should.equal(input01Content);
    });
    it('returns null if throws error', () => {
      const upgrade = {
        depType: 'blah',
        depName: 'angular-touch-not',
        newVersion: '1.5.8',
      };
      const testContent = npmUpdater.setNewValue(input01Content, upgrade);
      expect(testContent).toBe(null);
    });
  });
  describe('.bumpPackageVersion()', () => {
    const content = JSON.stringify({ name: 'some-package', version: '0.0.2' });
    it('increments', () => {
      const res = npmUpdater.bumpPackageVersion(content, '0.0.2', 'patch');
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('no ops', () => {
      const res = npmUpdater.bumpPackageVersion(content, '0.0.1', 'patch');
      expect(res).toEqual(content);
    });
    it('updates', () => {
      const res = npmUpdater.bumpPackageVersion(content, '0.0.1', 'minor');
      expect(res).toMatchSnapshot();
      expect(res).not.toEqual(content);
    });
    it('returns content if bumping errors', () => {
      semver.inc = jest.fn(() => {
        throw new Error('semver inc');
      });
      const res = npmUpdater.bumpPackageVersion(content, '0.0.2', true);
      expect(res).toEqual(content);
    });
  });
});

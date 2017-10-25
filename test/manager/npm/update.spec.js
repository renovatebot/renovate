const fs = require('fs');
const path = require('path');
const npmUpdater = require('../../../lib/manager/npm/update');
const logger = require('../../_fixtures/logger');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/package-json/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('inputs/01.json');

describe('workers/branch/package-json', () => {
  describe('.setNewValue(currentFileContent, depType, depName, newVersion, logger)', () => {
    it('replaces a dependency value', () => {
      const outputContent = readFixture('outputs/011.json');
      const testContent = npmUpdater.setNewValue(
        input01Content,
        'dependencies',
        'cheerio',
        '0.22.1',
        logger
      );
      testContent.should.equal(outputContent);
    });
    it('replaces only the first instance of a value', () => {
      const outputContent = readFixture('outputs/012.json');
      const testContent = npmUpdater.setNewValue(
        input01Content,
        'devDependencies',
        'angular-touch',
        '1.6.1',
        logger
      );
      testContent.should.equal(outputContent);
    });
    it('replaces only the second instance of a value', () => {
      const outputContent = readFixture('outputs/013.json');
      const testContent = npmUpdater.setNewValue(
        input01Content,
        'devDependencies',
        'angular-sanitize',
        '1.6.1',
        logger
      );
      testContent.should.equal(outputContent);
    });
    it('handles the case where the desired version is already supported', () => {
      const testContent = npmUpdater.setNewValue(
        input01Content,
        'devDependencies',
        'angular-touch',
        '1.5.8',
        logger
      );
      testContent.should.equal(input01Content);
    });
    it('returns null if throws error', () => {
      const testContent = npmUpdater.setNewValue(
        input01Content,
        'blah',
        'angular-touch-not',
        '1.5.8',
        logger
      );
      expect(testContent).toBe(null);
    });
  });
});

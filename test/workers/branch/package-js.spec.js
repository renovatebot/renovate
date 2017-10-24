const fs = require('fs');
const path = require('path');
const packageJs = require('../../../lib/workers/branch/package-js');
const logger = require('../../_fixtures/logger');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/meteor/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('package-1.js');
const input02Content = readFixture('package-2.js');

describe('workers/branch/package-js', () => {
  describe('.setNewValue(currentFileContent, depName, currentVersion, newVersion, logger)', () => {
    it('replaces a dependency value', () => {
      const testContent = packageJs.setNewValue(
        input01Content,
        'xmldom',
        '0.1.19',
        '0.22.1',
        logger
      );
      expect(testContent).toMatchSnapshot();
    });
    it('handles alternative quotes and white space', () => {
      const testContent = packageJs.setNewValue(
        input02Content,
        'xmldom',
        '0.1.19',
        '0.22.1',
        logger
      );
      expect(testContent).toMatchSnapshot();
    });
    it('handles the case where the desired version is already supported', () => {
      const testContent = packageJs.setNewValue(
        input01Content,
        'query-string',
        '0.2.0',
        '0.2.0',
        logger
      );
      testContent.should.equal(input01Content);
    });
  });
});

const fs = require('fs');
const path = require('path');
const meteorUpdater = require('../../../lib/manager/meteor/update');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/meteor/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('package-1.js');
const input02Content = readFixture('package-2.js');

describe('workers/branch/package-js', () => {
  describe('.setNewValue(currentFileContent, depName, currentVersion, newVersion)', () => {
    it('replaces a dependency value', () => {
      const testContent = meteorUpdater.setNewValue(
        input01Content,
        'xmldom',
        '0.1.19',
        '0.22.1'
      );
      expect(testContent).toMatchSnapshot();
    });
    it('handles alternative quotes and white space', () => {
      const testContent = meteorUpdater.setNewValue(
        input02Content,
        'xmldom',
        '0.1.19',
        '0.22.1'
      );
      expect(testContent).toMatchSnapshot();
    });
    it('handles the case where the desired version is already supported', () => {
      const testContent = meteorUpdater.setNewValue(
        input01Content,
        'query-string',
        '0.2.0',
        '0.2.0'
      );
      testContent.should.equal(input01Content);
    });
  });
});

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
  describe('.updateDependency(fileContent, depName, currentValue, newValue)', () => {
    it('replaces a dependency value', () => {
      const upgrade = {
        depName: 'xmldom',
        currentValue: '0.1.19',
        newValue: '0.22.1',
      };
      const testContent = meteorUpdater.updateDependency(
        input01Content,
        upgrade
      );
      expect(testContent).toMatchSnapshot();
    });
    it('handles alternative quotes and white space', () => {
      const upgrade = {
        depName: 'xmldom',
        currentValue: '0.1.19',
        newValue: '0.22.1',
      };
      const testContent = meteorUpdater.updateDependency(
        input02Content,
        upgrade
      );
      expect(testContent).toMatchSnapshot();
    });
    it('handles the case where the desired version is already supported', () => {
      const upgrade = {
        depName: 'query-string',
        currentValue: '0.2.0',
        newValue: '0.2.0',
      };
      const testContent = meteorUpdater.updateDependency(
        input01Content,
        upgrade
      );
      testContent.should.equal(input01Content);
    });
  });
});

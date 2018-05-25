const fs = require('fs');
const path = require('path');
const { extractDependencies } = require('../../../lib/manager/meteor/extract');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/meteor/${fixture}`),
    'utf8'
  );
}

const input01Content = readFixture('package-1.js');

describe('lib/manager/meteor/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns empty if fails to parse', () => {
      const res = extractDependencies('blahhhhh:foo:@what\n', config);
      expect(res).toBe(null);
    });
    it('returns results', () => {
      const res = extractDependencies(input01Content, config);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});

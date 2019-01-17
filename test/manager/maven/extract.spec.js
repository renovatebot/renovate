/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const { extractDependencies } = require('../../../lib/manager/maven/extract');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/maven/${fixture}`),
    'utf8'
  );
}

const simpleContent = readFixture('simple.pom.xml');

describe('manager/maven/extract', () => {
  describe('.extractDependencies()', () => {
    it('returns null for invalid XML', () => {
      const res = extractDependencies('<project></project>');
      expect(res).toEqual(null);
    });
    it('extract dependencies from any XML position', () => {
      const res = extractDependencies(simpleContent);
      expect(res).toMatchSnapshot();
    });
  });
});

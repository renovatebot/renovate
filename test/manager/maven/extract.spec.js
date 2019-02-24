/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const { extractDependencies } = require('../../../lib/manager/maven/extract');

const simpleContent = fs.readFileSync(
  path.resolve(__dirname, `../../_fixtures/maven/simple.pom.xml`),
  'utf8'
);

describe('manager/maven/extract', () => {
  describe('extractDependencies', () => {
    it('returns null for invalid XML', () => {
      expect(extractDependencies()).toBeNull();
      expect(extractDependencies('invalid xml content')).toBeNull();
      expect(extractDependencies('<foobar></foobar>')).toBeNull();
      expect(extractDependencies('<project></project>')).toBeNull();
    });

    it('extract dependencies from any XML position', () => {
      const res = extractDependencies(simpleContent);
      expect(res).toMatchSnapshot();
    });
  });
});

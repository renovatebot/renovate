/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const { extractPackage } = require('../../../lib/manager/maven/extract');

const simpleContent = fs.readFileSync(
  path.resolve(__dirname, `./_fixtures/simple.pom.xml`),
  'utf8'
);

describe('manager/maven/extract', () => {
  describe('extractDependencies', () => {
    it('returns null for invalid XML', () => {
      expect(extractPackage()).toBeNull();
      expect(extractPackage('invalid xml content')).toBeNull();
      expect(extractPackage('<foobar></foobar>')).toBeNull();
      expect(extractPackage('<project></project>')).toBeNull();
    });

    it('extract dependencies from any XML position', () => {
      const res = extractPackage(simpleContent);
      expect(res).toMatchSnapshot();
    });
  });
});

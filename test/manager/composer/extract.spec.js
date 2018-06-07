const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/composer/extract');

const requirements1 = fs.readFileSync(
  'test/_fixtures/composer/composer1.json',
  'utf8'
);

describe('lib/manager/pip_requirements/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for invalid json', () => {
      expect(extractDependencies('nothing here', config)).toBe(null);
    });
    it('returns null for empty deps', () => {
      expect(extractDependencies('{}', config)).toBe(null);
    });
    it('extracts dependencies', () => {
      const res = extractDependencies(requirements1, config);
      expect(res).toMatchSnapshot();
    });
  });
});

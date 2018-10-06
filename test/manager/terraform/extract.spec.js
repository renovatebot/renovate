const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/terraform/extract');

const tf1 = fs.readFileSync('test/_fixtures/terraform/1.tf', 'utf8');

describe('lib/manager/terraform/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractDependencies('nothing here', config)).toBe(null);
    });
    it('extracts two per file', () => {
      const res = extractDependencies(tf1);
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(6);
    });
  });
});

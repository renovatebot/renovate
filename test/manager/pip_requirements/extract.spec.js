const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/pip_requirements/extract');

const requirements = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements.txt',
  'utf8'
);

describe('lib/manager/pip_requirements/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractDependencies('nothing here', config)).toBe(null);
    });
    it('extracts dependencies', () => {
      const res = extractDependencies(requirements, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
  });
});

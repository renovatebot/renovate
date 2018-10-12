const fs = require('fs');
const {
  extractDependencies,
} = require('../../../lib/manager/pipenv/extract');

const pipfile1 = fs.readFileSync(
  'test/_fixtures/pipenv/Pipfile1',
  'utf8'
);
const pipfile2 = fs.readFileSync(
  'test/_fixtures/pipenv/Pipfile2',
  'utf8'
);

describe('lib/manager/pipenv/extract', () => {
  describe('extractDependencies()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractDependencies('nothing here', config)).toBe(null);
    });
    it('extracts dependencies', () => {
      const res = extractDependencies(pipfile1, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('extracts multiple dependencies', () => {
      const res = extractDependencies(pipfile2, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
  });
});


const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/pip_requirements/extract');

const requirements1 = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements1.txt',
  'utf8'
);
const requirements2 = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements2.txt',
  'utf8'
);
const requirements3 = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements3.txt',
  'utf8'
);

const requirements4 = fs.readFileSync(
  'test/_fixtures/pip_requirements/requirements4.txt',
  'utf8'
);

describe('lib/manager/pip_requirements/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts dependencies', () => {
      const res = extractPackageFile(requirements1, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
    it('extracts multiple dependencies', () => {
      const res = extractPackageFile(requirements2, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles comments and commands', () => {
      const res = extractPackageFile(requirements3, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(5);
    });
    it('handles extras', () => {
      const res = extractPackageFile(requirements4, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
  });
});

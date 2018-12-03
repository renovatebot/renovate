const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/buildkite/extract');

const pipeline1 = fs.readFileSync(
  'test/_fixtures/buildkite/pipeline1.yml',
  'utf8'
);
const pipeline2 = fs.readFileSync(
  'test/_fixtures/buildkite/pipeline2.yml',
  'utf8'
);
const pipeline3 = fs.readFileSync(
  'test/_fixtures/buildkite/pipeline3.yml',
  'utf8'
);
const pipeline4 = fs.readFileSync(
  'test/_fixtures/buildkite/pipeline4.yml',
  'utf8'
);

describe('lib/manager/buildkite/extract', () => {
  describe('extractPackageFile()', () => {
    let config;
    beforeEach(() => {
      config = {};
    });
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', config)).toBe(null);
    });
    it('extracts simple single plugin', () => {
      const res = extractPackageFile(pipeline1, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('extracts multiple plugins in same file', () => {
      const res = extractPackageFile(pipeline2, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('adds skipReason', () => {
      const res = extractPackageFile(pipeline3, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
    it('extracts arrays of plugins', () => {
      const res = extractPackageFile(pipeline4, config).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2); // TODO: should be 4
    });
  });
});

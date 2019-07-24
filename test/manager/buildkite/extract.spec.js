const fs = require('fs');
const {
  extractPackageFile,
} = require('../../../lib/manager/buildkite/extract');

const pipeline1 = fs.readFileSync(
  'test/manager/buildkite/_fixtures/pipeline1.yml',
  'utf8'
);
const pipeline2 = fs.readFileSync(
  'test/manager/buildkite/_fixtures/pipeline2.yml',
  'utf8'
);
const pipeline3 = fs.readFileSync(
  'test/manager/buildkite/_fixtures/pipeline3.yml',
  'utf8'
);
const pipeline4 = fs.readFileSync(
  'test/manager/buildkite/_fixtures/pipeline4.yml',
  'utf8'
);

describe('lib/manager/buildkite/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });
    it('extracts simple single plugin', () => {
      const res = extractPackageFile(pipeline1).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(1);
    });
    it('extracts multiple plugins in same file', () => {
      const res = extractPackageFile(pipeline2).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(2);
    });
    it('adds skipReason', () => {
      const res = extractPackageFile(pipeline3).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(3);
    });
    it('extracts arrays of plugins', () => {
      const res = extractPackageFile(pipeline4).deps;
      expect(res).toMatchSnapshot();
      expect(res).toHaveLength(4);
    });
  });
});

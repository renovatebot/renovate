import { readFileSync } from 'fs';
import { extractPackageFile } from './extract';

const pipeline1 = readFileSync(
  'lib/manager/buildkite/_fixtures__/pipeline1.yml',
  'utf8'
);
const pipeline2 = readFileSync(
  'lib/manager/buildkite/_fixtures__/pipeline2.yml',
  'utf8'
);
const pipeline3 = readFileSync(
  'lib/manager/buildkite/_fixtures__/pipeline3.yml',
  'utf8'
);
const pipeline4 = readFileSync(
  'lib/manager/buildkite/_fixtures__/pipeline4.yml',
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

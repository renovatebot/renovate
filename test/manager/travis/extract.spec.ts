import { readFileSync } from 'fs';
import { resolve } from 'path';
import { extractPackageFile } from '../../../lib/manager/travis/extract';

const invalidYAML = readFileSync(
  resolve('test/manager/travis/_fixtures/invalid.yml'),
  'utf8'
);

describe('lib/manager/travis/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns empty if fails to parse', () => {
      const res = extractPackageFile('blahhhhh:foo:@what\n');
      expect(res).toBeNull();
    });
    it('returns results', () => {
      const res = extractPackageFile('node_js:\n  - 6\n  - 8\n');
      expect(res).toMatchSnapshot();
      expect(res.deps).toHaveLength(1);
    });
    it('should handle invalid YAML', () => {
      const res = extractPackageFile(invalidYAML);
      expect(res).toBeNull();
    });
  });
});

import { readFileSync } from 'fs';
import { extractPackageFile } from '../../../lib/manager/docker-compose/extract';

const yamlFile = readFileSync(
  'test/manager/docker-compose/_fixtures/docker-compose.1.yml',
  'utf8'
);

describe('lib/manager/docker-compose/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile({ fileContent: 'nothing here' })).toBeNull();
    });
    it('returns null for malformed YAML', () => {
      expect(
        extractPackageFile({ fileContent: 'nothing here\n:::::::' })
      ).toBeNull();
    });
    it('extracts multiple image lines', () => {
      const res = extractPackageFile({ fileContent: yamlFile });
      expect(res.deps).toMatchSnapshot();
      expect(res.deps).toHaveLength(8);
    });
  });
});

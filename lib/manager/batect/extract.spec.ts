import { readFileSync } from 'fs';
import { getDep } from '../dockerfile/extract';
import { extractPackageFile } from './extract';

const sampleFile = readFileSync(
  'lib/manager/batect/__fixtures__/batect.yml',
  'utf8'
);

describe('lib/manager/batect/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty configuration file', () => {
      expect(extractPackageFile('')).toBeNull();
    });

    it('returns null for non-object configuration file', () => {
      expect(extractPackageFile('nothing here')).toBeNull();
    });

    it('returns null for malformed configuration file', () => {
      expect(extractPackageFile('nothing here\n:::::::')).toBeNull();
    });

    it('returns null for configuration file without containers', () => {
      expect(extractPackageFile('something_else: some_value')).toBeNull();
    });

    it('extracts all available images from a valid Batect configuration file', () => {
      const res = extractPackageFile(sampleFile);

      expect(res.deps).toEqual([
        getDep('alpine:1.2.3'),
        getDep('alpine:1.2.3'),
        getDep('ubuntu:20.04'),
        getDep(
          'postgres:9.6.20@sha256:166179811e4c75f8a092367afed6091208c8ecf60b111c7e49f29af45ca05e08'
        ),
      ]);
    });
  });
});

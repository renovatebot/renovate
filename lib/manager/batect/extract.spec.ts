import { readFileSync } from 'fs';
import { id as dockerVersioning } from '../../versioning/docker';
import { PackageDependency } from '../common';
import { getDep } from '../dockerfile/extract';
import { extractPackageFile } from './extract';

const sampleFile = readFileSync(
  'lib/manager/batect/__fixtures__/batect.yml',
  'utf8'
);

function createDockerDependency(tag: string): PackageDependency {
  return {
    ...getDep(tag),
    versioning: dockerVersioning,
  };
}

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
        createDockerDependency('alpine:1.2.3'),
        createDockerDependency('alpine:1.2.3'),
        createDockerDependency('ubuntu:20.04'),
        createDockerDependency(
          'postgres:9.6.20@sha256:166179811e4c75f8a092367afed6091208c8ecf60b111c7e49f29af45ca05e08'
        ),
      ]);
    });
  });
});

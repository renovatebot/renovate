import { getName, loadFixture } from '../../../test/util';
import { extractPackageFile } from './extract';

const validApplication = loadFixture('validApplication.yml');
const malformedApplication = loadFixture('malformedApplications.yml');
const randomManifest = loadFixture('randomManifest.yml');

describe(getName(), () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty', () => {
      expect(extractPackageFile('nothing here', 'applications.yml')).toBeNull();
    });

    it('return null for kubernetes manifest', () => {
      const result = extractPackageFile(randomManifest, 'applications.yml');
      expect(result).toBeNull();
    });

    it('return null if deps array would be empty', () => {
      const result = extractPackageFile(
        malformedApplication,
        'applications.yml'
      );
      expect(result).toBeNull();
    });

    it('full rest', () => {
      const result = extractPackageFile(validApplication, 'applications.yml');
      expect(result).not.toBeNull();
      expect(result.deps).toBeArrayOfSize(3);
      expect(result.deps).toMatchSnapshot();
    });
  });
});

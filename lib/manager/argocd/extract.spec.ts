import { Fixtures } from '../../../test/fixtures';
import { extractPackageFile } from './extract';

const validApplication = Fixtures.get('validApplication.yml');
const malformedApplication = Fixtures.get('malformedApplications.yml');
const randomManifest = Fixtures.get('randomManifest.yml');

describe('manager/argocd/extract', () => {
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

    it('full test', () => {
      const result = extractPackageFile(validApplication, 'applications.yml');
      expect(result).not.toBeNull();
      expect(result.deps).toBeArrayOfSize(3);
      expect(result.deps).toMatchSnapshot();
    });
  });
});

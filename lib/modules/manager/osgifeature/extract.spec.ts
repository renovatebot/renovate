import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const featureWithBundlesAsObjects = Fixtures.get('bundles-as-objects.json');
const featureWithBundlesAsStrings = Fixtures.get('bundles-as-strings.json');
const featureWithComment = Fixtures.get('with-comment.json');

describe('modules/manager/osgifeature/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty file', () => {
      expect(extractPackageFile('', '', undefined)).toBeNull();
    });

    it('returns null for invalid file', () => {
      expect(extractPackageFile('this-is-not-json', '', undefined)).toBeNull();
    });

    it('extracts the bundles from a file with object bundles definitions', () => {
      const packageFile = extractPackageFile(
        featureWithBundlesAsObjects,
        '',
        undefined
      );
      expect(packageFile).toEqual({
        deps: [
          {
            datasource: 'maven',
            depName: 'commons-codec:commons-codec',
            currentValue: '1.15',
          },
          {
            datasource: 'maven',
            depName: 'commons-collections:commons-collections',
            currentValue: '3.2.2',
          },
        ],
      });
    });

    it('extracts the bundles from a file with string bundles defintions', () => {
      const packageFile = extractPackageFile(
        featureWithBundlesAsStrings,
        '',
        undefined
      );
      expect(packageFile).toEqual({
        deps: [
          {
            datasource: 'maven',
            depName: 'org.apache.felix:org.apache.felix.scr',
            currentValue: '2.1.26',
          },
          {
            datasource: 'maven',
            depName: 'org.apache.felix:org.apache.felix.log',
            currentValue: '1.2.4',
          },
        ],
      });
    });

    it('extracts the bundles from a file with comments', () => {
      const packageFile = extractPackageFile(featureWithComment, '', undefined);
      expect(packageFile).toEqual({
        deps: [
          {
            datasource: 'maven',
            depName: 'org.apache.aries:org.apache.aries.util',
            currentValue: '1.1.3',
          },
        ],
      });
    });
  });
});

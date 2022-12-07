import { Fixtures } from '../../../../test/fixtures';
import { extractPackageFile } from './extract';

const featureWithBundlesAsObjects = Fixtures.get('bundles-as-objects.json');
const featureWithBundlesAsStrings = Fixtures.get('bundles-as-strings.json');
const featureWithComment = Fixtures.get('with-comment.json');
const artifactsExtension = Fixtures.get('extension-artifacts.json');
const doubleSlashNotComment = Fixtures.get('double-slash-not-comment.json');
const frameworkArtifact = Fixtures.get('framework-artifact.json');
const versionWithVariable = Fixtures.get('version-with-variable.json');
const bundlesAsObjectsMissingId = Fixtures.get(
  'bundles-as-object-missing-id.json'
);

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

    it('extracts the artifacts from an extension section', () => {
      const packageFile = extractPackageFile(artifactsExtension, '', undefined);
      expect(packageFile).toEqual({
        deps: [
          {
            datasource: 'maven',
            depName: 'com.day.cq:core.wcm.components.all',
            currentValue: '2.21.0',
          },
        ],
      });
    });

    it('extracts the artifacts a file with a double slash', () => {
      const packageFile = extractPackageFile(
        doubleSlashNotComment,
        '',
        undefined
      );
      expect(packageFile).toEqual({
        deps: [
          {
            datasource: 'maven',
            depName: 'com.h2database:h2-mvstore',
            currentValue: '2.1.214',
          },
          {
            datasource: 'maven',
            depName: 'org.mongodb:mongo-java-driver',
            currentValue: '3.12.11',
          },
        ],
      });
    });

    it('extracts the artifacts from the framework artifact section', () => {
      const packageFile = extractPackageFile(frameworkArtifact, '', undefined);
      expect(packageFile).toEqual({
        deps: [
          {
            datasource: 'maven',
            depName: 'org.apache.felix:org.apache.felix.framework',
            currentValue: '7.0.5',
          },
        ],
      });
    });

    it('skips depedencies with with missing ids', () => {
      const packageFile = extractPackageFile(
        bundlesAsObjectsMissingId,
        '',
        undefined
      );
      expect(packageFile).toBeNull();
    });
  });

  it('skips artifacts with variables in version', () => {
    const packageFile = extractPackageFile(versionWithVariable, '', undefined);
    expect(packageFile).toEqual({
      deps: [
        {
          datasource: 'maven',
          depName: 'com.fasterxml.jackson.core:jackson-annotations',
          skipReason: 'contains-variable',
        },
      ],
    });
  });
});

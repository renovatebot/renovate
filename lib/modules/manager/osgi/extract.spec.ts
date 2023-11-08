import { extractPackageFile } from '.';

const noArtifacts = `{
  "configurations": {
    "org.apache.sling.jcr.davex.impl.servlets.SlingDavExServlet":{
      "alias":"/server"
    }
  }
}`;
const unsupportedFeatureVersion = `{
  "feature-resource-version": "2.0",
  "bundles":[
      {
          "id":"commons-codec:commons-codec:1.15",
          "start-order":"5"
      }
  ]
}`;
const featureWithBundlesAsObjects = `{
  "feature-resource-version": "1.0",
  "bundles":[
      {
          "id":"commons-codec:commons-codec:1.15",
          "start-order":"5"
      },
      {
          "id":"commons-collections:commons-collections:3.2.2",
          "start-order":"15"
      }
  ]
}`;
const featureWithBundlesAsStrings = `{
  "bundles": [
    "org.apache.felix/org.apache.felix.scr/2.1.26",
    "org.apache.felix/org.apache.felix.log/1.2.4"
  ]
}`;
const featureWithComment = `{
  // comments are permitted
  "bundles": [ "org.apache.aries:org.apache.aries.util:1.1.3" ]
}`;
const artifactsExtension = `{
  "content-packages:ARTIFACTS|true": [
      "com.day.cq:core.wcm.components.all:zip:2.21.0"
  ]
}`;
const doubleSlashNotComment = `{
  "bundles":[
       {
           "id":"com.h2database:h2-mvstore:2.1.214",
           "start-order":"15"
      },
      {
           "id":"org.mongodb:mongo-java-driver:3.12.11",
           "start-order":"15"
       }
  ],
  "configurations":{
      "org.apache.jackrabbit.oak.plugins.document.DocumentNodeStoreService":{
          "db":"sling",
          "mongouri":"mongodb://$[env:MONGODB_HOST;default=localhost]:$[env:MONGODB_PORT;type=Integer;default=27017]"
       }
  }
}`;
const frameworkArtifact = `{
  "execution-environment:JSON|false":{
      "framework":{
          "id":"org.apache.felix:org.apache.felix.framework:7.0.5"
      }
  }
}`;
const versionWithVariable = `{
  "bundles":[
      {
          "id":"com.fasterxml.jackson.core:jackson-annotations:$\{jackson.version}",
          "start-order":"20"
      }
  ]
}`;
const malformedDefinitions = `{
  "bundles":[
      {
          "#": "missing the 'id' attribute",
          "not-id":"commons-codec:commons-codec:1.15"
      },
      {
          "#": "too few parts in the GAV definition",
          "id":"commons-codec:1.15"
      },
      {
          "#": "valid definition, should be extracted",
          "id":"commons-codec:commons-codec:1.15"
      }
  ]
}`;
const invalidFeatureVersion = `{
  "feature-resource-version": "unknown",
  "bundles":[
      {
          "id":"commons-codec:commons-codec:1.15",
          "start-order":"5"
      }
  ]
}`;

describe('modules/manager/osgi/extract', () => {
  describe('extractPackageFile()', () => {
    it('returns null for empty file', () => {
      expect(extractPackageFile('', '', undefined)).toBeNull();
    });

    it('returns null for invalid file', () => {
      expect(extractPackageFile('this-is-not-json', '', undefined)).toBeNull();
    });

    it('returns null for unsupported version of feature model definition', () => {
      expect(
        extractPackageFile(unsupportedFeatureVersion, '', undefined),
      ).toBeNull();
    });

    it('returns null for an invalid version of feature model definition', () => {
      expect(
        extractPackageFile(invalidFeatureVersion, '', undefined),
      ).toBeNull();
    });

    it('returns null for a null string passed in as a feature model definition', () => {
      expect(extractPackageFile('null', '', undefined)).toBeNull();
    });

    it('returns null for a valid file with no artifact definitions', () => {
      expect(extractPackageFile(noArtifacts, '', undefined)).toBeNull();
    });

    it('extracts the bundles from a file with object bundles definitions', () => {
      const packageFile = extractPackageFile(
        featureWithBundlesAsObjects,
        '',
        undefined,
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
        undefined,
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
        undefined,
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

    it('skips depedencies with with malformed definitions', () => {
      const packageFile = extractPackageFile(
        malformedDefinitions,
        '',
        undefined,
      );
      expect(packageFile).toEqual({
        deps: [
          {
            depName: 'commons-codec:1.15',
            skipReason: 'invalid-value',
          },
          {
            datasource: 'maven',
            depName: 'commons-codec:commons-codec',
            currentValue: '1.15',
          },
        ],
      });
    });

    it('skips artifacts with variables in version', () => {
      const packageFile = extractPackageFile(
        versionWithVariable,
        '',
        undefined,
      );
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
});

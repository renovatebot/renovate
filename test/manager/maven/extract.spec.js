/* eslint-disable no-template-curly-in-string */
const fs = require('fs');
const path = require('path');
const { extractDependencies } = require('../../../lib/manager/maven/extract');

function readFixture(fixture) {
  return fs.readFileSync(
    path.resolve(__dirname, `../../_fixtures/maven/${fixture}`),
    'utf8'
  );
}

const simpleContent = readFixture('simple.pom.xml');
const simpleResult = {
  datasource: 'maven',
  homepage: 'http://example.org/index.html',
  sourceUrl: 'http://example.org/src.git',
  deps: [
    {
      depName: 'org.example/parent',
      currentValue: '42',
      fileReplacePosition: 178,
      purl:
        'pkg:maven/org.example/parent?repository_url=http://repo.maven.apache.org/maven2',
    },
    {
      depName: 'org.example/foo',
      currentValue: '0.0.1',
      fileReplacePosition: 749,
      purl:
        'pkg:maven/org.example/foo?repository_url=http://repo.maven.apache.org/maven2',
    },
    {
      depName: 'org.example/bar',
      currentValue: '1.0.0',
      fileReplacePosition: 897,
      purl:
        'pkg:maven/org.example/bar?repository_url=http://repo.maven.apache.org/maven2',
    },
    {
      depName: 'org.apache.maven.scm/maven-scm-provider-gitexe',
      currentValue: '1.8.1',
      fileReplacePosition: 1329,
      purl:
        'pkg:maven/org.apache.maven.scm/maven-scm-provider-gitexe?repository_url=http://repo.maven.apache.org/maven2',
    },
    {
      depName: 'org.example/${artifact-id-placeholder}',
      currentValue: '0.0.1',
      skipReason: 'name-placeholder',
    },
    {
      depName: '${group-id-placeholder}/baz',
      currentValue: '0.0.1',
      skipReason: 'name-placeholder',
    },
    {
      depName: 'org.example/quux',
      currentValue: '${resourceServerVersion}',
      skipReason: 'version-placeholder',
    },
    {
      depName: 'org.example/quuz',
      currentValue: '1.2.3',
      fileReplacePosition: 2521,
      purl:
        'pkg:maven/org.example/quuz?repository_url=http://repo.maven.apache.org/maven2',
    },
    {
      depName: 'org.example/profile-artifact',
      currentValue: '${profile-placeholder}',
      skipReason: 'version-placeholder',
    },
    {
      depName: 'org.apache.maven.plugins/maven-checkstyle-plugin',
      currentValue: '2.17',
      fileReplacePosition: 3057,
      purl:
        'pkg:maven/org.apache.maven.plugins/maven-checkstyle-plugin?repository_url=http://repo.maven.apache.org/maven2',
    },
  ],
};

describe('manager/maven/extract', () => {
  describe('.extractDependencies()', () => {
    it('returns null for invalid XML', () => {
      const res = extractDependencies('<project></project>');
      expect(res).toEqual(null);
    });
    it('extract dependencies from any XML position', () => {
      const res = extractDependencies(simpleContent);
      expect(res).toEqual(simpleResult);
    });
  });
});

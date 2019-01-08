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
      depName: 'org.example:parent',
      currentValue: '42',
      mavenXmlPath: [
        {
          artifactId: 'parent',
        },
      ],
    },
    {
      depName: 'org.example:foo',
      currentValue: '0.0.1',
      mavenXmlPath: [
        'dependencyManagement',
        'dependencies',
        'dependency',
        {
          artifactId: 'foo',
        },
      ],
    },
    {
      depName: 'org.example:bar',
      currentValue: '1.0.0',
      mavenXmlPath: [
        'dependencyManagement',
        'dependencies',
        'dependency',
        {
          artifactId: 'bar',
        },
      ],
    },
    {
      depName: 'org.apache.maven.scm:maven-scm-provider-gitexe',
      currentValue: '1.8.1',
      mavenXmlPath: [
        'build',
        'plugins',
        'plugin',
        {
          artifactId: 'maven-release-plugin',
        },
        'dependencies',
        {
          artifactId: 'maven-scm-provider-gitexe',
        },
      ],
    },
    {
      depName: 'org.example:${artifact-id-placeholder}',
      currentValue: '0.0.1',
      mavenXmlPath: [
        'dependencies',
        'dependency',
        {
          artifactId: '${artifact-id-placeholder}',
        },
      ],
      skipReason: 'name-placeholder',
    },
    {
      depName: '${group-id-placeholder}:baz',
      currentValue: '0.0.1',
      mavenXmlPath: [
        'dependencies',
        'dependency',
        {
          artifactId: 'baz',
        },
      ],
      skipReason: 'name-placeholder',
    },
    {
      depName: 'org.example:quux',
      currentValue: '${resourceServerVersion}',
      mavenXmlPath: [
        'dependencies',
        'dependency',
        {
          artifactId: 'quux',
        },
      ],
      skipReason: 'version-placeholder',
    },
    {
      depName: 'org.example:quuz',
      currentValue: '1.2.3',
      mavenXmlPath: [
        'dependencies',
        'dependency',
        {
          artifactId: 'quuz',
        },
      ],
    },
    {
      depName: 'org.example:profile-artifact',
      currentValue: '${profile-placeholder}',
      mavenXmlPath: [
        'profiles',
        {
          id: 'profile-id',
        },
        'dependencies',
        {
          artifactId: 'profile-artifact',
        },
      ],
      skipReason: 'version-placeholder',
    },
    {
      depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
      currentValue: '2.17',
      mavenXmlPath: [
        'reporting',
        'plugins',
        {
          artifactId: 'maven-checkstyle-plugin',
        },
      ],
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

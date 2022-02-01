import { Fixtures } from '../../../test/fixtures';
import { extractPackage, extractRegistries } from './extract';

const minimumContent = Fixtures.get(`minimum.pom.xml`);
const simpleContent = Fixtures.get(`simple.pom.xml`);
const simpleCentralContent = Fixtures.get(`simple.central.pom.xml`);

const mirrorSettingsContent = Fixtures.get(`mirror.settings.xml`);
const profileSettingsContent = Fixtures.get(`profile.settings.xml`);
const complexSettingsContent = Fixtures.get(`complex.settings.xml`);

describe('manager/maven/extract', () => {
  describe('extractDependencies', () => {
    it('returns null for invalid XML', () => {
      expect(extractPackage(undefined)).toBeNull();
      expect(extractPackage('invalid xml content')).toBeNull();
      expect(extractPackage('<foobar></foobar>')).toBeNull();
      expect(extractPackage('<project></project>')).toBeNull();
    });

    it('extract dependencies from any XML position', () => {
      const res = extractPackage(simpleContent);
      expect(res).toMatchSnapshot({
        deps: [
          {
            depName: 'org.example:parent',
            currentValue: '42',
            depType: 'parent',
          },
          {
            depName: 'org.example:foo',
            currentValue: '0.0.1',
            depType: 'compile',
          },
          {
            depName: 'org.example:bar',
            currentValue: '1.0.0',
            depType: 'compile',
          },
          {
            depName: 'org.apache.maven.plugins:maven-release-plugin',
            currentValue: '2.4.2',
            depType: 'build',
          },
          {
            depName: 'org.apache.maven.scm:maven-scm-provider-gitexe',
            currentValue: '1.8.1',
            depType: 'build',
          },
          {
            depName: 'org.example:extension-artefact',
            currentValue: '1.0',
            depType: 'build',
          },
          {
            depName: 'org.example:${artifact-id-placeholder}',
            currentValue: '0.0.1',
            depType: 'compile',
          },
          {
            depName: '${group-id-placeholder}:baz',
            currentValue: '0.0.1',
            depType: 'compile',
          },
          {
            depName: '${quuxGroup}:${quuxId}',
            currentValue: '${quuxVersion}',
            depType: 'compile',
          },
          {
            depName: '${quuxGroup}:${quuxId}-test',
            currentValue: '${quuxVersion}',
            depType: 'compile',
          },
          {
            depName: 'org.example:quuz',
            currentValue: '1.2.3',
            depType: 'test',
          },
          {
            depName: 'org.example:quuuz',
            currentValue: "it's not a version",
            depType: 'compile',
          },
          {
            depName: 'org.example:hard-range',
            currentValue: '[1.0.0]',
            depType: 'compile',
          },
          {
            depName: 'org.example:relocation-artifact',
            currentValue: '1.0',
          },
          {
            depName: 'org.example:profile-artifact',
            currentValue: '${profile-placeholder}',
            depType: 'compile',
          },
          {
            depName: 'org.example:profile-build-artefact',
            currentValue: '2.17',
            depType: 'build',
          },
          {
            depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
            currentValue: '2.17',
            depType: 'build',
          },
        ],
        mavenProps: {
          quuxGroup: {
            packageFile: null,
            val: 'org.example',
          },
          quuxId: {
            packageFile: null,
            val: 'quux',
          },
          quuxVersion: {
            packageFile: null,
            val: '1.2.3.4',
          },
        },
        packageFile: null,
      });
    });
    it('extract dependencies from any XML position with Central Maven', () => {
      const res = extractPackage(simpleCentralContent);
      expect(res).toMatchSnapshot({
        deps: [
          {
            depName: 'org.example:parent',
            currentValue: '42',
            depType: 'parent',
          },
          {
            depName: 'org.example:foo',
            currentValue: '0.0.1',
            depType: 'compile',
          },
          {
            depName: 'org.example:bar',
            currentValue: '1.0.0',
            depType: 'compile',
          },
          {
            depName: 'org.apache.maven.plugins:maven-release-plugin',
            currentValue: '2.4.2',
            depType: 'build',
          },
          {
            depName: 'org.apache.maven.scm:maven-scm-provider-gitexe',
            currentValue: '1.8.1',
            depType: 'build',
          },
          {
            depName: 'org.example:extension-artefact',
            currentValue: '1.0',
            depType: 'build',
          },
          {
            depName: 'org.example:${artifact-id-placeholder}',
            currentValue: '0.0.1',
            depType: 'compile',
          },
          {
            depName: '${group-id-placeholder}:baz',
            currentValue: '0.0.1',
            depType: 'compile',
          },
          {
            depName: '${quuxGroup}:${quuxId}',
            currentValue: '${quuxVersion}',
            depType: 'compile',
          },
          {
            depName: '${quuxGroup}:${quuxId}-test',
            currentValue: '${quuxVersion}',
            depType: 'compile',
          },
          {
            depName: 'org.example:quuz',
            currentValue: '1.2.3',
            depType: 'test',
          },
          {
            depName: 'org.example:quuuz',
            currentValue: "it's not a version",
            depType: 'compile',
          },
          {
            depName: 'org.example:hard-range',
            currentValue: '[1.0.0]',
            depType: 'compile',
          },
          {
            depName: 'org.example:relocation-artifact',
            currentValue: '1.0',
          },
          {
            depName: 'org.example:profile-artifact',
            currentValue: '${profile-placeholder}',
            depType: 'compile',
          },
          {
            depName: 'org.example:profile-build-artefact',
            currentValue: '2.17',
            depType: 'build',
          },
          {
            depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
            currentValue: '2.17',
            depType: 'build',
          },
        ],
        mavenProps: {
          quuxGroup: {
            packageFile: null,
            val: 'org.example',
          },
          quuxId: {
            packageFile: null,
            val: 'quux',
          },
          quuxVersion: {
            packageFile: null,
            val: '1.2.3.4',
          },
        },
        packageFile: null,
      });
    });
    it('tries minimum manifests', () => {
      const res = extractPackage(minimumContent);
      expect(res).toEqual({
        datasource: 'maven',
        deps: [],
        mavenProps: {},
        packageFile: null,
      });
    });
  });
  describe('extractRegistries', () => {
    it('returns null for invalid XML', () => {
      expect(extractRegistries(undefined)).toBeEmptyArray();
      expect(extractRegistries('invalid xml content')).toBeEmptyArray();
      expect(extractRegistries('<foobar></foobar>')).toBeEmptyArray();
      expect(extractRegistries('<settings></settings>')).toBeEmptyArray();
    });

    it('extract registries from a simple mirror settings file', () => {
      const res = extractRegistries(mirrorSettingsContent);
      expect(res).toStrictEqual([
        'https://artifactory.company.com/artifactory/my-maven-repo',
      ]);
    });

    it('extract registries from a simple profile settings file', () => {
      const res = extractRegistries(profileSettingsContent);
      expect(res).toStrictEqual([
        'https://repo.adobe.com/nexus/content/groups/public',
      ]);
    });

    it('extract registries from a complex profile settings file', () => {
      const res = extractRegistries(complexSettingsContent);
      expect(res).toStrictEqual([
        'https://artifactory.company.com/artifactory/my-maven-repo',
        'https://repo.adobe.com/nexus/content/groups/public',
        'https://repo.adobe.com/v2/nexus/content/groups/public',
        'https://repo.adobe.com/v3/nexus/content/groups/public',
        'https://repo.adobe.com/v4/nexus/content/groups/public',
      ]);
    });
  });
});

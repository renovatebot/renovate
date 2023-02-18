import { Fixtures } from '../../../../test/fixtures';
import { extractPackage, extractRegistries } from './extract';

const minimumContent = Fixtures.get(`minimum.pom.xml`);
const simpleContent = Fixtures.get(`simple.pom.xml`);

const mirrorSettingsContent = Fixtures.get(`mirror.settings.xml`);
const profileSettingsContent = Fixtures.get(`profile.settings.xml`);
const complexSettingsContent = Fixtures.get(`complex.settings.xml`);

describe('modules/manager/maven/extract', () => {
  describe('extractDependencies', () => {
    it('returns null for invalid XML', () => {
      expect(extractPackage('', 'some-file')).toBeNull();
      expect(extractPackage('invalid xml content', 'some-file')).toBeNull();
      expect(extractPackage('<foobar></foobar>', 'some-file')).toBeNull();
      expect(extractPackage('<project></project>', 'some-file')).toBeNull();
    });

    it('extract dependencies from any XML position', () => {
      const res = extractPackage(simpleContent, 'some-file');
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
            depName: 'org.example:optional',
            currentValue: '1.0.0',
            depType: 'optional',
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
            packageFile: 'some-file',
            val: 'org.example',
          },
          quuxId: {
            packageFile: 'some-file',
            val: 'quux',
          },
          quuxVersion: {
            packageFile: 'some-file',
            val: '1.2.3.4',
          },
        },
        packageFile: 'some-file',
      });
    });

    it('tries minimum manifests', () => {
      const res = extractPackage(minimumContent, 'some-file');
      expect(res).toEqual({
        datasource: 'maven',
        deps: [],
        mavenProps: {},
        packageFile: 'some-file',
        packageFileVersion: '1',
      });
    });
  });

  describe('extractRegistries', () => {
    it('returns null for invalid XML', () => {
      expect(extractRegistries('')).toBeEmptyArray();
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

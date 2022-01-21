import { loadFixture } from '../../../test/util';
import { extractPackage, extractRegistries } from './extract';

const minimumContent = loadFixture(`minimum.pom.xml`);
const simpleContent = loadFixture(`simple.pom.xml`);

const mirrorSettingsContent = loadFixture(`mirror.settings.xml`);
const profileSettingsContent = loadFixture(`profile.settings.xml`);
const complexSettingsContent = loadFixture(`complex.settings.xml`);

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
          { depName: 'org.example:parent', currentValue: '42' },
          { depName: 'org.example:foo', currentValue: '0.0.1' },
          { depName: 'org.example:bar', currentValue: '1.0.0' },
          {
            depName: 'org.apache.maven.plugins:maven-release-plugin',
            currentValue: '2.4.2',
          },
          {
            depName: 'org.apache.maven.scm:maven-scm-provider-gitexe',
            currentValue: '1.8.1',
          },
          {
            depName: 'org.example:${artifact-id-placeholder}',
            currentValue: '0.0.1',
          },
          { depName: '${group-id-placeholder}:baz', currentValue: '0.0.1' },
          { depName: '${quuxGroup}:${quuxId}', currentValue: '${quuxVersion}' },
          {
            depName: '${quuxGroup}:${quuxId}-test',
            currentValue: '${quuxVersion}',
          },
          {
            depName: 'org.example:quuz',
            currentValue: '1.2.3',
            depType: 'test',
          },
          { depName: 'org.example:quuuz', currentValue: "it's not a version" },
          { depName: 'org.example:hard-range', currentValue: '[1.0.0]' },
          {
            depName: 'org.example:profile-artifact',
            currentValue: '${profile-placeholder}',
          },
          {
            depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
            currentValue: '2.17',
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

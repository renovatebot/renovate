import { Fixtures } from '../../../../test/fixtures';
import {
  extractPackage,
  extractSettings,
  getMirrorMatch,
  mergeReposAndMirrors,
} from './extract';
import type { MavenMirror } from './types';

const minimumContent = Fixtures.get(`minimum.pom.xml`);
const simpleContent = Fixtures.get(`simple.pom.xml`);

const mirrorSettingsContent = Fixtures.get(`mirror.settings.xml`);
const profileSettingsContent = Fixtures.get(`profile.settings.xml`);
const complexSettingsContent = Fixtures.get(`complex.settings.xml`);

describe('modules/manager/maven/extract', () => {
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
    it('tries minimum manifests', () => {
      const res = extractPackage(minimumContent);
      expect(res).toEqual({
        datasource: 'maven',
        deps: [],
        mavenProps: {},
        packageFile: null,
        packageFileVersion: '1',
      });
    });
  });
  describe('extractRegistries', () => {
    it('returns null for invalid XML', () => {
      expect(extractSettings(undefined)).toStrictEqual({
        mirrors: [],
        repositories: [],
      });
      expect(extractSettings('invalid xml content')).toStrictEqual({
        mirrors: [],
        repositories: [],
      });
      expect(extractSettings('<foobar></foobar>')).toStrictEqual({
        mirrors: [],
        repositories: [],
      });
      expect(extractSettings('<settings></settings>')).toStrictEqual({
        mirrors: [],
        repositories: [],
      });
    });

    it('extract registries from a simple mirror settings file', () => {
      const res = extractSettings(mirrorSettingsContent);
      expect(res).toStrictEqual({
        mirrors: [
          {
            id: 'my-maven-repo',
            mirrorOf: '*',
            url: 'https://artifactory.company.com/artifactory/my-maven-repo',
          },
        ],
        repositories: [],
      });
    });

    it('extract registries from a simple profile settings file', () => {
      const res = extractSettings(profileSettingsContent);
      expect(res).toStrictEqual({
        mirrors: [],
        repositories: [
          {
            id: 'adobe-public-releases',
            url: 'https://repo.adobe.com/nexus/content/groups/public',
          },
        ],
      });
    });

    it('extract registries from a complex profile settings file', () => {
      const res = extractSettings(complexSettingsContent);
      expect(res).toStrictEqual({
        mirrors: [
          {
            id: 'my-maven-repo',
            mirrorOf: '*,!custom-repo',
            url: 'https://artifactory.company.com/artifactory/my-maven-repo',
          },
          {
            id: 'my-maven-repo-v2',
            mirrorOf: 'custom-repo',
            url: 'https://repo.adobe.com/nexus/content/groups/public',
          },
        ],
        repositories: [
          {
            id: 'adobe-public-releases',
            url: 'https://repo.adobe.com/nexus/content/groups/public',
          },
          {
            id: 'adobe-public-releases-v2',
            url: 'https://repo.adobe.com/v2/nexus/content/groups/public',
          },
          {
            id: 'adobe-public-releases-v3',
            url: 'https://repo.adobe.com/v3/nexus/content/groups/public',
          },
          {
            id: 'adobe-public-releases-v4',
            url: 'https://repo.adobe.com/v4/nexus/content/groups/public',
          },
        ],
      });
    });

    it('matches mirrors correctly on repos', () => {
      const masterMirror: MavenMirror = {
        id: 'master-mirror',
        mirrorOf: '*',
        url: 'https://master-mirror',
      };
      const directMirror1: MavenMirror = {
        id: 'direct-mirror1',
        mirrorOf: 'repo1',
        url: 'https://direct-mirror1',
      };
      const directMirror2: MavenMirror = {
        id: 'direct-mirror2',
        mirrorOf: 'repo2',
        url: 'https://direct-mirror2',
      };
      const exceptMirror: MavenMirror = {
        id: 'except-mirror1',
        mirrorOf: '*,!repo1',
        url: 'https://except-mirror',
      };

      // master mirror
      let mirror = getMirrorMatch([masterMirror], {
        id: 'central',
        url: 'https://bar',
      });
      expect(mirror).toStrictEqual(masterMirror);

      mirror = getMirrorMatch([directMirror1], {
        id: 'repo1',
        url: 'https://bar',
      });
      expect(mirror).toStrictEqual(directMirror1);

      mirror = getMirrorMatch([directMirror2], {
        id: 'repo1',
        url: 'https://bar',
      });
      expect(mirror).toBeUndefined();

      mirror = getMirrorMatch([directMirror1], {
        id: 'repo2',
        url: 'https://bar',
      });
      expect(mirror).toBeUndefined();

      mirror = getMirrorMatch([exceptMirror], {
        id: 'repo2',
        url: 'https://bar',
      });
      expect(mirror).toStrictEqual(exceptMirror);

      mirror = getMirrorMatch([exceptMirror], {
        id: 'repo1',
        url: 'https://bar',
      });
      expect(mirror).toBeUndefined();
    });

    it('merges mirrors and repos correctly', () => {
      let urls = mergeReposAndMirrors(
        [
          {
            id: 'master-mirror',
            mirrorOf: '*',
            url: 'https://master-mirror',
          },
        ],
        [
          { id: 'repo1', url: 'https://repo1' },
          { id: 'repo2', url: 'https://repo2' },
        ]
      );
      expect(urls).toStrictEqual(['https://master-mirror']);

      urls = mergeReposAndMirrors(
        [
          {
            id: 'direct-mirror',
            mirrorOf: 'repo1',
            url: 'https://direct-mirror',
          },
        ],
        [
          { id: 'repo1', url: 'https://repo1' },
          { id: 'repo2', url: 'https://repo2' },
        ]
      );
      expect(urls).toStrictEqual(['https://direct-mirror', 'https://repo2']);

      urls = mergeReposAndMirrors(
        [
          {
            id: 'direct-mirror',
            mirrorOf: 'foobar',
            url: 'https://direct-mirror',
          },
        ],
        [
          { id: 'repo1', url: 'https://repo1' },
          { id: 'repo2', url: 'https://repo2' },
        ]
      );
      expect(urls).toStrictEqual(['https://repo1', 'https://repo2']);

      urls = mergeReposAndMirrors(
        [
          {
            id: 'expect-mirror',
            mirrorOf: '*,!repo2',
            url: 'https://except-mirror',
          },
        ],
        [
          { id: 'repo1', url: 'https://repo1' },
          { id: 'repo2', url: 'https://repo2' },
        ]
      );
      expect(urls).toStrictEqual(['https://except-mirror', 'https://repo2']);

      urls = mergeReposAndMirrors(
        [
          {
            id: 'direct-multiple-mirror',
            mirrorOf: 'repo1,repo2',
            url: 'https://direct-multiple',
          },
        ],
        [
          { id: 'repo1', url: 'https://repo1' },
          { id: 'repo2', url: 'https://repo2' },
        ]
      );
      expect(urls).toStrictEqual(['https://direct-multiple']);
    });
  });
});

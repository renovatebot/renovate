import { codeBlock } from 'common-tags';
import {
  extractAllPackageFiles,
  extractExtensions,
  extractPackage,
  extractRegistries,
  resolveParents,
} from './extract';
import { Fixtures } from '~test/fixtures';
import { fs, logger } from '~test/util';

vi.mock('../../../util/fs');

const simpleContent = Fixtures.get('simple.pom.xml');
const mirrorSettingsContent = Fixtures.get('mirror.settings.xml');
const parentPomContent = Fixtures.get('parent.pom.xml');
const childPomContent = Fixtures.get('child.pom.xml');
const profileSettingsContent = Fixtures.get('profile.settings.xml');

describe('modules/manager/maven/extract', () => {
  describe('extractPackage', () => {
    it('returns null for invalid XML', () => {
      expect(extractPackage('', 'some-file', {})).toBeNull();
      expect(extractPackage('invalid xml content', 'some-file', {})).toBeNull();
      expect(extractPackage('<foobar></foobar>', 'some-file', {})).toBeNull();
      expect(extractPackage('<project></project>', 'some-file', {})).toBeNull();
    });

    it('extract dependencies from any XML position', () => {
      const res = extractPackage(simpleContent, 'some-file', {});
      expect(res).toMatchObject({
        datasource: 'maven',
        deps: [
          {
            datasource: 'maven',
            depName: 'org.example:parent',
            currentValue: '42',
            depType: 'parent',
            fileReplacePosition: 186,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:foo',
            currentValue: '0.0.1',
            depType: 'compile',
            fileReplacePosition: 905,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:bar',
            currentValue: '1.0.0',
            depType: 'compile',
            fileReplacePosition: 1093,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.apache.maven.plugins:maven-release-plugin',
            currentValue: '2.4.2',
            depType: 'build',
            fileReplacePosition: 1347,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.apache.maven.scm:maven-scm-provider-gitexe',
            currentValue: '1.8.1',
            depType: 'build',
            fileReplacePosition: 1545,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:extension-artefact',
            currentValue: '1.0',
            depType: 'build',
            fileReplacePosition: 2276,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:${artifact-id-placeholder}',
            currentValue: '0.0.1',
            depType: 'compile',
            fileReplacePosition: 2484,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: '${group-id-placeholder}:baz',
            currentValue: '0.0.1',
            depType: 'compile',
            fileReplacePosition: 2634,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: '${quuxGroup}:${quuxId}',
            currentValue: '${quuxVersion}',
            depType: 'compile',
            fileReplacePosition: 2779,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: '${quuxGroup}:${quuxId}-test',
            currentValue: '${quuxVersion}',
            depType: 'compile',
            fileReplacePosition: 2938,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:quuz',
            currentValue: '1.2.3',
            depType: 'test',
            fileReplacePosition: 3086,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:quuuz',
            currentValue: "it's not a version",
            depType: 'compile',
            fileReplacePosition: 3252,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:hard-range',
            currentValue: '[1.0.0]',
            depType: 'compile',
            fileReplacePosition: 3410,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:optional',
            currentValue: '1.0.0',
            depType: 'optional',
            fileReplacePosition: 3555,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:relocation-artifact',
            currentValue: '1.0',
            fileReplacePosition: 3787,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:profile-artifact',
            currentValue: '${profile-placeholder}',
            depType: 'compile',
            fileReplacePosition: 4119,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.example:profile-build-artefact',
            currentValue: '2.17',
            depType: 'build',
            fileReplacePosition: 4375,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
          {
            datasource: 'maven',
            depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
            currentValue: '2.17',
            depType: 'build',
            fileReplacePosition: 4769,
            registryUrls: [
              'https://maven.atlassian.com/content/repositories/atlassian-public/',
            ],
          },
        ],
        mavenProps: {
          quuxGroup: {
            fileReplacePosition: 631,
            packageFile: 'some-file',
            val: 'org.example',
          },
          quuxId: {
            fileReplacePosition: 667,
            packageFile: 'some-file',
            val: 'quux',
          },
          quuxVersion: {
            fileReplacePosition: 698,
            packageFile: 'some-file',
            val: '1.2.3.4',
          },
        },
        packageFile: 'some-file',
        packageFileVersion: '0.0.1',
        parent: '../pom.xml',
      });
    });

    it('extract dependencies with windows line endings', () => {
      extractPackage(
        '<?xml version="1.0" encoding="UTF-8"?> \r\n',
        'some-file',
        {},
      );
      expect(logger.logger.warn).toHaveBeenCalledWith(
        'Your pom.xml contains windows line endings. This is not supported and may result in parsing issues.',
      );
    });

    it('tries minimum manifests', () => {
      const res = extractPackage(
        Fixtures.get('minimum.pom.xml'),
        'some-file',
        {},
      );
      expect(res).toEqual({
        datasource: 'maven',
        deps: [],
        mavenProps: {},
        packageFile: 'some-file',
        packageFileVersion: '1',
      });
    });

    it('tries minimum snapshot manifests', () => {
      const res = extractPackage(
        Fixtures.get(`minimum_snapshot.pom.xml`),
        'some-file',
        {},
      );
      expect(res).toEqual({
        datasource: 'maven',
        deps: [],
        mavenProps: {},
        packageFile: 'some-file',
        packageFileVersion: '0.0.1-SNAPSHOT',
      });
    });

    it('extracts builder and buildpack images from spring-boot plugin', () => {
      const res = extractPackage(
        Fixtures.get('full_cnb.pom.xml'),
        'full_cnb.pom.xml',
        {},
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '3.2.2',
          datasource: 'maven',
          depName: 'org.springframework.boot:spring-boot-starter-parent',
          depType: 'parent',
          fileReplacePosition: 404,
          registryUrls: [],
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '0.4.316',
          datasource: 'docker',
          depName: 'paketobuildpacks/builder-jammy-base',
          packageName: 'paketobuildpacks/builder-jammy-base',
          replaceString: 'paketobuildpacks/builder-jammy-base:0.4.316',
          fileReplacePosition: 1273,
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '0.0.28',
          datasource: 'docker',
          depName: 'paketobuildpacks/run-noble-full',
          packageName: 'paketobuildpacks/run-noble-full',
          replaceString: 'paketobuildpacks/run-noble-full:0.0.28',
          fileReplacePosition: 1343,
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '6.1.1',
          datasource: 'buildpacks-registry',
          packageName: 'paketo-buildpacks/nodejs',
          fileReplacePosition: 1430,
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '1.8.0',
          datasource: 'docker',
          depName: 'gcr.io/paketo-buildpacks/nodejs',
          fileReplacePosition: 1566,
          packageName: 'gcr.io/paketo-buildpacks/nodejs',
          replaceString: 'gcr.io/paketo-buildpacks/nodejs:1.8.0',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:2c27cd0b4482a4aa5aeb38104f6d934511cd87c1af34a10d1d6cdf2d9d16f138',
          currentValue: '2.22.1',
          datasource: 'docker',
          depName: 'docker.io/paketobuildpacks/python',
          fileReplacePosition: 1634,
          packageName: 'docker.io/paketobuildpacks/python',
          replaceString:
            'docker.io/paketobuildpacks/python:2.22.1@sha256:2c27cd0b4482a4aa5aeb38104f6d934511cd87c1af34a10d1d6cdf2d9d16f138',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentDigest:
            'sha256:080f4cfa5c8fe43837b2b83f69ae16e320ea67c051173e4934a015590b2ca67a',
          datasource: 'docker',
          depName: 'docker.io/paketobuildpacks/ruby',
          fileReplacePosition: 1795,
          packageName: 'docker.io/paketobuildpacks/ruby',
          replaceString:
            'docker.io/paketobuildpacks/ruby@sha256:080f4cfa5c8fe43837b2b83f69ae16e320ea67c051173e4934a015590b2ca67a',
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '12.1.0',
          datasource: 'docker',
          depName: 'paketobuildpacks/java',
          packageName: 'paketobuildpacks/java',
          replaceString: 'paketobuildpacks/java:12.1.0',
          fileReplacePosition: 2001,
        },
      ]);
    });

    it('extracts only builder if defaults are used in spring-boot plugin', () => {
      const res = extractPackage(
        Fixtures.get('basic_cnb.pom.xml'),
        'basic_cnb.pom.xml',
        {},
      );
      expect(res?.deps).toEqual([
        {
          currentValue: '3.2.2',
          datasource: 'maven',
          depName: 'org.springframework.boot:spring-boot-starter-parent',
          depType: 'parent',
          fileReplacePosition: 404,
          registryUrls: [],
        },
        {
          autoReplaceStringTemplate:
            '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}',
          currentValue: '0.4.316',
          datasource: 'docker',
          depName: 'paketobuildpacks/builder-jammy-base',
          packageName: 'paketobuildpacks/builder-jammy-base',
          replaceString: 'paketobuildpacks/builder-jammy-base:0.4.316',
          fileReplacePosition: 1273,
        },
      ]);
    });

    it('returns no buildpack dependencies when image tag is missing in spring boot plugin configuration', () => {
      const res = extractPackage(
        Fixtures.get('empty_cnb.pom.xml'),
        'empty_cnb.pom.xml',
        {},
      );
      expect(res?.deps).toEqual([]);
    });

    it('returns no buildpack dependencies when dependencies are invalid in spring boot plugin', () => {
      const res = extractPackage(
        Fixtures.get('invalid_cnb.pom.xml'),
        'invalid_cnb.pom.xml',
        {},
      );
      expect(res?.deps).toEqual([]);
    });
  });

  describe('resolveParents', () => {
    it('should apply props recursively', () => {
      const packages = extractPackage(
        Fixtures.get('recursive_props.pom.xml'),
        'some-file',
        {},
      );
      const [{ deps }] = resolveParents([packages!]);
      expect(deps).toMatchObject([
        {
          depName: 'com.sksamuel.scapegoat:scalac-scapegoat-plugin_2.13.7',
          currentValue: '1.4.11',
        },
      ]);
    });

    it('should apply props multiple times', () => {
      const packages = extractPackage(
        Fixtures.get('multiple_usages_props.pom.xml'),
        'some-file',
        {},
      );
      const [{ deps }] = resolveParents([packages!]);
      expect(deps).toMatchObject([
        {
          depName: 'org.apache.lucene:lucene-core-1.2.3.1.2.3',
          currentValue: '1.2.3',
        },
      ]);
    });

    it('should detect props infinitely recursing props', () => {
      const packages = extractPackage(
        Fixtures.get('infinite_recursive_props.pom.xml'),
        'some-file',
        {},
      );
      const [{ deps }] = resolveParents([packages!]);
      expect(deps).toMatchObject([
        {
          depName: 'org.apache.lucene:lucene-core',
          currentValue: '${foo}',
          skipReason: 'recursive-placeholder',
        },
        {
          depName: 'org.apache.lucene:lucene-core-${var1}',
          currentValue: '1.2',
          skipReason: 'recursive-placeholder',
        },
      ]);
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
      const res = extractRegistries(Fixtures.get('complex.settings.xml'));
      expect(res).toStrictEqual([
        'https://artifactory.company.com/artifactory/my-maven-repo',
        'https://repo.adobe.com/nexus/content/groups/public',
        'https://repo.adobe.com/v2/nexus/content/groups/public',
        'https://repo.adobe.com/v3/nexus/content/groups/public',
        'https://repo.adobe.com/v4/nexus/content/groups/public',
      ]);
    });

    it('extract registries from a settings file that uses a newer schema', () => {
      const settingsUpdatedContent = codeBlock`
        <settings xmlns="http://maven.apache.org/SETTINGS/1.2.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.2.0 http://maven.apache.org/xsd/settings-1.2.0.xsd">
          <mirrors>
                <mirror>
                    <id>Test-Internal-repository</id>
                    <name>Proxy Repository Manager</name>
                    <url>https://proxy-repo.com/artifactory/apache-maven</url>
                    <mirrorOf>central</mirrorOf>
                </mirror>
            </mirrors>
          <profiles/>
          <activeProfiles/>
        </settings>
      `;
      const res = extractRegistries(settingsUpdatedContent);
      expect(res).toStrictEqual([
        'https://proxy-repo.com/artifactory/apache-maven',
      ]);
    });
  });

  describe('extractExtensions', () => {
    it('returns null for invalid xml files', () => {
      expect(extractExtensions('', '.mvn/extensions.xml')).toBeNull();
      expect(
        extractExtensions('invalid xml content', '.mvn/extensions.xml'),
      ).toBeNull();
      expect(
        extractExtensions('<foobar></foobar>', '.mvn/extensions.xml'),
      ).toBeNull();
      expect(
        extractExtensions('<extensions></extensions>', '.mvn/extensions.xml'),
      ).toBeNull();
      expect(
        extractExtensions(
          '<extensions xmlns="http://maven.apache.org/EXTENSIONS/1.0.0"></extensions>',
          '.mvn/extensions.xml',
        ),
      ).toBeNull();
    });
  });

  describe('extractAllPackageFiles', () => {
    it('should return empty if package has no content', async () => {
      fs.readLocalFile.mockResolvedValueOnce('');
      const res = await extractAllPackageFiles({}, ['random.pom.xml']);
      expect(res).toBeEmptyArray();
    });

    it('should return empty for packages with invalid content', async () => {
      fs.readLocalFile.mockResolvedValueOnce('invalid content');
      const res = await extractAllPackageFiles({}, ['random.pom.xml']);
      expect(res).toBeEmptyArray();
    });

    it('should return packages with urls from a settings file', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(mirrorSettingsContent)
        .mockResolvedValueOnce(simpleContent);
      const res = await extractAllPackageFiles({}, [
        'mirror.settings.xml',
        'simple.pom.xml',
      ]);

      const urls = [
        'https://artifactory.company.com/artifactory/my-maven-repo',
        'https://maven.atlassian.com/content/repositories/atlassian-public/',
        'https://repo.maven.apache.org/maven2',
      ];
      for (const packageFile of res) {
        for (const dep of packageFile.deps) {
          expect(dep.registryUrls).toStrictEqual(urls);
        }
      }
    });

    it('should include registryUrls from parent pom files', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(parentPomContent)
        .mockResolvedValueOnce(childPomContent);
      const res = await extractAllPackageFiles({}, [
        'parent.pom.xml',
        'child.pom.xml',
      ]);

      const unorderedUrls = new Set([
        'https://repo.maven.apache.org/maven2',
        'http://example.com/',
        'http://example.com/nexus/xyz',
      ]);
      for (const packageFile of res) {
        for (const dep of packageFile.deps) {
          const depUrls = new Set([...dep.registryUrls!]);
          expect(depUrls).toStrictEqual(unorderedUrls);
        }
      }
      expect(res).toMatchObject([
        {
          datasource: 'maven',
          deps: [
            {
              currentValue: '42',
              datasource: 'maven',
              depName: 'org.example:child',
              depType: 'parent',
              fileReplacePosition: 185,
              registryUrls: [
                'http://example.com/nexus/xyz',
                'http://example.com/',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '1.2.3.4',
              datasource: 'maven',
              depName: 'org.example:quux',
              depType: 'compile',
              editFile: 'parent.pom.xml',
              fileReplacePosition: 470,
              sharedVariableName: 'quuxVersion',
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
          ],
          packageFile: 'parent.pom.xml',
        },
        {
          datasource: 'maven',
          deps: [
            {
              currentValue: '42',
              datasource: 'maven',
              depName: 'org.example:parent',
              depType: 'parent',
              fileReplacePosition: 186,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '0.0.1',
              datasource: 'maven',
              depName: 'org.example:foo',
              depType: 'compile',
              fileReplacePosition: 806,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '1.0.0',
              datasource: 'maven',
              depName: 'org.example:bar',
              depType: 'compile',
              fileReplacePosition: 954,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '2.4.2',
              datasource: 'maven',
              depName: 'org.apache.maven.plugins:maven-release-plugin',
              depType: 'build',
              fileReplacePosition: 1188,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '1.8.1',
              datasource: 'maven',
              depName: 'org.apache.maven.scm:maven-scm-provider-gitexe',
              depType: 'build',
              fileReplacePosition: 1386,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '0.0.1',
              datasource: 'maven',
              depName: 'org.example:${artifact-id-placeholder}',
              depType: 'compile',
              fileReplacePosition: 2131,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
              skipReason: 'name-placeholder',
            },
            {
              currentValue: '0.0.1',
              datasource: 'maven',
              depName: '${group-id-placeholder}:baz',
              depType: 'compile',
              fileReplacePosition: 2281,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
              skipReason: 'name-placeholder',
            },
            {
              currentValue: '1.2.3',
              datasource: 'maven',
              depName: 'org.example:quuz',
              depType: 'compile',
              fileReplacePosition: 2574,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: "it's not a version",
              datasource: 'maven',
              depName: 'org.example:quuuz',
              depType: 'compile',
              fileReplacePosition: 2714,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '[1.0.0]',
              datasource: 'maven',
              depName: 'org.example:hard-range',
              depType: 'compile',
              fileReplacePosition: 2872,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
            {
              currentValue: '${profile-placeholder}',
              datasource: 'maven',
              depName: 'org.example:profile-artifact',
              depType: 'compile',
              fileReplacePosition: 3134,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
              skipReason: 'version-placeholder',
            },
            {
              currentValue: '2.17',
              datasource: 'maven',
              depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
              depType: 'build',
              fileReplacePosition: 3410,
              registryUrls: [
                'http://example.com/',
                'http://example.com/nexus/xyz',
                'https://repo.maven.apache.org/maven2',
              ],
            },
          ],
          packageFile: 'child.pom.xml',
          packageFileVersion: '0.0.1',
        },
      ]);
    });

    it('should include registryUrls in the correct order', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce(simpleContent)
        .mockResolvedValueOnce(profileSettingsContent);
      const res = await extractAllPackageFiles({}, [
        'simple.pom.xml',
        'profile.settings.xml',
      ]);

      const urls = [
        'https://repo.adobe.com/nexus/content/groups/public',
        'https://maven.atlassian.com/content/repositories/atlassian-public/',
        'https://repo.maven.apache.org/maven2',
      ];
      for (const packageFile of res) {
        for (const dep of packageFile.deps) {
          expect(dep.registryUrls).toStrictEqual(urls);
        }
      }
    });

    it('should return package files info', async () => {
      fs.readLocalFile.mockResolvedValueOnce(simpleContent);
      const res = await extractAllPackageFiles({}, ['random.pom.xml']);

      expect(res).toMatchObject([
        {
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
              depName: 'org.example:extension-artefact',
              currentValue: '1.0',
            },
            {
              depName: 'org.example:${artifact-id-placeholder}',
              skipReason: 'name-placeholder',
            },
            {
              depName: '${group-id-placeholder}:baz',
              skipReason: 'name-placeholder',
            },
            {
              depName: 'org.example:quux',
              currentValue: '1.2.3.4',
              sharedVariableName: 'quuxVersion',
            },
            {
              depName: 'org.example:quux-test',
              currentValue: '1.2.3.4',
              sharedVariableName: 'quuxVersion',
            },
            {
              depName: 'org.example:quuz',
              currentValue: '1.2.3',
            },
            {
              depName: 'org.example:quuuz',
              currentValue: "it's not a version",
            },
            { depName: 'org.example:hard-range', currentValue: '[1.0.0]' },
            {
              depName: 'org.example:optional',
              currentValue: '1.0.0',
            },
            {
              depName: 'org.example:relocation-artifact',
              currentValue: '1.0',
            },
            {
              depName: 'org.example:profile-artifact',
              currentValue: '${profile-placeholder}',
              skipReason: 'version-placeholder',
            },
            {
              depName: 'org.example:profile-build-artefact',
              currentValue: '2.17',
            },
            {
              depName: 'org.apache.maven.plugins:maven-checkstyle-plugin',
              currentValue: '2.17',
            },
          ],
          packageFile: 'random.pom.xml',
        },
      ]);
    });

    it('should extract from .mvn/extensions.xml file', async () => {
      fs.readLocalFile.mockResolvedValueOnce(codeBlock`
      <extensions xmlns="http://maven.apache.org/EXTENSIONS/1.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/EXTENSIONS/1.0.0 http://maven.apache.org/xsd/core-extensions-1.0.0.xsd">
        <extension>
          <groupId>io.jenkins.tools.incrementals</groupId>
          <artifactId>git-changelist-maven-extension</artifactId>
          <version>1.6</version>
        </extension>
      </extensions>
    `);
      const res = await extractAllPackageFiles({}, ['.mvn/extensions.xml']);
      expect(res).toMatchObject([
        {
          packageFile: '.mvn/extensions.xml',
          deps: [
            {
              datasource: 'maven',
              depName:
                'io.jenkins.tools.incrementals:git-changelist-maven-extension',
              currentValue: '1.6',
              depType: 'build',
              fileReplacePosition: 372,
              registryUrls: ['https://repo.maven.apache.org/maven2'],
            },
          ],
        },
      ]);
    });

    it('should return empty array if extensions file is invalid or empty', async () => {
      fs.readLocalFile
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('invalid xml content');
      expect(
        await extractAllPackageFiles({}, [
          '.mvn/extensions.xml',
          'grp/.mvn/extensions.xml',
        ]),
      ).toBeEmptyArray();
    });

    describe('root pom handling', () => {
      it('should skip root pom.xml', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          <project>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>root</artifactId>
            <version>1.0.0</version>
          </project>
        `);
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          <project>
            <parent>
              <groupId>org.example</groupId>
              <artifactId>root</artifactId>
              <version>1.0.0</version>
            </parent>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>child</artifactId>
          </project>
        `);
        const res = await extractAllPackageFiles({}, [
          'pom.xml',
          'foo.bar/pom.xml',
        ]);
        expect(res).toMatchObject([
          { packageFile: 'pom.xml', deps: [] },
          {
            packageFile: 'foo.bar/pom.xml',
            deps: [{ depName: 'org.example:root', depType: 'parent-root' }],
          },
        ]);
      });

      it('should skip root pom.xml when it has an external parent', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          <project>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>root</artifactId>
            <version>1.0.0</version>
            <parent>
              <groupId>org.acme</groupId>
              <artifactId>external-parent</artifactId>
              <version>1.0.0</version>
            </parent>
          </project>
        `);
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          <project>
            <parent>
              <groupId>org.example</groupId>
              <artifactId>root</artifactId>
              <version>1.0.0</version>
            </parent>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>child</artifactId>
          </project>
        `);
        const res = await extractAllPackageFiles({}, [
          'pom.xml',
          'foo.bar/pom.xml',
        ]);
        expect(res).toMatchObject([
          {
            packageFile: 'pom.xml',
            deps: [{ depName: 'org.acme:external-parent', depType: 'parent' }],
          },
          {
            packageFile: 'foo.bar/pom.xml',
            deps: [{ depName: 'org.example:root', depType: 'parent-root' }],
          },
        ]);
      });

      it('handles cross-referencing', async () => {
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          <project>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>foo</artifactId>
            <version>1.0.0</version>
            <dependencies>
              <dependency>
                <groupId>org.example</groupId>
                <artifactId>bar</artifactId>
                <version>1.0.0</version>
              </dependency>
            </dependencies>
          </project>
        `);
        fs.readLocalFile.mockResolvedValueOnce(codeBlock`
          <project>
            <modelVersion>4.0.0</modelVersion>
            <groupId>org.example</groupId>
            <artifactId>bar</artifactId>
            <version>1.0.0</version>
            <dependencies>
              <dependency>
                <groupId>org.example</groupId>
                <artifactId>foo</artifactId>
                <version>1.0.0</version>
              </dependency>
            </dependencies>
          </project>
        `);
        const res = await extractAllPackageFiles({}, ['foo.xml', 'bar.xml']);
        expect(res).toMatchObject([
          { packageFile: 'foo.xml', deps: [{ depName: 'org.example:bar' }] },
          { packageFile: 'bar.xml', deps: [{ depName: 'org.example:foo' }] },
        ]);
        const [foo, bar] = res;
        expect(foo.deps[0].skipReason).toBeUndefined();
        expect(bar.deps[0].skipReason).toBeUndefined();
      });
    });
  });
});

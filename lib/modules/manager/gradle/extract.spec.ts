import { stripIndent } from 'common-tags';
import { Fixtures } from '../../../../test/fixtures';
import { fs, logger } from '../../../../test/util';
import type { ExtractConfig } from '../types';
import {
  parseLockFile,
  parsePropsFile,
  usesGcv,
} from './extract/consistent-versions-plugin';
import * as parser from './parser';
import { extractAllPackageFiles } from '.';

jest.mock('../../../util/fs');

function mockFs(files: Record<string, string>): void {
  // TODO: fix types, jest is using wrong overload (#7154)
  fs.getFileContentMap.mockImplementation(
    (fileNames: string[]): Promise<any> => {
      const fileContentMap: Record<string, string | null> = {};
      for (const fileName of fileNames) {
        fileContentMap[fileName] = files?.[fileName];
      }

      return Promise.resolve(fileContentMap);
    }
  );

  fs.getSiblingFileName.mockImplementation(
    (existingFileNameWithPath: string, otherFileName: string) => {
      return existingFileNameWithPath
        .slice(0, existingFileNameWithPath.lastIndexOf('/') + 1)
        .concat(otherFileName);
    }
  );
}

describe('modules/manager/gradle/extract', () => {
  afterAll(() => {
    jest.resetAllMocks();
  });

  it('returns null', async () => {
    mockFs({
      'gradle.properties': '',
      'build.gradle': '',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'gradle.properties',
    ]);

    expect(res).toBeNull();
  });

  it('logs a warning in case parseGradle throws an exception', async () => {
    const filename = 'build.gradle';
    const err = new Error('unknown');

    jest.spyOn(parser, 'parseGradle').mockImplementationOnce(() => {
      throw err;
    });
    await extractAllPackageFiles({} as ExtractConfig, [filename]);

    expect(logger.logger.warn).toHaveBeenCalledWith(
      { err, config: {}, packageFile: filename },
      `Failed to process Gradle file`
    );
  });

  it('extracts from cross-referenced files', async () => {
    mockFs({
      'gradle.properties': 'baz=1.2.3',
      'build.gradle': 'url "https://example.com"; "foo:bar:$baz"',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'gradle.properties',
    ]);

    expect(res).toMatchObject([
      {
        packageFile: 'gradle.properties',
        deps: [{ depName: 'foo:bar', currentValue: '1.2.3' }],
      },
      { packageFile: 'build.gradle', deps: [] },
    ]);
  });

  it('skips versions composed from multiple variables', async () => {
    mockFs({
      'build.gradle':
        'foo = "1"; bar = "2"; baz = "3"; "foo:bar:$foo.$bar.$baz"',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
    ]);

    expect(res).toMatchObject([
      {
        packageFile: 'build.gradle',
        deps: [
          {
            depName: 'foo:bar',
            currentValue: '1.2.3',
            registryUrls: [],
            skipReason: 'contains-variable',
            managerData: {
              packageFile: 'build.gradle',
            },
          },
        ],
      },
    ]);
  });

  it('works with file-ext-var', async () => {
    mockFs({
      'gradle.properties': 'baz=1.2.3',
      'build.gradle':
        'repositories { maven { url "https://example.com" } }; "foo:bar:$baz@zip"',
      'settings.gradle': null as never, // TODO: #7154
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'gradle.properties',
      'settings.gradle',
    ]);

    expect(res).toMatchObject([
      {
        packageFile: 'gradle.properties',
        deps: [
          {
            depName: 'foo:bar',
            currentValue: '1.2.3',
            registryUrls: ['https://example.com'],
          },
        ],
      },
      {
        datasource: 'maven',
        deps: [],
        packageFile: 'settings.gradle',
      },
      { packageFile: 'build.gradle', deps: [] },
    ]);
  });

  it('inherits gradle variables', async () => {
    const fsMock = {
      'gradle.properties': 'foo=1.0.0',
      'build.gradle': 'foo = "1.0.1"',
      'aaa/gradle.properties': 'bar = "2.0.0"',
      'aaa/build.gradle': 'bar = "2.0.1"',
      'aaa/bbb/build.gradle': ['foo:foo:$foo', 'bar:bar:$bar']
        .map((x) => `"${x}"`)
        .join('\n'),
    };

    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );

    expect(res).toMatchObject([
      { packageFile: 'gradle.properties', deps: [] },
      {
        packageFile: 'build.gradle',
        deps: [{ depName: 'foo:foo', currentValue: '1.0.1' }],
      },
      { packageFile: 'aaa/gradle.properties', deps: [] },
      {
        packageFile: 'aaa/build.gradle',
        deps: [{ depName: 'bar:bar', currentValue: '2.0.1' }],
      },
      { packageFile: 'aaa/bbb/build.gradle', deps: [] },
    ]);
  });

  it('deduplicates registry urls', async () => {
    const fsMock = {
      'build.gradle': [
        'repositories { maven { url "https://repo.maven.apache.org/maven2" } }',
        'repositories { maven { url "https://repo.maven.apache.org/maven2" } }',
        'repositories { maven { url "https://example.com" } }',
        'repositories { maven { url "https://example.com" } }',
        'id "foo.bar" version "1.2.3"',
        '"foo:bar:1.2.3"',
      ].join(';\n'),
    };

    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );

    expect(res).toMatchObject([
      {
        packageFile: 'build.gradle',
        deps: [
          {
            depType: 'plugin',
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://example.com',
              'https://plugins.gradle.org/m2/',
            ],
          },
          {
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://example.com',
            ],
          },
        ],
      },
    ]);
  });

  it('interpolates repository URLs', async () => {
    const buildFile = `
      repositories {
          mavenCentral()
          maven {
              url = "\${repositoryBaseURL}/repository-build"
          }
          maven {
              name = "baz"
              url = "\${repositoryBaseURL}/\${name}"
          }
      }

      dependencies {
          implementation "com.google.protobuf:protobuf-java:2.17.0"
      }
    `;

    mockFs({
      'build.gradle': buildFile,
      'gradle.properties': 'repositoryBaseURL: https\\://dummy.org/whatever',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'gradle.properties',
    ]);

    expect(res).toMatchObject([
      {
        packageFile: 'gradle.properties',
        datasource: 'maven',
        deps: [],
      },
      {
        packageFile: 'build.gradle',
        datasource: 'maven',
        deps: [
          {
            depName: 'com.google.protobuf:protobuf-java',
            currentValue: '2.17.0',
            managerData: {
              fileReplacePosition: 335,
              packageFile: 'build.gradle',
            },
            fileReplacePosition: 335,
            registryUrls: [
              'https://repo.maven.apache.org/maven2',
              'https://dummy.org/whatever/repository-build',
              'https://dummy.org/whatever/baz',
            ],
          },
        ],
      },
    ]);
  });

  it('works with dependency catalogs', async () => {
    const tomlFile = Fixtures.get('1/libs.versions.toml');
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toMatchObject([
      {
        packageFile: 'gradle/libs.versions.toml',
        deps: [
          {
            depName: 'io.gitlab.arturbosch.detekt:detekt-formatting',
            groupName: 'detekt',
            currentValue: '1.17.0',
            managerData: {
              fileReplacePosition: 21,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'io.kotest:kotest-assertions-core-jvm',
            groupName: 'kotest',
            currentValue: '4.6.0',
            managerData: {
              fileReplacePosition: 51,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'io.kotest:kotest-runner-junit5',
            groupName: 'kotest',
            currentValue: '4.6.0',
            managerData: {
              fileReplacePosition: 51,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'org.mockito:mockito-core',
            groupName: 'org.mockito',
            currentValue: '3.10.0',
            managerData: {
              fileReplacePosition: 474,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'com.github.siom79.japicmp:japicmp',
            groupName: 'com.github.siom79.japicmp',
            currentValue: '0.15.+',
            managerData: {
              fileReplacePosition: 561,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'guava',
            skipReason: 'multiple-constraint-dep',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'gson',
            skipReason: 'unsupported-version',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'io.gitlab.arturbosch.detekt',
            depType: 'plugin',
            currentValue: '1.17.0',
            packageName:
              'io.gitlab.arturbosch.detekt:io.gitlab.arturbosch.detekt.gradle.plugin',
            managerData: {
              fileReplacePosition: 21,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: ['https://plugins.gradle.org/m2/'],
          },
          {
            depName: 'org.danilopianini.publish-on-central',
            depType: 'plugin',
            currentValue: '0.5.0',
            packageName:
              'org.danilopianini.publish-on-central:org.danilopianini.publish-on-central.gradle.plugin',
            managerData: {
              fileReplacePosition: 82,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: ['https://plugins.gradle.org/m2/'],
          },
          {
            depName: 'org.ajoberstar.grgit',
            depType: 'plugin',
            commitMessageTopic: 'plugin grgit',
            packageName:
              'org.ajoberstar.grgit:org.ajoberstar.grgit.gradle.plugin',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: ['https://plugins.gradle.org/m2/'],
            skipReason: 'unknown-version',
          },
        ],
      },
    ]);
  });

  it("can run Javier's example", async () => {
    const tomlFile = Fixtures.get('2/libs.versions.toml');
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toMatchObject([
      {
        packageFile: 'gradle/libs.versions.toml',
        deps: [
          {
            depName: 'com.squareup.okhttp3:okhttp',
            groupName: 'com.squareup.okhttp3',
            currentValue: '4.9.0',
            managerData: {
              fileReplacePosition: 99,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'com.squareup.okio:okio',
            groupName: 'com.squareup.okio',
            currentValue: '2.8.0',
            managerData: {
              fileReplacePosition: 161,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'com.squareup.picasso:picasso',
            groupName: 'com.squareup.picasso',
            currentValue: '2.5.1',
            managerData: {
              fileReplacePosition: 243,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'com.squareup.retrofit2:retrofit',
            groupName: 'retrofit',
            currentValue: '2.8.2',
            managerData: {
              fileReplacePosition: 41,
              packageFile: 'gradle/libs.versions.toml',
            },
          },
          {
            depName: 'google-firebase-analytics',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
            skipReason: 'no-version',
          },
          {
            depName: 'google-firebase-crashlytics',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
            skipReason: 'no-version',
          },
          {
            depName: 'google-firebase-messaging',
            managerData: {
              packageFile: 'gradle/libs.versions.toml',
            },
            skipReason: 'no-version',
          },
          {
            depName: 'org.jetbrains.kotlin.jvm',
            depType: 'plugin',
            currentValue: '1.5.21',
            commitMessageTopic: 'plugin kotlinJvm',
            packageName:
              'org.jetbrains.kotlin.jvm:org.jetbrains.kotlin.jvm.gradle.plugin',
            managerData: {
              fileReplacePosition: 661,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: ['https://plugins.gradle.org/m2/'],
          },
          {
            depName: 'org.jetbrains.kotlin.plugin.serialization',
            depType: 'plugin',
            currentValue: '1.5.21',
            packageName:
              'org.jetbrains.kotlin.plugin.serialization:org.jetbrains.kotlin.plugin.serialization.gradle.plugin',
            managerData: {
              fileReplacePosition: 21,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: ['https://plugins.gradle.org/m2/'],
          },
          {
            depName: 'org.danilopianini.multi-jvm-test-plugin',
            depType: 'plugin',
            currentValue: '0.3.0',
            commitMessageTopic: 'plugin multiJvm',
            packageName:
              'org.danilopianini.multi-jvm-test-plugin:org.danilopianini.multi-jvm-test-plugin.gradle.plugin',
            managerData: {
              fileReplacePosition: 822,
              packageFile: 'gradle/libs.versions.toml',
            },
            registryUrls: ['https://plugins.gradle.org/m2/'],
          },
        ],
      },
    ]);
  });

  it('ignores an empty TOML', async () => {
    const tomlFile = '';
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toBeNull();
  });

  it('deletes commit message for plugins with version reference', async () => {
    const tomlFile = `
    [versions]
    detekt = "1.18.1"

    [plugins]
    detekt = { id = "io.gitlab.arturbosch.detekt", version.ref = "detekt" }

    [libraries]
    detekt-formatting = { module = "io.gitlab.arturbosch.detekt:detekt-formatting", version.ref = "detekt" }
    `;
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toMatchObject([
      {
        packageFile: 'gradle/libs.versions.toml',
        deps: [
          {
            depName: 'io.gitlab.arturbosch.detekt:detekt-formatting',
            groupName: 'detekt',
            currentValue: '1.18.1',
            managerData: {
              fileReplacePosition: 30,
              packageFile: 'gradle/libs.versions.toml',
            },
            fileReplacePosition: 30,
            registryUrls: [],
          },
          {
            depType: 'plugin',
            depName: 'io.gitlab.arturbosch.detekt',
            packageName:
              'io.gitlab.arturbosch.detekt:io.gitlab.arturbosch.detekt.gradle.plugin',
            registryUrls: ['https://plugins.gradle.org/m2/'],
            currentValue: '1.18.1',
            managerData: {
              fileReplacePosition: 30,
              packageFile: 'gradle/libs.versions.toml',
            },
            groupName: 'detekt',
            fileReplacePosition: 30,
          },
        ],
      },
    ]);
  });

  it('should change the dependency version not the comment version', async () => {
    const tomlFile = Fixtures.get('3/libs.versions.toml');
    const fsMock = {
      'gradle/libs.versions.toml': tomlFile,
    };
    mockFs(fsMock);
    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toMatchObject([
      {
        packageFile: 'gradle/libs.versions.toml',
        datasource: 'maven',
        deps: [
          {
            depName: 'junit:junit',
            groupName: 'junit',
            currentValue: '1.4.9',
            managerData: {
              fileReplacePosition: 124,
              packageFile: 'gradle/libs.versions.toml',
            },
            fileReplacePosition: 124,
            registryUrls: [],
          },
          {
            depName: 'mocha-junit:mocha-junit',
            groupName: 'mocha-junit-reporter',
            currentValue: '2.0.2',
            managerData: {
              fileReplacePosition: 82,
              packageFile: 'gradle/libs.versions.toml',
            },
            fileReplacePosition: 82,
            registryUrls: [],
          },
        ],
      },
    ]);
  });

  it('loads further scripts using apply from statements', async () => {
    const buildFile = `
      buildscript {
          repositories {
              mavenCentral()
          }

          apply from: "\${someDir}/libs1.gradle"
          apply from: file("gradle/libs2.gradle")
          apply from: "gradle/libs3.gradle"
          apply from: new File(someDir, "\${someDir}/libs4.gradle")
          apply from: file("gradle/non-existing.gradle")

          dependencies {
              classpath "com.google.protobuf:protobuf-java:\${protoBufVersion}"
              classpath "com.google.guava:guava:\${guavaVersion}"
              classpath "io.jsonwebtoken:jjwt-api:0.11.2"

              classpath "org.junit.jupiter:junit-jupiter-api:\${junitVersion}"
              classpath "org.junit.jupiter:junit-jupiter-engine:\${junitVersion}"
              classpath "org.slf4j:slf4j-api:\${slf4jVersion}"
          }
      }
    `;

    mockFs({
      'gradleX/libs1.gradle': "ext.junitVersion = '5.5.2'",
      'gradle/libs2.gradle': "ext.protoBufVersion = '3.18.2'",
      'gradle/libs3.gradle': "ext.guavaVersion = '30.1-jre'",
      'gradleX/gradleX/libs4.gradle': "ext.slf4jVersion = '1.7.30'",
      'build.gradle': buildFile,
      'gradle.properties': 'someDir=gradleX',
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'gradleX/libs1.gradle',
      'gradle/libs2.gradle',
      'gradle/libs3.gradle',
      'gradleX/gradleX/libs4.gradle',
      'build.gradle',
      'gradle.properties',
    ]);

    expect(res).toMatchObject([
      { packageFile: 'gradle.properties' },
      {
        packageFile: 'build.gradle',
        deps: [{ depName: 'io.jsonwebtoken:jjwt-api' }],
      },
      {
        packageFile: 'gradle/libs2.gradle',
        deps: [
          {
            depName: 'com.google.protobuf:protobuf-java',
            currentValue: '3.18.2',
            managerData: { packageFile: 'gradle/libs2.gradle' },
          },
        ],
      },
      {
        packageFile: 'gradle/libs3.gradle',
        deps: [
          {
            depName: 'com.google.guava:guava',
            currentValue: '30.1-jre',
            managerData: { packageFile: 'gradle/libs3.gradle' },
          },
        ],
      },
      {
        packageFile: 'gradleX/libs1.gradle',
        deps: [
          {
            depName: 'org.junit.jupiter:junit-jupiter-api',
            currentValue: '5.5.2',
            managerData: { packageFile: 'gradleX/libs1.gradle' },
          },
          {
            depName: 'org.junit.jupiter:junit-jupiter-engine',
            currentValue: '5.5.2',
            managerData: { packageFile: 'gradleX/libs1.gradle' },
          },
        ],
      },
      {
        packageFile: 'gradleX/gradleX/libs4.gradle',
        deps: [
          {
            depName: 'org.slf4j:slf4j-api',
            currentValue: '1.7.30',
            managerData: { packageFile: 'gradleX/gradleX/libs4.gradle' },
          },
        ],
      },
    ]);
  });

  it('apply from works with files in sub-directories', async () => {
    const buildFile = `
      buildscript {
          repositories {
              mavenCentral()
          }

          apply from: "gradle/libs4.gradle"

          dependencies {
              classpath "com.google.protobuf:protobuf-java:\${protoBufVersion}"
          }
      }
    `;

    mockFs({
      'somesubdir/gradle/libs4.gradle': "ext.protoBufVersion = '3.18.2'",
      'somesubdir/build.gradle': buildFile,
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'somesubdir/gradle/libs4.gradle',
      'somesubdir/build.gradle',
    ]);

    expect(res).toMatchObject([
      { packageFile: 'somesubdir/build.gradle' },
      {
        packageFile: 'somesubdir/gradle/libs4.gradle',
        deps: [{ depName: 'com.google.protobuf:protobuf-java' }],
      },
    ]);
  });

  it('prevents recursive apply from calls', async () => {
    mockFs({
      'build.gradle': "apply from: 'test.gradle'",
      'test.gradle': "apply from: 'build.gradle'",
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'test.gradle',
    ]);

    expect(res).toBeNull();
  });

  it('prevents inclusion of non-Gradle files', async () => {
    mockFs({
      'build.gradle': "apply from: '../../test.non-gradle'",
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
    ]);

    expect(res).toBeNull();
  });

  it('filters duplicate dependency findings', async () => {
    const buildFile = `
      apply from: 'test.gradle'

      repositories {
          mavenCentral()
      }

      dependencies {
        implementation "io.jsonwebtoken:jjwt-api:$\{jjwtVersion}"
        runtimeOnly "io.jsonwebtoken:jjwt-impl:$\{jjwtVersion}"
      }
    `;

    const testFile = `
      ext.jjwtVersion = '0.11.2'

      ext {
          jjwtApi = "io.jsonwebtoken:jjwt-api:$jjwtVersion"
      }
    `;

    mockFs({
      'build.gradle': buildFile,
      'test.gradle': testFile,
    });

    const res = await extractAllPackageFiles({} as ExtractConfig, [
      'build.gradle',
      'test.gradle',
    ]);

    expect(res).toMatchObject([
      {
        packageFile: 'test.gradle',
        deps: [
          { depName: 'io.jsonwebtoken:jjwt-api' },
          { depName: 'io.jsonwebtoken:jjwt-impl' },
        ],
      },
      { packageFile: 'build.gradle' },
    ]);
  });

  it('ensures depType is assigned', async () => {
    const fsMock = {
      'build.gradle':
        "id 'org.sonarqube' version '3.1.1'\n\"io.jsonwebtoken:jjwt-api:0.11.2\"",
      'buildSrc/build.gradle': '"com.google.protobuf:protobuf-java:3.18.2"',
    };

    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );

    expect(res).toMatchObject([
      {
        packageFile: 'build.gradle',
        deps: [
          { depName: 'org.sonarqube', depType: 'plugin' },
          { depName: 'io.jsonwebtoken:jjwt-api', depType: 'dependencies' },
        ],
      },
      {
        packageFile: 'buildSrc/build.gradle',
        deps: [{ depType: 'devDependencies' }],
      },
    ]);
  });

  // Tests for gradle-consistent-version plugin
  it('gradle-consistent-versions parse versions files', async () => {
    const fsMock = {
      'build.gradle': '(this file contains) com.palantir.consistent-versions',
      'versions.props': `org.apache.lucene:* = 1.2.3`,
      'versions.lock': stripIndent`
        # Run ./gradlew --write-locks to regenerate this file
        org.apache.lucene:lucene-core:1.2.3 (10 constraints: 95be0c15)
        org.apache.lucene:lucene-codecs:1.2.3 (5 constraints: 1231231)`,
    };

    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );

    expect(res).toMatchObject([
      {
        packageFile: 'versions.lock',
      },
      {
        packageFile: 'versions.props',
        deps: [
          {
            depName: 'org.apache.lucene:lucene-core',
            depType: 'dependencies',
            fileReplacePosition: 22,
            groupName: 'org.apache.lucene:*',
            lockedVersion: '1.2.3',
            managerData: {
              fileReplacePosition: 22,
              packageFile: 'versions.props',
            },
            registryUrls: [],
          },
          {
            depName: 'org.apache.lucene:lucene-codecs',
            depType: 'dependencies',
            fileReplacePosition: 22,
            groupName: 'org.apache.lucene:*',
            lockedVersion: '1.2.3',
            managerData: {
              fileReplacePosition: 22,
              packageFile: 'versions.props',
            },
            registryUrls: [],
          },
        ],
      },
      {
        packageFile: 'build.gradle',
      },
    ]);
  });

  it('gradle-consistent-versions plugin not used due to plugin not defined', async () => {
    const fsMock = {
      'build.gradle': 'no plugin defined here',
      'versions.props': `org.apache.lucene:* = 1.2.3`,
      'versions.lock': stripIndent`
        # Run ./gradlew --write-locks to regenerate this file
        org.apache.lucene:lucene-core:1.2.3
      `,
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toBeNull();
  });

  it('gradle-consistent-versions plugin not used due to lockfile missing', async () => {
    const fsMock = {
      'build.gradle': '(this file contains) com.palantir.consistent-versions',
      'versions.props': `org.apache.lucene:* = 1.2.3`,
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );
    expect(res).toBeNull();
  });

  it('gradle-consistent-versions plugin works for sub folders', () => {
    const fsMock = {
      'mysub/build.gradle.kts': `(this file contains) 'com.palantir.consistent-versions'`,
      'mysub/versions.props': `org.apache.lucene:* = 1.2.3`,
      'mysub/versions.lock': stripIndent`
        # Run ./gradlew --write-locks to regenerate this file
        org.apache.lucene:lucene-core:1.2.3`,
      'othersub/build.gradle.kts': `nothing here`,
    };
    mockFs(fsMock);

    expect(usesGcv('mysub/versions.props', fsMock)).toBeTrue();
    expect(usesGcv('othersub/versions.props', fsMock)).toBeFalse();
  });

  it('gradle-consistent-versions multi levels of glob', async () => {
    const fsMock = {
      'build.gradle': '(this file contains) com.palantir.consistent-versions',
      'versions.props': stripIndent`
        org.apache.* = 4
        org.apache.lucene:* = 3
        org.apache.lucene:a.* = 2
        org.apache.lucene:a.b = 1
      `,
      'versions.lock': stripIndent`
        # Run ./gradlew --write-locks to regenerate this file
        org.apache.solr:x.y:1 (10 constraints: 95be0c15)
        org.apache.lucene:a.b:1 (10 constraints: 95be0c15)
        org.apache.lucene:a.c:1 (10 constraints: 95be0c15)
        org.apache.lucene:a.d:1 (10 constraints: 95be0c15)
        org.apache.lucene:d:1 (10 constraints: 95be0c15)
        org.apache.lucene:e.f:1 (10 constraints: 95be0c15)
      `,
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      {} as ExtractConfig,
      Object.keys(fsMock)
    );

    // Each lock dep is only present once, with highest prio for exact prop match, then globs from longest to shortest
    expect(res).toMatchObject([
      {
        packageFile: 'versions.lock',
        datasource: 'maven',
        deps: [],
      },
      {
        packageFile: 'versions.props',
        datasource: 'maven',
        deps: [
          {
            managerData: {
              packageFile: 'versions.props',
              fileReplacePosition: 91,
            },
            packageName: 'org.apache.lucene:a.b',
            currentValue: '1',
            lockedVersion: '1',
            fileReplacePosition: 91,
            registryUrls: [],
            depType: 'dependencies',
          },
          {
            managerData: {
              packageFile: 'versions.props',
              fileReplacePosition: 65,
            },
            depName: 'org.apache.lucene:a.c',
            currentValue: '2',
            lockedVersion: '1',
            groupName: 'org.apache.lucene:a.*',
            fileReplacePosition: 65,
            registryUrls: [],
            depType: 'dependencies',
          },
          {
            managerData: {
              packageFile: 'versions.props',
              fileReplacePosition: 65,
            },
            depName: 'org.apache.lucene:a.d',
            currentValue: '2',
            lockedVersion: '1',
            groupName: 'org.apache.lucene:a.*',
            fileReplacePosition: 65,
            registryUrls: [],
            depType: 'dependencies',
          },
          {
            managerData: {
              packageFile: 'versions.props',
              fileReplacePosition: 39,
            },
            depName: 'org.apache.lucene:d',
            currentValue: '3',
            lockedVersion: '1',
            groupName: 'org.apache.lucene:*',
            fileReplacePosition: 39,
            registryUrls: [],
            depType: 'dependencies',
          },
          {
            managerData: {
              packageFile: 'versions.props',
              fileReplacePosition: 39,
            },
            depName: 'org.apache.lucene:e.f',
            currentValue: '3',
            lockedVersion: '1',
            groupName: 'org.apache.lucene:*',
            fileReplacePosition: 39,
            registryUrls: [],
            depType: 'dependencies',
          },
        ],
      },
      {
        packageFile: 'build.gradle',
        datasource: 'maven',
        deps: [],
      },
    ]);
  });

  it('gradle-consistent-versions plugin correct position for CRLF and LF', () => {
    const crlfProps2ndLine = parsePropsFile(`a.b:c.d=1\r\na.b:c.e=2`)[0].get(
      'a.b:c.e'
    );
    const lfProps2ndLine =
      parsePropsFile(`a.b:c.d=1\na.b:c.e=2`)[0].get('a.b:c.e');

    expect(crlfProps2ndLine?.filePos).toBe(19);
    expect(lfProps2ndLine?.filePos).toBe(18);
  });

  it('gradle-consistent-versions plugin test bogus input lines', () => {
    const parsedProps = parsePropsFile(stripIndent`
      # comment:foo.bar = 1
      123.foo:bar = 2
      this has:spaces = 3
       starts.with:space = 4
      contains(special):chars = 5
      a* = 6
      this.is:valid.dep = 7
      valid.glob:* = 8
    `);

    expect(parsedProps[0]?.size).toBe(1); // no 7 is valid exact dep
    expect(parsedProps[1]?.size).toBe(1); // no 8 is valid glob dep

    // lockfile
    const parsedLock = parseLockFile(stripIndent`
      # comment:foo.bar:1 (10 constraints: 95be0c15)
      123.foo:bar:2 (10 constraints: 95be0c15)
      this has:spaces:3 (10 constraints: 95be0c15)
       starts.with:space:4 (10 constraints: 95be0c15)
      contains(special):chars:5 (10 constraints: 95be0c15)
      no.colon:6 (10 constraints: 95be0c15)
      this.is:valid.dep:7 (10 constraints: 95be0c15)

      [Test dependencies]
      this.is:valid.test.dep:8 (10 constraints: 95be0c15)
    `);

    expect(parsedLock.size).toBe(2);
    expect(parsedLock.get('this.is:valid.dep')?.depType).toBe('dependencies'); // no 7 is valid exact dep
    expect(parsedLock.get('this.is:valid.test.dep')?.depType).toBe('test'); // no 7 is valid exact dep
  });
});

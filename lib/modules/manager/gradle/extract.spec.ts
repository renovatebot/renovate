import { Fixtures } from '../../../../test/fixtures';
import { fs, logger } from '../../../../test/util';
import type { ExtractConfig } from '../types';
import * as parser from './parser';
import { extractAllPackageFiles } from '.';

jest.mock('../../../util/fs');

function mockFs(files: Record<string, string>): void {
  // TODO: fix types, jest is using wrong overload (#7154)
  fs.readLocalFile.mockImplementation((fileName: string): Promise<any> => {
    const content = files?.[fileName];
    return Promise.resolve(content ?? '');
  });

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

    jest.spyOn(parser, 'parseGradle').mockRejectedValueOnce(err);
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

    expect(res).toMatchSnapshot([
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
      'build.gradle': 'url "https://example.com"; "foo:bar:$baz@zip"',
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
        'url "https://repo.maven.apache.org/maven2"',
        'url "https://repo.maven.apache.org/maven2"',
        'url "https://example.com"',
        'url "https://example.com"',
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
      // 'gradle/libs3.gradle', is intentionally not listed here
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
});

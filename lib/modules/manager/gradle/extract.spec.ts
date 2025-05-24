import { codeBlock } from 'common-tags';
import type { ExtractConfig, PackageDependency } from '../types';
import { matchesContentDescriptor } from './extract';
import * as parser from './parser';
import { extractAllPackageFiles } from '.';
import { Fixtures } from '~test/fixtures';
import { fs, logger, partial } from '~test/util';

vi.mock('../../../util/fs');

function mockFs(files: Record<string, string>): void {
  fs.getLocalFiles.mockImplementation(
    (fileNames: string[]): Promise<Record<string, string | null>> => {
      const fileContentMap: Record<string, string | null> = {};
      for (const fileName of fileNames) {
        fileContentMap[fileName] = files?.[fileName];
      }

      return Promise.resolve(fileContentMap);
    },
  );

  fs.getSiblingFileName.mockImplementation(
    (existingFileNameWithPath: string, otherFileName: string) => {
      return existingFileNameWithPath
        .slice(0, existingFileNameWithPath.lastIndexOf('/') + 1)
        .concat(otherFileName);
    },
  );
}

describe('modules/manager/gradle/extract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null', async () => {
    const fsMock = {
      'gradle.properties': '',
      'build.gradle': '',
    };
    mockFs(fsMock);

    expect(
      await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      ),
    ).toBeNull();
  });

  it('logs a warning in case parseGradle throws an exception', async () => {
    const filename = 'build.gradle';
    const err = new Error('unknown');
    const fsMock = {
      'build.gradle': '',
    };
    mockFs(fsMock);

    vi.spyOn(parser, 'parseGradle').mockImplementationOnce(() => {
      throw err;
    });
    await extractAllPackageFiles(partial<ExtractConfig>(), [filename]);

    expect(logger.logger.debug).toHaveBeenCalledWith(
      { err, config: {}, packageFile: filename },
      `Failed to process Gradle file`,
    );
  });

  it('skips versions composed from multiple variables', async () => {
    const fsMock = {
      'build.gradle':
        'foo = "1"; bar = "2"; baz = "3"; "foo:bar:$foo.$bar.$baz"',
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      partial<ExtractConfig>(),
      Object.keys(fsMock),
    );

    expect(res).toMatchObject([
      {
        packageFile: 'build.gradle',
        deps: [
          {
            depName: 'foo:bar',
            currentValue: '1.2.3',
            skipReason: 'contains-variable',
          },
        ],
      },
    ]);
  });

  it('extracts from cross-referenced files', async () => {
    const fsMock = {
      'gradle.properties': 'baz=1.2.3',
      'build.gradle':
        'repositories { maven { url "https://example.com" } }; "foo:bar:$baz@zip"',
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      partial<ExtractConfig>(),
      Object.keys(fsMock),
    );

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
      { packageFile: 'build.gradle', deps: [] },
    ]);
  });

  it('resolves cross-file Kotlin objects', async () => {
    const fsMock = {
      'buildSrc/src/main/kotlin/Deps.kt': codeBlock`
        object Libraries {
          const val jacksonAnnotations = "com.fasterxml.jackson.core:jackson-annotations:\${Versions.jackson}"
          const val rxjava: String = "io.reactivex.rxjava2:rxjava:" + Versions.rxjava
          const val jCache = "javax.cache:cache-api:1.1.0"
          private const val shadowVersion = "7.1.2"

          object Kotlin {
            const val version = GradleDeps.Kotlin.version
            const val stdlibJdk = "org.jetbrains.kotlin:kotlin-stdlib:$version"
          }

          object Android {
            object Tools {
              private const val version = "4.1.2"
              const val buildGradle = "com.android.tools.build:gradle:$version"
            }
          }

          val modulePlugins = mapOf(
            "shadow" to shadowVersion
          )

          object Test {
            private const val version = "1.3.0-rc01"
            const val core = "androidx.test:core:\${Test.version}"

            object Espresso {
              private const val version = "3.3.0-rc01"
              const val espressoCore = "androidx.test.espresso:espresso-core:$version"
            }

            object Androidx {
              const val coreKtx = "androidx.test:core-ktx:$version"
            }
          }
        }
      `,
      'buildSrc/src/main/kotlin/GradleDeps.kt': codeBlock`
        object GradleDeps {
          object Kotlin {
            const val version = "1.8.10"
          }
        }
      `,
      'buildSrc/src/main/kotlin/Versions.kt': codeBlock`
        object Versions {
          const val jackson = "2.9.10"
          const val rxjava: String = "1.2.3"
        }
      `,
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      partial<ExtractConfig>(),
      Object.keys(fsMock),
    );

    expect(res).toMatchObject([
      {
        packageFile: 'buildSrc/src/main/kotlin/Deps.kt',
        deps: [
          {
            depName: 'javax.cache:cache-api',
            currentValue: '1.1.0',
            sharedVariableName: 'Libraries.jCache',
          },
          {
            depName: 'com.android.tools.build:gradle',
            currentValue: '4.1.2',
            sharedVariableName: 'Libraries.Android.Tools.version',
          },
          {
            depName: 'androidx.test:core',
            currentValue: '1.3.0-rc01',
            sharedVariableName: 'Libraries.Test.version',
          },
          {
            depName: 'androidx.test.espresso:espresso-core',
            currentValue: '3.3.0-rc01',
            sharedVariableName: 'Libraries.Test.Espresso.version',
          },
          {
            depName: 'androidx.test:core-ktx',
            currentValue: '1.3.0-rc01',
            sharedVariableName: 'Libraries.Test.version',
          },
        ],
      },
      {
        packageFile: 'buildSrc/src/main/kotlin/GradleDeps.kt',
        deps: [
          {
            depName: 'org.jetbrains.kotlin:kotlin-stdlib',
            currentValue: '1.8.10',
            sharedVariableName: 'GradleDeps.Kotlin.version',
          },
        ],
      },
      {
        packageFile: 'buildSrc/src/main/kotlin/Versions.kt',
        deps: [
          {
            depName: 'com.fasterxml.jackson.core:jackson-annotations',
            currentValue: '2.9.10',
            sharedVariableName: 'Versions.jackson',
          },
          {
            depName: 'io.reactivex.rxjava2:rxjava',
            currentValue: '1.2.3',
            sharedVariableName: 'Versions.rxjava',
          },
        ],
      },
    ]);
  });

  it('inherits gradle variables', async () => {
    const fsMock = {
      'gradle.properties': 'foo=1.0.0',
      'build.gradle': 'foo = "1.0.1"',
      'aaa/gradle.properties': 'bar = "2.0.0"',
      'aaa/build.gradle': 'bar = "2.0.1"',
      'aaa/bbb/build.gradle': '"foo:foo:$foo"; "bar:bar:$bar"',
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      partial<ExtractConfig>(),
      Object.keys(fsMock),
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

  it('filters duplicate dependency findings', async () => {
    const buildFile = codeBlock`
      apply from: 'test.gradle'

      repositories {
        mavenCentral()
      }

      dependencies {
        implementation "io.jsonwebtoken:jjwt-api:$\{jjwtVersion}"
        runtimeOnly "io.jsonwebtoken:jjwt-impl:$\{jjwtVersion}"
      }
    `;

    const testFile = codeBlock`
      ext.jjwtVersion = '0.11.2'

      ext {
        jjwtApi = "io.jsonwebtoken:jjwt-api:$jjwtVersion"
      }
    `;
    const fsMock = {
      'build.gradle': buildFile,
      'test.gradle': testFile,
    };
    mockFs(fsMock);

    const res = await extractAllPackageFiles(
      partial<ExtractConfig>(),
      Object.keys(fsMock),
    );

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
      partial<ExtractConfig>(),
      Object.keys(fsMock),
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

  describe('registry URLs', () => {
    it('deduplicates registry urls', async () => {
      const fsMock = {
        'build.gradle': codeBlock`
          repositories { maven { url "https://repo.maven.apache.org/maven2" } }
          repositories { maven { url "https://repo.maven.apache.org/maven2" } }
          repositories { maven { url "https://example.com" } }
          repositories { maven { url "https://example.com" } }
          plugins { id "foo.bar" version "1.2.3" }
          dependencies { classpath "foo:bar:1.2.3" }
        `,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

      expect(res).toMatchObject([
        {
          packageFile: 'build.gradle',
          deps: [
            {
              depType: 'plugin',
              registryUrls: ['https://plugins.gradle.org/m2/'],
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

    it('interpolates registry URLs', async () => {
      const buildFile = codeBlock`
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

      const fsMock = {
        'build.gradle': buildFile,
        'gradle.properties': 'repositoryBaseURL: https\\://dummy.org/whatever',
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

      expect(res).toMatchObject([
        {
          packageFile: 'gradle.properties',
          deps: [],
        },
        {
          packageFile: 'build.gradle',
          deps: [
            {
              depName: 'com.google.protobuf:protobuf-java',
              currentValue: '2.17.0',
              managerData: {
                fileReplacePosition: 262,
                packageFile: 'build.gradle',
              },
              fileReplacePosition: 262,
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

    it('supports separate registry URLs for plugins', async () => {
      const settingsFile = codeBlock`
        pluginManagement {
          repositories {
            mavenLocal()
            maven { url = "https://foo.bar/plugins" }
          }
        }
      `;

      const buildFile = codeBlock`
        plugins {
          id "foo.bar" version "1.2.3"
        }
        repositories {
          maven { url = "https://foo.bar/deps" }
          mavenCentral()
        }
        dependencies {
          classpath "io.jsonwebtoken:jjwt-api:0.11.2"
        }
      `;

      const fsMock = {
        'build.gradle': buildFile,
        'settings.gradle': settingsFile,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

      expect(res).toMatchObject([
        {
          packageFile: 'settings.gradle',
          deps: [],
        },
        {
          packageFile: 'build.gradle',
          deps: [
            {
              depName: 'foo.bar',
              depType: 'plugin',
              registryUrls: ['https://foo.bar/plugins'],
            },
            {
              depName: 'io.jsonwebtoken:jjwt-api',
              registryUrls: [
                'https://foo.bar/deps',
                'https://repo.maven.apache.org/maven2',
              ],
            },
          ],
        },
      ]);
    });

    describe('content descriptors', () => {
      describe('simple descriptor matches', () => {
        it.each`
          input                      | output   | descriptor
          ${'foo:bar:1.2.3'}         | ${true}  | ${undefined}
          ${'foo:bar:1.2.3'}         | ${true}  | ${[{ mode: 'include', matcher: 'simple', groupId: 'foo' }]}
          ${'foo:bar:1.2.3'}         | ${false} | ${[{ mode: 'exclude', matcher: 'simple', groupId: 'foo' }]}
          ${'foo:bar:1.2.3'}         | ${false} | ${[{ mode: 'include', matcher: 'simple', groupId: 'bar' }]}
          ${'foo:bar:1.2.3'}         | ${true}  | ${[{ mode: 'include', matcher: 'simple', groupId: 'foo', artifactId: 'bar' }]}
          ${'foo:bar:1.2.3'}         | ${false} | ${[{ mode: 'exclude', matcher: 'simple', groupId: 'foo', artifactId: 'bar' }]}
          ${'foo:bar:1.2.3'}         | ${false} | ${[{ mode: 'include', matcher: 'simple', groupId: 'foo', artifactId: 'baz' }]}
          ${'foo:bar:1.2.3'}         | ${true}  | ${[{ mode: 'include', matcher: 'simple', groupId: 'foo', artifactId: 'bar', version: '1.2.3' }]}
          ${'foo:bar:1.2.3'}         | ${false} | ${[{ mode: 'exclude', matcher: 'simple', groupId: 'foo', artifactId: 'bar', version: '1.2.3' }]}
          ${'foo:bar:1.2.3'}         | ${true}  | ${[{ mode: 'include', matcher: 'simple', groupId: 'foo', artifactId: 'bar', version: '1.2.+' }]}
          ${'foo:bar:1.2.3'}         | ${false} | ${[{ mode: 'include', matcher: 'simple', groupId: 'foo', artifactId: 'baz', version: '4.5.6' }]}
          ${'foo:bar:1.2.3'}         | ${true}  | ${[{ mode: 'include', matcher: 'subgroup', groupId: 'foo' }]}
          ${'foo.bar.baz:qux:1.2.3'} | ${true}  | ${[{ mode: 'include', matcher: 'subgroup', groupId: 'foo.bar.baz' }]}
          ${'foo.bar.baz:qux:1.2.3'} | ${true}  | ${[{ mode: 'include', matcher: 'subgroup', groupId: 'foo.bar' }]}
          ${'foo.bar.baz:qux:1.2.3'} | ${false} | ${[{ mode: 'include', matcher: 'subgroup', groupId: 'foo.barbaz' }]}
          ${'foobarbaz:qux:1.2.3'}   | ${true}  | ${[{ mode: 'include', matcher: 'regex', groupId: '.*bar.*' }]}
          ${'foobarbaz:qux:1.2.3'}   | ${true}  | ${[{ mode: 'include', matcher: 'regex', groupId: '.*bar.*', artifactId: 'qux' }]}
          ${'foobar:foobar:1.2.3'}   | ${true}  | ${[{ mode: 'include', matcher: 'regex', groupId: '.*bar.*', artifactId: 'foo.*' }]}
          ${'foobar:foobar:1.2.3'}   | ${false} | ${[{ mode: 'include', matcher: 'regex', groupId: 'foobar', artifactId: '^bar' }]}
          ${'foobar:foobar:1.2.3'}   | ${true}  | ${[{ mode: 'include', matcher: 'regex', groupId: 'foobar', artifactId: '^foo.*', version: '1\\.*' }]}
          ${'foobar:foobar:1.2.3'}   | ${false} | ${[{ mode: 'include', matcher: 'regex', groupId: 'foobar', artifactId: '^foo', version: '3.+' }]}
          ${'foobar:foobar:1.2.3'}   | ${false} | ${[{ mode: 'include', matcher: 'regex', groupId: 'foobar', artifactId: 'qux', version: '1\\.*' }]}
        `('$input | $output', ({ input, output, descriptor }) => {
          const [groupId, artifactId, currentValue] = input.split(':');
          const dep: PackageDependency = {
            depName: `${groupId}:${artifactId}`,
            currentValue,
          };

          expect(matchesContentDescriptor(dep, descriptor)).toBe(output);
        });
      });

      describe('multiple descriptors', () => {
        const dep: PackageDependency = {
          depName: `foo:bar`,
          currentValue: '1.2.3',
        };

        it('if both includes and excludes exist, dep must match include and not match exclude', () => {
          expect(
            matchesContentDescriptor(dep, [
              { mode: 'include', matcher: 'simple', groupId: 'foo' },
              {
                mode: 'exclude',
                matcher: 'simple',
                groupId: 'foo',
                artifactId: 'baz',
              },
            ]),
          ).toBe(true);

          expect(
            matchesContentDescriptor(dep, [
              { mode: 'include', matcher: 'simple', groupId: 'foo' },
              {
                mode: 'exclude',
                matcher: 'simple',
                groupId: 'foo',
                artifactId: 'bar',
              },
            ]),
          ).toBe(false);
        });

        it('if only includes exist, dep must match at least one include', () => {
          expect(
            matchesContentDescriptor(dep, [
              { mode: 'include', matcher: 'simple', groupId: 'some' },
              { mode: 'include', matcher: 'simple', groupId: 'foo' },
              { mode: 'include', matcher: 'simple', groupId: 'bar' },
            ]),
          ).toBe(true);

          expect(
            matchesContentDescriptor(dep, [
              { mode: 'include', matcher: 'simple', groupId: 'some' },
              { mode: 'include', matcher: 'simple', groupId: 'other' },
              { mode: 'include', matcher: 'simple', groupId: 'bar' },
            ]),
          ).toBe(false);
        });

        it('if only excludes exist, dep must match not match any exclude', () => {
          expect(
            matchesContentDescriptor(dep, [
              { mode: 'exclude', matcher: 'simple', groupId: 'some' },
              { mode: 'exclude', matcher: 'simple', groupId: 'foo' },
              { mode: 'exclude', matcher: 'simple', groupId: 'bar' },
            ]),
          ).toBe(false);

          expect(
            matchesContentDescriptor(dep, [
              { mode: 'exclude', matcher: 'simple', groupId: 'some' },
              { mode: 'exclude', matcher: 'simple', groupId: 'other' },
              { mode: 'exclude', matcher: 'simple', groupId: 'bar' },
            ]),
          ).toBe(true);
        });
      });

      it('extracts content descriptors', async () => {
        const fsMock = {
          'build.gradle': codeBlock`
            pluginManagement {
              repositories {
                maven {
                  url = "https://foo.bar/baz"
                  content {
                    includeModule("com.diffplug.spotless", "com.diffplug.spotless.gradle.plugin")
                  }
                }
              }
            }
            repositories {
              mavenCentral()
              google {
                content {
                  includeGroupAndSubgroups("foo.bar")
                  includeModuleByRegex("com\\\\.(google|android).*", "protobuf.*")
                  includeGroupByRegex("(?!(unsupported|pattern).*)")
                  includeGroupByRegex "org\\\\.jetbrains\\\\.kotlin.*"
                  excludeModule("foo.bar.group", "simple.module")
                }
              }
              maven {
                name = "some"
                url = "https://foo.bar/\${name}"
                content {
                  includeModule("foo.bar.group", "simple.module")
                  includeVersion("com.google.protobuf", "protobuf-java", "2.17.+")
                }
              }
            }

            plugins {
              id("com.diffplug.spotless") version "6.10.0"
            }

            dependencies {
              implementation "com.google.protobuf:protobuf-java:2.17.1"
              implementation "org.jetbrains.kotlin:kotlin-stdlib-jdk8:1.4.21"
              implementation "foo.bar:protobuf-java:2.17.0"
              implementation "foo.bar.group:simple.module:2.17.0"
            }
          `,
        };
        mockFs(fsMock);

        const res = await extractAllPackageFiles(
          partial<ExtractConfig>(),
          Object.keys(fsMock),
        );

        expect(res).toMatchObject([
          {
            deps: [
              {
                depName: 'com.diffplug.spotless',
                currentValue: '6.10.0',
                depType: 'plugin',
                packageName:
                  'com.diffplug.spotless:com.diffplug.spotless.gradle.plugin',
                registryUrls: ['https://foo.bar/baz'],
              },
              {
                depName: 'com.google.protobuf:protobuf-java',
                currentValue: '2.17.1',
                registryUrls: [
                  'https://repo.maven.apache.org/maven2',
                  'https://dl.google.com/android/maven2/',
                  'https://foo.bar/some',
                ],
              },
              {
                depName: 'org.jetbrains.kotlin:kotlin-stdlib-jdk8',
                currentValue: '1.4.21',
                registryUrls: [
                  'https://repo.maven.apache.org/maven2',
                  'https://dl.google.com/android/maven2/',
                ],
              },
              {
                depName: 'foo.bar:protobuf-java',
                currentValue: '2.17.0',
                registryUrls: [
                  'https://repo.maven.apache.org/maven2',
                  'https://dl.google.com/android/maven2/',
                ],
              },
              {
                depName: 'foo.bar.group:simple.module',
                currentValue: '2.17.0',
                registryUrls: [
                  'https://repo.maven.apache.org/maven2',
                  'https://foo.bar/some',
                ],
              },
            ],
          },
        ]);
      });
    });

    it('exclusiveContent', async () => {
      const fsMock = {
        'build.gradle': codeBlock`
          repositories {
            google()
            exclusiveContent {
              forRepository {
                maven {
                  url "https://artifactory.foo.bar/artifactory/test"
                }
              }
              filter {
                includeGroup "foo.bar"
              }
            }
          }

          dependencies {
            implementation "com.google.protobuf:protobuf-java:2.17.1"
            implementation "foo.bar:protobuf-java:2.17.0"
          }
        `,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

      expect(res).toMatchObject([
        {
          deps: [
            {
              depName: 'com.google.protobuf:protobuf-java',
              currentValue: '2.17.1',
              registryUrls: ['https://dl.google.com/android/maven2/'],
            },
            {
              depName: 'foo.bar:protobuf-java',
              currentValue: '2.17.0',
              registryUrls: ['https://artifactory.foo.bar/artifactory/test'],
            },
          ],
        },
      ]);
    });

    it('exclusiveContent with repeated repository definition', async () => {
      const fsMock = {
        'build.gradle': codeBlock`
          repositories {
            google()
            exclusiveContent {
              forRepository {
                maven {
                  url "https://artifactory.foo.bar/artifactory/test"
                }
              }
              filter {
                includeGroup "some.dll"
              }
            }
            exclusiveContent {
              forRepository {
                maven {
                  url "https://artifactory.foo.bar/artifactory/test"
                }
              }
              filter {
                includeGroup "foo.bar"
              }
            }
          }

          dependencies {
            implementation "com.google.protobuf:protobuf-java:2.17.1"
            implementation "foo.bar:protobuf-java:2.17.0"
            implementation "some.dll:dll-1:1.0.0"
          }
        `,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

      expect(res).toMatchObject([
        {
          deps: [
            {
              depName: 'com.google.protobuf:protobuf-java',
              currentValue: '2.17.1',
              registryUrls: ['https://dl.google.com/android/maven2/'],
            },
            {
              depName: 'foo.bar:protobuf-java',
              currentValue: '2.17.0',
              registryUrls: ['https://artifactory.foo.bar/artifactory/test'],
            },
            {
              depName: 'some.dll:dll-1',
              currentValue: '1.0.0',
              registryUrls: ['https://artifactory.foo.bar/artifactory/test'],
            },
          ],
        },
      ]);
    });
  });

  describe('version catalogs', () => {
    it('works with dependency catalogs', async () => {
      const fsMock = {
        'gradle/libs.versions.toml': Fixtures.get('libs.versions.toml'),
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );
      expect(res).toMatchObject([
        {
          packageFile: 'gradle/libs.versions.toml',
          deps: [
            {
              depName: 'io.gitlab.arturbosch.detekt:detekt-formatting',
              sharedVariableName: 'detekt',
              currentValue: '1.17.0',
              managerData: {
                fileReplacePosition: 21,
                packageFile: 'gradle/libs.versions.toml',
              },
            },
            {
              depName: 'io.kotest:kotest-assertions-core-jvm',
              sharedVariableName: 'kotest',
              currentValue: '4.6.0',
              managerData: {
                fileReplacePosition: 51,
                packageFile: 'gradle/libs.versions.toml',
              },
            },
            {
              depName: 'io.kotest:kotest-runner-junit5',
              sharedVariableName: 'kotest',
              currentValue: '4.6.0',
              managerData: {
                fileReplacePosition: 51,
                packageFile: 'gradle/libs.versions.toml',
              },
            },
            {
              depName: 'org.mockito:mockito-core',
              currentValue: '3.10.0',
              managerData: {
                fileReplacePosition: 474,
                packageFile: 'gradle/libs.versions.toml',
              },
            },
            {
              depName: 'com.github.siom79.japicmp:japicmp',
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
              skipReason: 'unspecified-version',
            },
            {
              depName: 'org.ajoberstar.grgit2',
              depType: 'plugin',
              skipReason: 'unspecified-version',
            },
          ],
        },
      ]);
    });

    it('ignores empty TOML file', async () => {
      const fsMock = {
        'gradle/libs.versions.toml': '',
      };
      mockFs(fsMock);

      expect(
        await extractAllPackageFiles(
          partial<ExtractConfig>(),
          Object.keys(fsMock),
        ),
      ).toBeNull();
    });

    it('deletes commit message for plugins with version reference', async () => {
      const fsMock = {
        'gradle/libs.versions.toml': codeBlock`
        [versions]
        detekt = "1.18.1"

        [plugins]
        detekt = { id = "io.gitlab.arturbosch.detekt", version.ref = "detekt" }

        [libraries]
        detekt-formatting = { module = "io.gitlab.arturbosch.detekt:detekt-formatting", version.ref = "detekt" }
      `,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );
      expect(res).toMatchObject([
        {
          packageFile: 'gradle/libs.versions.toml',
          deps: [
            {
              depName: 'io.gitlab.arturbosch.detekt:detekt-formatting',
              sharedVariableName: 'detekt',
              currentValue: '1.18.1',
              managerData: {
                fileReplacePosition: 21,
                packageFile: 'gradle/libs.versions.toml',
              },
              fileReplacePosition: 21,
            },
            {
              depType: 'plugin',
              depName: 'io.gitlab.arturbosch.detekt',
              packageName:
                'io.gitlab.arturbosch.detekt:io.gitlab.arturbosch.detekt.gradle.plugin',
              registryUrls: ['https://plugins.gradle.org/m2/'],
              currentValue: '1.18.1',
              managerData: {
                fileReplacePosition: 21,
                packageFile: 'gradle/libs.versions.toml',
              },
              sharedVariableName: 'detekt',
              fileReplacePosition: 21,
            },
          ],
        },
      ]);
    });
  });

  describe('apply from', () => {
    it('loads further scripts using apply from statements', async () => {
      const buildFile = codeBlock`
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

      const fsMock = {
        'gradleX/libs1.gradle': "ext.junitVersion = '5.5.2'",
        'gradle/libs2.gradle': "ext.protoBufVersion = '3.18.2'",
        'gradle/libs3.gradle': "ext.guavaVersion = '30.1-jre'",
        'gradleX/gradleX/libs4.gradle': "ext.slf4jVersion = '1.7.30'",
        'build.gradle': buildFile,
        'gradle.properties': 'someDir=gradleX',
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

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

    it('works with files in sub-directories', async () => {
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

      const fsMock = {
        'somesubdir/gradle/libs4.gradle': "ext.protoBufVersion = '3.18.2'",
        'somesubdir/build.gradle': buildFile,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

      expect(res).toMatchObject([
        { packageFile: 'somesubdir/build.gradle' },
        {
          packageFile: 'somesubdir/gradle/libs4.gradle',
          deps: [{ depName: 'com.google.protobuf:protobuf-java' }],
        },
      ]);
    });

    it('prevents recursive apply from calls', async () => {
      const fsMock = {
        'build.gradle': "apply from: 'test.gradle'",
        'test.gradle': "apply from: 'build.gradle'",
      };
      mockFs(fsMock);

      expect(
        await extractAllPackageFiles(
          partial<ExtractConfig>(),
          Object.keys(fsMock),
        ),
      ).toBeNull();
    });

    it('prevents inclusion of non-Gradle files', async () => {
      const fsMock = {
        'build.gradle': "apply from: '~test.non-gradle'",
      };
      mockFs(fsMock);

      expect(
        await extractAllPackageFiles(
          partial<ExtractConfig>(),
          Object.keys(fsMock),
        ),
      ).toBeNull();
    });
  });

  describe('gradle-consistent-versions plugin', () => {
    it('parses versions files', async () => {
      const fsMock = {
        'versions.props': `org.apache.lucene:* = 1.2.3`,
        'versions.lock': codeBlock`
          # Run ./gradlew --write-locks to regenerate this file
          org.apache.lucene:lucene-core:1.2.3 (10 constraints: 95be0c15)
          org.apache.lucene:lucene-codecs:1.2.3 (5 constraints: 1231231)
        `,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
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
              sharedVariableName: 'org.apache.lucene:*',
              lockedVersion: '1.2.3',
              managerData: {
                fileReplacePosition: 22,
                packageFile: 'versions.props',
              },
            },
            {
              depName: 'org.apache.lucene:lucene-codecs',
              depType: 'dependencies',
              fileReplacePosition: 22,
              sharedVariableName: 'org.apache.lucene:*',
              lockedVersion: '1.2.3',
              managerData: {
                fileReplacePosition: 22,
                packageFile: 'versions.props',
              },
            },
          ],
        },
      ]);
    });

    it('plugin not used due to lockfile not a GCV lockfile', async () => {
      const fsMock = {
        'versions.props': `org.apache.lucene:* = 1.2.3`,
        'versions.lock': codeBlock`
          This is NOT a lock file
        `,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );
      expect(res).toBeNull();
    });

    it('plugin not used due to lockfile missing', async () => {
      const fsMock = {
        'build.gradle': '(this file contains) com.palantir.consistent-versions',
        'versions.props': `org.apache.lucene:* = 1.2.3`,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );
      expect(res).toBeNull();
    });

    it('supports multiple levels of glob', async () => {
      const fsMock = {
        'versions.props': codeBlock`
          org.apache.* = 4
          org.apache.lucene:* = 3
          org.apache.lucene:a.* = 2
          org.apache.lucene:a.b = 1
          org.apache.foo*:* = 5
        `,
        'versions.lock': codeBlock`
          # Run ./gradlew --write-locks to regenerate this file
          org.apache.solr:x.y:1 (10 constraints: 95be0c15)
          org.apache.lucene:a.b:1 (10 constraints: 95be0c15)
          org.apache.lucene:a.c:1 (10 constraints: 95be0c15)
          org.apache.lucene:a.d:1 (10 constraints: 95be0c15)
          org.apache.lucene:d:1 (10 constraints: 95be0c15)
          org.apache.lucene:e.f:1 (10 constraints: 95be0c15)
          org.apache.foo-bar:a:1 (10 constraints: 95be0c15)
        `,
      };
      mockFs(fsMock);

      const res = await extractAllPackageFiles(
        partial<ExtractConfig>(),
        Object.keys(fsMock),
      );

      // Each lock dep is only present once, with highest prio for exact prop match, then globs from longest to shortest
      expect(res).toMatchObject([
        {
          packageFile: 'versions.lock',
          deps: [],
        },
        {
          packageFile: 'versions.props',
          deps: [
            {
              managerData: {
                packageFile: 'versions.props',
                fileReplacePosition: 91,
              },
              depName: 'org.apache.lucene:a.b',
              currentValue: '1',
              lockedVersion: '1',
              fileReplacePosition: 91,
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
              sharedVariableName: 'org.apache.lucene:a.*',
              fileReplacePosition: 65,
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
              sharedVariableName: 'org.apache.lucene:a.*',
              fileReplacePosition: 65,
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
              sharedVariableName: 'org.apache.lucene:*',
              fileReplacePosition: 39,
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
              sharedVariableName: 'org.apache.lucene:*',
              fileReplacePosition: 39,
              depType: 'dependencies',
            },
            {
              managerData: {
                fileReplacePosition: 113,
                packageFile: 'versions.props',
              },
              depName: 'org.apache.foo-bar:a',
              currentValue: '5',
              lockedVersion: '1',
              sharedVariableName: 'org.apache.foo*:*',
              fileReplacePosition: 113,
              depType: 'dependencies',
            },
          ],
        },
      ]);
    });
  });
});

import { codeBlock } from 'common-tags';
import { logger } from '~test/util.ts';
import { extractPackageFile } from './extract.ts';

const registryUrls = [
  'https://repo.maven.apache.org/maven2',
  'https://maven.google.com',
];

describe('modules/manager/kotlin-toolchain/extract', () => {
  describe('extractPackageFile()', () => {
    it('extracts scalar coordinates of a dependencies section', () => {
      const content = codeBlock`
        product: jvm/app

        dependencies:
          - io.ktor:ktor-client-core:2.2.0
          - com.h2database:h2:2.3.232@jar
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'io.ktor:ktor-client-core',
            currentValue: '2.2.0',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'io.ktor:ktor-client-core:2.2.0',
            registryUrls,
          },
          {
            depName: 'com.h2database:h2',
            currentValue: '2.3.232',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'com.h2database:h2:2.3.232@jar',
            registryUrls,
          },
        ],
      });
    });

    it('extracts a test-dependencies section', () => {
      const content = codeBlock`
        test-dependencies:
          - io.ktor:ktor-server-test-host:2.2.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'io.ktor:ktor-server-test-host',
            currentValue: '2.2.0',
            depType: 'test-dependencies',
            datasource: 'maven',
            replaceString: 'io.ktor:ktor-server-test-host:2.2.0',
            registryUrls,
          },
        ],
      });
    });

    it('keeps the platform qualifier in the depType', () => {
      const content = codeBlock`
        dependencies@jvm:
          - org.postgresql:postgresql:42.3.3
        test-dependencies@android:
          - androidx.test:core:1.6.1
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.postgresql:postgresql',
            currentValue: '42.3.3',
            depType: 'dependencies@jvm',
            datasource: 'maven',
            replaceString: 'org.postgresql:postgresql:42.3.3',
            registryUrls,
          },
          {
            depName: 'androidx.test:core',
            currentValue: '1.6.1',
            depType: 'test-dependencies@android',
            datasource: 'maven',
            replaceString: 'androidx.test:core:1.6.1',
            registryUrls,
          },
        ],
      });
    });

    it('extracts the mapping forms of a dependency', () => {
      const content = codeBlock`
        dependencies:
          - org.postgresql:postgresql:42.3.3: runtime-only
          - io.ktor:ktor-client-core:2.2.0:
              exported: true
              scope: compile-only
          - bom: io.ktor:ktor-bom:2.2.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.postgresql:postgresql',
            currentValue: '42.3.3',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'org.postgresql:postgresql:42.3.3',
            registryUrls,
          },
          {
            depName: 'io.ktor:ktor-client-core',
            currentValue: '2.2.0',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'io.ktor:ktor-client-core:2.2.0',
            registryUrls,
          },
          {
            depName: 'io.ktor:ktor-bom',
            currentValue: '2.2.0',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'io.ktor:ktor-bom:2.2.0',
            registryUrls,
          },
        ],
      });
    });

    it('extracts the ktor-simplest-sample module', () => {
      const content = codeBlock`
        product: jvm/app

        settings:
          ktor: enabled
          jvm:
            mainClass: com.example.com.ApplicationKt

        dependencies:
          - $ktor.server.core
          - $ktor.server.netty
          - $ktor.server.config.yaml
          - ch.qos.logback:logback-classic:1.5.18

        test-dependencies:
          - $ktor.server.testHost
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: '$ktor.server.core',
            skipReason: 'contains-variable',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: '$ktor.server.core',
            registryUrls,
          },
          {
            depName: '$ktor.server.netty',
            skipReason: 'contains-variable',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: '$ktor.server.netty',
            registryUrls,
          },
          {
            depName: '$ktor.server.config.yaml',
            skipReason: 'contains-variable',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: '$ktor.server.config.yaml',
            registryUrls,
          },
          {
            depName: 'ch.qos.logback:logback-classic',
            currentValue: '1.5.18',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'ch.qos.logback:logback-classic:1.5.18',
            registryUrls,
          },
          {
            depName: '$ktor.server.testHost',
            skipReason: 'contains-variable',
            depType: 'test-dependencies',
            datasource: 'maven',
            replaceString: '$ktor.server.testHost',
            registryUrls,
          },
        ],
      });
    });

    it('marks a local module as a local dependency', () => {
      const content = codeBlock`
        dependencies:
          - //ui/utils
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: '//ui/utils',
            skipReason: 'local-dependency',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: '//ui/utils',
            registryUrls,
          },
        ],
      });
    });

    it('marks a coordinate without a version as unspecified', () => {
      const content = codeBlock`
        dependencies:
          - io.ktor:ktor-serialization-kotlinx-json
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'io.ktor:ktor-serialization-kotlinx-json',
            skipReason: 'unspecified-version',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'io.ktor:ktor-serialization-kotlinx-json',
            registryUrls,
          },
        ],
      });
    });

    it('returns the dependencies in document order', () => {
      const content = codeBlock`
        test-dependencies:
          - org.example:test-first:1.0

        dependencies:
          - org.example:main-second:2.0
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps.map((dep) => dep.depName)).toEqual([
        'org.example:test-first',
        'org.example:main-second',
      ]);
    });

    it('skips a section that is not a list', () => {
      const content = codeBlock`
        dependencies: org.example:not-a-list:1.0

        test-dependencies:
          - org.example:lib:1.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.example:lib',
            currentValue: '1.0',
            depType: 'test-dependencies',
            datasource: 'maven',
            replaceString: 'org.example:lib:1.0',
            registryUrls,
          },
        ],
      });
    });

    it('skips an entry that is not a coordinate', () => {
      const content = codeBlock`
        dependencies:
          - just a string
          - org.example:lib:1.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.example:lib',
            currentValue: '1.0',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'org.example:lib:1.0',
            registryUrls,
          },
        ],
      });
    });

    it('extracts every built-in technology version', () => {
      const content = codeBlock`
        settings:
          kotlin:
            version: 2.2.20
            serialization:
              version: 1.7.3
            rpc:
              version: 0.10.2
            ksp:
              version: 2.2.20-2.0.2
            dataframe:
              version: 0.15.0
          compose:
            version: 1.7.0
            experimental:
              hotReload:
                version: 1.0.0-beta05
          jvm:
            test:
              junitPlatformVersion: 6.0.3
          ktor:
            version: 3.4.3
          lombok:
            version: 1.18.46
          springBoot:
            version: 4.0.6
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.jetbrains.kotlin:kotlin-stdlib',
            currentValue: '2.2.20',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.kotlin.version' },
            registryUrls,
          },
          {
            depName: 'org.jetbrains.kotlinx:kotlinx-serialization-core',
            currentValue: '1.7.3',
            depType: 'settings',
            datasource: 'maven',
            managerData: {
              settingPath: 'settings.kotlin.serialization.version',
            },
            registryUrls,
          },
          {
            depName: 'org.jetbrains.kotlinx:kotlinx-rpc-bom',
            currentValue: '0.10.2',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.kotlin.rpc.version' },
            registryUrls,
          },
          {
            depName: 'com.google.devtools.ksp:symbol-processing-api',
            currentValue: '2.2.20-2.0.2',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.kotlin.ksp.version' },
            registryUrls,
          },
          {
            depName: 'org.jetbrains.kotlinx:dataframe-core',
            currentValue: '0.15.0',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.kotlin.dataframe.version' },
            registryUrls,
          },
          {
            depName: 'org.jetbrains.compose.runtime:runtime',
            currentValue: '1.7.0',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.compose.version' },
            registryUrls,
          },
          {
            depName: 'org.jetbrains.compose.hot-reload:hot-reload-runtime-api',
            currentValue: '1.0.0-beta05',
            depType: 'settings',
            datasource: 'maven',
            managerData: {
              settingPath: 'settings.compose.experimental.hotReload.version',
            },
            registryUrls: [
              ...registryUrls,
              'https://packages.jetbrains.team/maven/p/amper/compose-hot-reload',
            ],
          },
          {
            depName: 'org.junit.platform:junit-platform-console-standalone',
            currentValue: '6.0.3',
            depType: 'settings',
            datasource: 'maven',
            managerData: {
              settingPath: 'settings.jvm.test.junitPlatformVersion',
            },
            registryUrls,
          },
          {
            depName: 'io.ktor:ktor-bom',
            currentValue: '3.4.3',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.ktor.version' },
            registryUrls,
          },
          {
            depName: 'org.projectlombok:lombok',
            currentValue: '1.18.46',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.lombok.version' },
            registryUrls,
          },
          {
            depName: 'org.springframework.boot:spring-boot-dependencies',
            currentValue: '4.0.6',
            depType: 'settings',
            datasource: 'maven',
            managerData: {
              settingPath: 'settings.springBoot.version',
            },
            registryUrls,
          },
        ],
      });
    });

    it('leaves the replaceString of a built-in version unset', () => {
      const content = codeBlock`
        settings:
          lombok:
            enabled: true
            version:  1.18.35
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps).toHaveLength(1);
      expect(res?.deps[0]).not.toHaveProperty('replaceString');
    });

    it('reports a version that YAML parses as a number', () => {
      const content = codeBlock`
        settings:
          ktor:
            version: 3.5
          jvm:
            test:
              junitPlatformVersion: 6.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.junit.platform:junit-platform-console-standalone',
            currentValue: '6',
            skipReason: 'invalid-value',
            depType: 'settings',
            datasource: 'maven',
            managerData: {
              settingPath: 'settings.jvm.test.junitPlatformVersion',
            },
            registryUrls,
          },
          {
            depName: 'io.ktor:ktor-bom',
            currentValue: '3.5',
            skipReason: 'invalid-value',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.ktor.version' },
            registryUrls,
          },
        ],
      });
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Kotlin Toolchain version at settings.ktor.version is not a string: 3.5',
      );
    });

    it('reports a version that YAML parses as a boolean', () => {
      const content = codeBlock`
        settings:
          lombok:
            version: true
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.projectlombok:lombok',
            currentValue: 'true',
            skipReason: 'invalid-value',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.lombok.version' },
            registryUrls,
          },
        ],
      });
    });

    it('ignores a technology given as a scalar', () => {
      const content = codeBlock`
        settings:
          ktor: enabled
          lombok: enabled
          jvm:
            mainClass: com.example.ApplicationKt
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({ deps: [] });
    });

    it('ignores a technology enabled without a version', () => {
      const content = codeBlock`
        product: jvm/app

        settings:
          compose:
            enabled: true
            experimental:
              hotReload:
                enabled: true
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({ deps: [] });
    });

    it('ignores android settings that are not coordinates', () => {
      const content = codeBlock`
        settings:
          android:
            compileSdk: 35
            minSdk: 24
            targetSdk: 35
            buildToolsVersion: 35.0.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({ deps: [] });
    });

    it('extracts java annotation processors', () => {
      const content = codeBlock`
        settings:
          java:
            annotationProcessing:
              processors:
                - org.mapstruct:mapstruct-processor:1.6.3
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.mapstruct:mapstruct-processor',
            currentValue: '1.6.3',
            depType: 'settings',
            datasource: 'maven',
            replaceString: 'org.mapstruct:mapstruct-processor:1.6.3',
            registryUrls,
          },
        ],
      });
    });

    it('extracts KSP processors after the KSP version', () => {
      const content = codeBlock`
        settings:
          kotlin:
            ksp:
              version: 2.3.11
              processors:
                - androidx.room:room-compiler:2.7.0-alpha12
                - //my-processor
                - $libs.some.processor
              processorOptions:
                someOption: value
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'com.google.devtools.ksp:symbol-processing-api',
            currentValue: '2.3.11',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings.kotlin.ksp.version' },
            registryUrls,
          },
          {
            depName: 'androidx.room:room-compiler',
            currentValue: '2.7.0-alpha12',
            depType: 'settings',
            datasource: 'maven',
            replaceString: 'androidx.room:room-compiler:2.7.0-alpha12',
            registryUrls,
          },
          {
            depName: '//my-processor',
            skipReason: 'local-dependency',
            depType: 'settings',
            datasource: 'maven',
            replaceString: '//my-processor',
            registryUrls,
          },
          {
            depName: '$libs.some.processor',
            skipReason: 'contains-variable',
            depType: 'settings',
            datasource: 'maven',
            replaceString: '$libs.some.processor',
            registryUrls,
          },
        ],
      });
    });

    it('extracts the dependency of a Kotlin compiler plugin', () => {
      const content = codeBlock`
        settings:
          kotlin:
            compilerPlugins:
              - id: com.example.plugin
                dependency: com.example:kotlin-plugin:1.0.0
                options:
                  key: value
              - id: com.example.shortcut
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'com.example:kotlin-plugin',
            currentValue: '1.0.0',
            depType: 'settings',
            datasource: 'maven',
            replaceString: 'com.example:kotlin-plugin:1.0.0',
            registryUrls,
          },
        ],
      });
    });

    it('extracts test-settings and platform-qualified settings', () => {
      const content = codeBlock`
        test-settings:
          ktor:
            version: 3.4.3
        settings@jvm:
          lombok:
            version: 1.18.46
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'io.ktor:ktor-bom',
            currentValue: '3.4.3',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'test-settings.ktor.version' },
            registryUrls,
          },
          {
            depName: 'org.projectlombok:lombok',
            currentValue: '1.18.46',
            depType: 'settings',
            datasource: 'maven',
            managerData: { settingPath: 'settings@jvm.lombok.version' },
            registryUrls,
          },
        ],
      });
    });

    it('skips a settings section that is not a map', () => {
      const content = codeBlock`
        settings: enabled

        dependencies:
          - org.example:lib:1.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.example:lib',
            currentValue: '1.0',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'org.example:lib:1.0',
            registryUrls,
          },
        ],
      });
    });

    it('returns settings and dependencies in document order', () => {
      const content = codeBlock`
        settings:
          ktor:
            version: 3.4.3

        dependencies:
          - org.example:lib:1.0
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps.map((dep) => dep.depName)).toEqual([
        'io.ktor:ktor-bom',
        'org.example:lib',
      ]);
    });

    it('extracts the project-level list of Maven plugins', () => {
      const content = codeBlock`
        modules:
          - app

        mavenPlugins:
          - org.apache.maven.plugins:maven-surefire-plugin:3.5.3
      `;

      expect(extractPackageFile(content, 'project.yaml')).toEqual({
        deps: [
          {
            depName: 'org.apache.maven.plugins:maven-surefire-plugin',
            currentValue: '3.5.3',
            depType: 'mavenPlugins',
            datasource: 'maven',
            replaceString:
              'org.apache.maven.plugins:maven-surefire-plugin:3.5.3',
            registryUrls,
          },
        ],
      });
    });

    it('extracts nothing from a Maven plugin goal without dependencies', () => {
      const content = codeBlock`
        product:
          type: jvm/app

        mavenPlugins:
          maven-surefire-plugin.test: enabled
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({ deps: [] });
    });

    it('extracts the dependencies of a Maven plugin goal', () => {
      const content = codeBlock`
        product:
          type: jvm/app

        mavenPlugins:
          maven-checkstyle-plugin.checkstyle:
            enabled: true
            dependencies:
              - io.spring.nohttp:nohttp-checkstyle:0.0.11
            configuration:
              includes: "**/*"
              configLocation: ./nohttp-checkstyle.xml
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'io.spring.nohttp:nohttp-checkstyle',
            currentValue: '0.0.11',
            depType: 'mavenPlugins',
            datasource: 'maven',
            replaceString: 'io.spring.nohttp:nohttp-checkstyle:0.0.11',
            registryUrls,
          },
        ],
      });
    });

    it('ignores versions found in a Maven plugin configuration', () => {
      const content = codeBlock`
        product:
          type: jvm/app

        dependencies:
          - com.google.protobuf:protobuf-kotlin:4.33.0

        mavenPlugins:
          protobuf-maven-plugin.generate:
            enabled: true
            configuration:
              protocVersion: 4.33.0
              toolArtifact: com.example:protoc-tool:1.0
              sourceDirectories: [ ./src ]
              kotlinEnabled: true

          protobuf-maven-plugin.generate-test:
            enabled: true
            configuration:
              protocVersion: 4.33.0
              sourceDirectories: [ ./test ]
              kotlinEnabled: true
              importPaths: [ ./src ]
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'com.google.protobuf:protobuf-kotlin',
            currentValue: '4.33.0',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'com.google.protobuf:protobuf-kotlin:4.33.0',
            registryUrls,
          },
        ],
      });
    });

    it('skips a mavenPlugins section that is neither a list nor a map', () => {
      const content = codeBlock`
        mavenPlugins: enabled

        dependencies:
          - org.example:lib:1.0
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.example:lib',
            currentValue: '1.0',
            depType: 'dependencies',
            datasource: 'maven',
            replaceString: 'org.example:lib:1.0',
            registryUrls,
          },
        ],
      });
    });

    it('defaults the repositories to Maven Central and Google Maven', () => {
      const content = codeBlock`
        dependencies:
          - org.example:lib:1.0
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps[0].registryUrls).toEqual([
        'https://repo.maven.apache.org/maven2',
        'https://maven.google.com',
      ]);
    });

    it('expands the well-known repository ids', () => {
      const content = codeBlock`
        repositories:
          - mavenCentral
          - mavenGoogle
          - google

        dependencies:
          - org.example:lib:1.0
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps[0].registryUrls).toEqual([
        'https://repo.maven.apache.org/maven2',
        'https://maven.google.com',
      ]);
    });

    it('skips the local Maven repository', () => {
      const content = codeBlock`
        repositories:
          - mavenLocal

        dependencies:
          - org.example:lib:1.0
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps[0].registryUrls).toEqual(registryUrls);
    });

    it('applies repositories declared after the dependencies', () => {
      const content = codeBlock`
        dependencies:
          - org.example:lib:1.0

        repositories:
          - https://repo.company.com/maven
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps[0].registryUrls).toEqual([
        ...registryUrls,
        'https://repo.company.com/maven',
      ]);
    });

    it('takes the url of a repository object and skips an unresolvable one', () => {
      const content = codeBlock`
        repositories:
          - id: internal
            url: https://repo.company.com/internal
          - id: staging
            url: https://repo.company.com/staging
            resolve: false
          - id: releases
            publish: true

        dependencies:
          - org.example:lib:1.0
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps[0].registryUrls).toEqual([
        ...registryUrls,
        'https://repo.company.com/internal',
      ]);
    });

    it('skips a repositories section that is not a list', () => {
      const content = codeBlock`
        repositories: mavenCentral

        dependencies:
          - org.example:lib:1.0
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps[0].registryUrls).toEqual(registryUrls);
    });

    it('adds the hot reload repository to the module repositories', () => {
      const content = codeBlock`
        repositories:
          - https://repo.company.com/maven

        settings:
          compose:
            version: 1.7.0
            experimental:
              hotReload:
                version: 1.0.0-beta05
      `;

      const res = extractPackageFile(content, 'module.yaml');

      expect(res?.deps).toEqual([
        {
          depName: 'org.jetbrains.compose.runtime:runtime',
          currentValue: '1.7.0',
          depType: 'settings',
          datasource: 'maven',
          managerData: { settingPath: 'settings.compose.version' },
          registryUrls: [...registryUrls, 'https://repo.company.com/maven'],
        },
        {
          depName: 'org.jetbrains.compose.hot-reload:hot-reload-runtime-api',
          currentValue: '1.0.0-beta05',
          depType: 'settings',
          datasource: 'maven',
          managerData: {
            settingPath: 'settings.compose.experimental.hotReload.version',
          },
          registryUrls: [
            ...registryUrls,
            'https://repo.company.com/maven',
            'https://packages.jetbrains.team/maven/p/amper/compose-hot-reload',
          ],
        },
      ]);
    });

    it('does not leak repositories of one file into the next', () => {
      const withRepositories = codeBlock`
        repositories:
          - https://repo.company.com/maven

        settings:
          compose:
            experimental:
              hotReload:
                version: 1.0.0-beta05
      `;
      const withoutRepositories = codeBlock`
        settings:
          compose:
            experimental:
              hotReload:
                version: 1.0.0-beta06
      `;

      extractPackageFile(withRepositories, 'first/module.yaml');
      const res = extractPackageFile(withoutRepositories, 'second/module.yaml');

      expect(res?.deps[0].registryUrls).toEqual([
        ...registryUrls,
        'https://packages.jetbrains.team/maven/p/amper/compose-hot-reload',
      ]);
    });

    it('keeps a module template that declares only an apply section', () => {
      const content = codeBlock`
        apply:
          - ../common.module-template.yaml
      `;

      expect(
        extractPackageFile(content, 'a/common.module-template.yaml'),
      ).toEqual({ deps: [] });
    });

    it('keeps a module file that declares only Maven plugins', () => {
      const content = codeBlock`
        mavenPlugins:
          - org.apache.maven.plugins:maven-surefire-plugin:3.5.3
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({
        deps: [
          {
            depName: 'org.apache.maven.plugins:maven-surefire-plugin',
            currentValue: '3.5.3',
            depType: 'mavenPlugins',
            datasource: 'maven',
            replaceString:
              'org.apache.maven.plugins:maven-surefire-plugin:3.5.3',
            registryUrls,
          },
        ],
      });
    });

    it('keeps a project file that declares only Maven plugins', () => {
      const content = codeBlock`
        mavenPlugins:
          - org.apache.maven.plugins:maven-surefire-plugin:3.5.3
      `;

      expect(extractPackageFile(content, 'project.yaml')).toEqual({
        deps: [
          {
            depName: 'org.apache.maven.plugins:maven-surefire-plugin',
            currentValue: '3.5.3',
            depType: 'mavenPlugins',
            datasource: 'maven',
            replaceString:
              'org.apache.maven.plugins:maven-surefire-plugin:3.5.3',
            registryUrls,
          },
        ],
      });
    });

    it('keeps a foreign file that carries a dependencies section', () => {
      const content = codeBlock`
        name: my-service
        dependencies:
          - some-service
      `;

      expect(extractPackageFile(content, 'module.yaml')).toEqual({ deps: [] });
    });

    it('keeps a module file that declares only a product', () => {
      expect(extractPackageFile('product: jvm/app\n', 'module.yaml')).toEqual({
        deps: [],
      });
    });

    it('returns null for a YAML file without Kotlin Toolchain keys', () => {
      const content = codeBlock`
        name: my-module
        version: 1.0.0
        main: index.js
      `;

      expect(extractPackageFile(content, 'module.yaml')).toBeNull();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        'Not a Kotlin Toolchain file: module.yaml',
      );
    });

    it('returns null for a project file without modules', () => {
      const content = codeBlock`
        name: my-project
        product: jvm/app
      `;

      expect(extractPackageFile(content, 'nested/project.yaml')).toBeNull();
    });

    it('returns null for an empty file', () => {
      expect(extractPackageFile('', 'module.yaml')).toBeNull();
    });

    it('returns null for a file that is not a YAML object', () => {
      expect(extractPackageFile('[not yaml', 'module.yaml')).toBeNull();
      expect(logger.logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ packageFile: 'module.yaml' }),
        'Failed to parse Kotlin Toolchain file',
      );
    });
  });
});

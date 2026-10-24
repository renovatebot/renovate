import { codeBlock } from 'common-tags';
import { Yaml } from '../../../util/schema-utils/index.ts';
import {
  KotlinToolchainCompilerPlugins,
  KotlinToolchainDependencies,
  KotlinToolchainFile,
  KotlinToolchainMavenPlugins,
  KotlinToolchainRepositories,
} from './schema.ts';

const Dependencies = Yaml.pipe(KotlinToolchainDependencies);
const MavenPlugins = Yaml.pipe(KotlinToolchainMavenPlugins);
const CompilerPlugins = Yaml.pipe(KotlinToolchainCompilerPlugins);
const Repositories = Yaml.pipe(KotlinToolchainRepositories);

describe('modules/manager/kotlin-toolchain/schema', () => {
  describe('KotlinToolchainDependencies', () => {
    it('reduces every dependency form to a coordinate', () => {
      const content = codeBlock`
        - io.ktor:ktor-client-core:2.2.0
        - com.h2database:h2: runtime-only
        - io.ktor:ktor-server-core:2.2.0:
            exported: true
            scope: compile-only
        - bom: io.ktor:ktor-bom:2.2.0
        - $libs.postgresql: runtime-only
      `;

      expect(Dependencies.parse(content)).toEqual([
        'io.ktor:ktor-client-core:2.2.0',
        'com.h2database:h2',
        'io.ktor:ktor-server-core:2.2.0',
        'io.ktor:ktor-bom:2.2.0',
        '$libs.postgresql',
      ]);
    });

    it('drops entries that are neither scalars nor single-key mappings', () => {
      const content = codeBlock`
        - org.example:lib:1.0
        - 42
        -
        - {}
        - { exported: true, scope: compile-only }
        - [org.example:lib:2.0]
      `;

      expect(Dependencies.parse(content)).toEqual(['org.example:lib:1.0']);
    });

    it('rejects a section that is not a list', () => {
      expect(Dependencies.safeParse('org.example:lib:1.0').success).toBe(false);
    });
  });

  describe('KotlinToolchainMavenPlugins', () => {
    it('parses the project-level list of plugin coordinates', () => {
      const content = codeBlock`
        - org.apache.maven.plugins:maven-surefire-plugin:3.5.3
        - org.jacoco:jacoco-maven-plugin:0.8.14
      `;

      expect(MavenPlugins.parse(content)).toEqual([
        'org.apache.maven.plugins:maven-surefire-plugin:3.5.3',
        'org.jacoco:jacoco-maven-plugin:0.8.14',
      ]);
    });

    it('collects coordinates from the module-level map of goals', () => {
      const content = codeBlock`
        maven-checkstyle-plugin.checkstyle:
          enabled: true
          dependencies:
            - io.spring.nohttp:nohttp-checkstyle:0.0.11
          configuration:
            includes: "**/*"
            configLocation: ./nohttp-checkstyle.xml
        protobuf-maven-plugin.generate:
          enabled: true
          configuration:
            protocVersion: 4.33.0
        maven-surefire-plugin.test: enabled
      `;

      expect(MavenPlugins.parse(content)).toEqual([
        'io.spring.nohttp:nohttp-checkstyle:0.0.11',
      ]);
    });

    it('rejects a section that is neither a list nor a map', () => {
      expect(MavenPlugins.safeParse('enabled').success).toBe(false);
    });
  });

  describe('KotlinToolchainCompilerPlugins', () => {
    it('keeps only the dependency of each plugin', () => {
      const content = codeBlock`
        - id: com.example.plugin
          dependency: com.example:kotlin-plugin:1.0.0
          options:
            key: value
        - id: com.example.shortcut
        - com.example:kotlin-plugin:2.0.0
      `;

      expect(CompilerPlugins.parse(content)).toEqual([
        'com.example:kotlin-plugin:1.0.0',
      ]);
    });

    it('rejects a section that is not a list', () => {
      expect(CompilerPlugins.safeParse('enabled').success).toBe(false);
    });
  });

  describe('KotlinToolchainRepositories', () => {
    it('reduces every repository form to a single value', () => {
      const content = codeBlock`
        - mavenCentral
        - https://repo.company.com/maven
        - id: internal
          url: https://repo.company.com/internal
          publish: true
      `;

      expect(Repositories.parse(content)).toEqual([
        'mavenCentral',
        'https://repo.company.com/maven',
        'https://repo.company.com/internal',
      ]);
    });

    it('nulls repositories that are excluded from resolution', () => {
      const content = codeBlock`
        - id: staging
          url: https://repo.company.com/staging
          resolve: false
        - url: https://repo.company.com/releases
          resolve: true
      `;

      expect(Repositories.parse(content)).toEqual([
        null,
        'https://repo.company.com/releases',
      ]);
    });

    it('drops entries without a url', () => {
      const content = codeBlock`
        - id: releases
          publish: true
        - 42
      `;

      expect(Repositories.parse(content)).toEqual([]);
    });

    it('rejects a section that is not a list', () => {
      expect(Repositories.safeParse('mavenCentral').success).toBe(false);
    });
  });

  describe('KotlinToolchainFile', () => {
    it('keeps unknown keys', () => {
      const content = codeBlock`
        product: jvm/app
        apply:
          - ../common.module-template.yaml
        aliases:
          jvmAndAndroid: [jvm, android]
      `;

      expect(KotlinToolchainFile.parse(content)).toEqual({
        product: 'jvm/app',
        apply: ['../common.module-template.yaml'],
        aliases: { jvmAndAndroid: ['jvm', 'android'] },
      });
    });

    it.each`
      content        | reason
      ${'[not yaml'} | ${'invalid YAML'}
      ${'- a\n- b'}  | ${'a list document'}
      ${'just text'} | ${'a scalar document'}
      ${''}          | ${'an empty document'}
    `('rejects $reason', ({ content }: { content: string }) => {
      expect(KotlinToolchainFile.safeParse(content).success).toBe(false);
    });
  });
});

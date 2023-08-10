import type { Preset } from '../types';
import * as monorepos from './monorepo';

const nonPinUpdateTypes = ['digest', 'patch', 'minor', 'major'];

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

const staticGroups = {
  all: {
    description: 'Group all updates together.',
    groupName: 'all dependencies',
    groupSlug: 'all',
    lockFileMaintenance: {
      enabled: false,
    },
    packageRules: [
      {
        groupName: 'all dependencies',
        groupSlug: 'all',
        matchPackagePatterns: ['*'],
      },
    ],

    separateMajorMinor: false,
  },
  allApollographql: {
    description: 'Group all packages published by Apollo GraphQL together.',
    packageRules: [
      {
        extends: 'packages:apollographql',
        groupName: 'Apollo GraphQL packages',
      },
    ],
  },
  allNonMajor: {
    description: 'Group all `minor` and `patch` updates together.',
    packageRules: [
      {
        groupName: 'all non-major dependencies',
        groupSlug: 'all-minor-patch',
        matchPackagePatterns: ['*'],
        matchUpdateTypes: ['minor', 'patch'],
      },
    ],
  },
  codemirror: {
    description: 'Group CodeMirror packages together.',
    packageRules: [
      {
        groupName: 'CodeMirror',
        matchPackagePrefixes: ['@codemirror/'],
      },
    ],
  },
  definitelyTyped: {
    description: 'Group all `@types` packages together.',
    packageRules: [
      {
        groupName: 'definitelyTyped',
        matchPackagePrefixes: ['@types/'],
      },
    ],
  },
  dotNetCore: {
    description: '.NET Core Docker containers.',
    packageRules: [
      {
        groupName: '.NET Core Docker containers',
        matchDatasources: ['docker'],
        matchPackagePrefixes: ['mcr.microsoft.com/dotnet/'],
      },
    ],
  },
  fortawesome: {
    description: 'Group all packages by Font Awesome together.',
    packageRules: [
      {
        groupName: 'Font Awesome',
        matchPackagePrefixes: ['@fortawesome/'],
      },
    ],
  },
  fusionjs: {
    description: 'Group Fusion.js packages together.',
    matchPackageNames: [
      'fusion-cli',
      'fusion-core',
      'fusion-test-utils',
      'fusion-tokens',
    ],
    matchPackagePrefixes: ['fusion-plugin-', 'fusion-react', '^usion-apollo'],
  },
  glimmer: {
    description: 'Group Glimmer.js packages together.',
    packageRules: [
      {
        groupName: 'Glimmer.js packages',
        groupSlug: 'glimmer',
        matchPackageNames: ['@glimmer/component', '@glimmer/tracking'],
      },
    ],
  },
  googleapis: {
    description: 'Group `googleapis` packages together.',
    packageRules: [
      {
        extends: 'packages:googleapis',
        groupName: 'googleapis packages',
      },
    ],
  },
  goOpenapi: {
    description: 'Group `go-openapi` packages together.',
    packageRules: [
      {
        groupName: 'go-openapi packages',
        groupSlug: 'go-openapi',
        matchDatasources: ['go'],
        matchPackagePrefixes: ['github.com/go-openapi/'],
      },
    ],
  },
  hibernateCommons: {
    description: 'Group Java Hibernate Commons packages.',
    packageRules: [
      {
        groupName: 'hibernate commons',
        matchPackagePrefixes: ['org.hibernate.common:'],
      },
    ],
  },
  hibernateCore: {
    description: 'Group Java Hibernate Core packages.',
    packageRules: [
      {
        groupName: 'hibernate core',
        matchPackagePrefixes: ['org.hibernate:'],
      },
    ],
  },
  hibernateOgm: {
    description: 'Group Java Hibernate OGM packages.',
    packageRules: [
      {
        groupName: 'hibernate ogm',
        matchPackagePrefixes: ['org.hibernate.ogm:'],
      },
    ],
  },
  hibernateValidator: {
    description: 'Group Java Hibernate Validator packages.',
    packageRules: [
      {
        groupName: 'hibernate validator',
        matchPackagePrefixes: ['org.hibernate.validator:'],
      },
    ],
  },
  illuminate: {
    description: 'Group PHP Illuminate packages together.',
    packageRules: [
      {
        groupName: 'illuminate packages',
        groupSlug: 'illuminate',
        matchPackagePrefixes: ['illuminate/'],
      },
    ],
  },
  jekyllEcosystem: {
    description: 'Group Jekyll and related Ruby packages together.',
    packageRules: [
      {
        groupName: 'jekyll ecosystem packages',
        matchSourceUrlPrefixes: [
          'https://github.com/jekyll/',
          'https://github.com/github/pages-gem',
        ],
      },
    ],
  },
  jestPlusTSJest: {
    description: 'Add `ts-jest` `major` update to Jest monorepo.',
    packageRules: [
      {
        groupName: 'jest monorepo',
        matchSourceUrls: ['https://github.com/kulshekhar/ts-jest'],
        matchUpdateTypes: ['major'],
      },
    ],
  },
  jestPlusTypes: {
    description: 'Add `@types/jest` update to Jest monorepo.',
    packageRules: [
      {
        groupName: 'jest monorepo',
        matchPackageNames: ['@types/jest'],
        matchUpdateTypes: nonPinUpdateTypes,
      },
    ],
  },
  jsTest: {
    description: 'Group JS test packages together.',
    packageRules: [
      {
        extends: 'packages:jsTest',
        groupName: 'JS test packages',
      },
    ],
  },
  jsTestNonMajor: {
    description: 'Group non-major JS test package updates together.',
    packageRules: [
      {
        extends: 'packages:jsTest',
        groupName: 'JS test packages',
        matchUpdateTypes: ['minor', 'patch'],
      },
    ],
  },
  jsUnitTest: {
    description: 'Group JavaScript unit test packages together.',
    packageRules: [
      {
        extends: 'packages:jsUnitTest',
        groupName: 'JS unit test packages',
      },
    ],
  },
  jsUnitTestNonMajor: {
    description:
      'Group JavaScipt unit test packages together for non-major updates.',
    packageRules: [
      {
        extends: 'packages:jsUnitTest',
        groupName: 'JS unit test packages',
        matchUpdateTypes: ['minor', 'patch'],
      },
    ],
  },
  jwtFramework: {
    description: 'Group JWT Framework packages together.',
    packageRules: [
      {
        groupName: 'JWT Framework packages',
        matchDatasources: ['packagist'],
        matchPackagePrefixes: ['web-token/'],
      },
    ],
  },
  kubernetes: {
    description: 'Group Kubernetes packages together.',
    packageRules: [
      {
        groupName: 'kubernetes packages',
        groupSlug: 'kubernetes-go',
        matchDatasources: ['go'],
        matchPackagePrefixes: [
          'k8s.io/api',
          'k8s.io/apiextensions-apiserver',
          'k8s.io/apimachinery',
          'k8s.io/apiserver',
          'k8s.io/cli-runtime',
          'k8s.io/client-go',
          'k8s.io/cloud-provider',
          'k8s.io/cluster-bootstrap',
          'k8s.io/code-generator',
          'k8s.io/component-base',
          'k8s.io/controller-manager',
          'k8s.io/cri-api',
          // 'k8s.io/csi-api', has not go.mod set up and does not follow the versioning of other repos
          'k8s.io/csi-translation-lib',
          'k8s.io/kube-aggregator',
          'k8s.io/kube-controller-manager',
          'k8s.io/kube-proxy',
          'k8s.io/kube-scheduler',
          'k8s.io/kubectl',
          'k8s.io/kubelet',
          'k8s.io/legacy-cloud-providers',
          'k8s.io/metrics',
          'k8s.io/mount-utils',
          'k8s.io/pod-security-admission',
          'k8s.io/sample-apiserver',
          'k8s.io/sample-cli-plugin',
          'k8s.io/sample-controller',
        ],
      },
    ],
  },
  linters: {
    description: 'Group various lint packages together.',
    packageRules: [
      {
        extends: 'packages:linters',
        groupName: 'linters',
      },
    ],
  },
  nodeJs: {
    description:
      "Group anything that looks like Node.js together so that it's updated together.",
    packageRules: [
      {
        commitMessageTopic: 'Node.js',
        excludePackageNames: ['calico/node', 'kindest/node'],
        matchDatasources: ['docker'],
        matchDepNames: ['node'],
        matchPackagePatterns: ['/node$'],
      },
    ],
  },
  phpstan: {
    description: 'Group PHPStan packages together.',
    packageRules: [
      {
        groupName: 'PHPStan packages',
        matchDatasources: ['packagist'],
        matchPackagePatterns: ['^phpstan/phpstan$', '/phpstan-'],
      },
    ],
  },
  polymer: {
    description: 'Group all `@polymer` packages together.',
    packageRules: [
      {
        groupName: 'polymer packages',
        matchPackagePrefixes: ['@polymer/'],
      },
    ],
  },
  postcss: {
    description: 'Group PostCSS packages together.',
    packageRules: [
      {
        extends: 'packages:postcss',
        groupName: 'postcss packages',
      },
    ],
  },
  react: {
    description: 'Group React and corresponding `@types` packages together.',
    packageRules: [
      {
        groupName: 'react monorepo',
        matchPackageNames: ['@types/react', '@types/react-dom'],
      },
    ],
  },
  recommended: {
    description:
      'Use curated list of recommended non-monorepo package groupings.',
    extends: [
      'group:nodeJs',
      'group:allApollographql',
      'group:codemirror',
      'group:fortawesome',
      'group:fusionjs',
      'group:glimmer',
      'group:goOpenapi',
      'group:hibernateCore',
      'group:hibernateValidator',
      'group:hibernateOgm',
      'group:hibernateCommons',
      'group:illuminate',
      'group:jekyllEcosystem',
      'group:jestPlusTSJest',
      'group:jestPlusTypes',
      'group:jwtFramework',
      'group:kubernetes',
      'group:phpstan',
      'group:polymer',
      'group:react',
      'group:resilience4j',
      'group:rubyOnRails',
      'group:rubyOmniauth',
      'group:socketio',
      'group:springAmqp',
      'group:springAndroid',
      'group:springBatch',
      'group:springBoot',
      'group:springCloud',
      'group:springCore',
      'group:springData',
      'group:springHateoas',
      'group:springIntegration',
      'group:springKafka',
      'group:springLdap',
      'group:springMobile',
      'group:springOsgi',
      'group:springRestDocs',
      'group:springRoo',
      'group:springScala',
      'group:springSecurity',
      'group:springSession',
      'group:springShell',
      'group:springSocial',
      'group:springStatemachine',
      'group:springWebflow',
      'group:springWs',
      'group:symfony',
    ],
    ignoreDeps: [], // Hack to improve onboarding PR description
  },
  resilience4j: {
    description: 'Group Java Resilience4j packages.',
    packageRules: [
      {
        groupName: 'resilience4j',
        matchPackagePrefixes: ['io.github.resilience4j:'],
      },
    ],
  },
  rubyOmniauth: {
    description: 'Group OmniAuth packages together.',
    packageRules: [
      {
        groupName: 'omniauth packages',
        matchDatasources: ['rubygems'],
        matchPackagePrefixes: ['omniauth'],
      },
    ],
  },
  rubyOnRails: {
    description: 'Group Ruby on Rails packages together.',
    packageRules: [
      {
        groupName: 'Ruby on Rails packages',
        matchDatasources: ['rubygems'],
        matchPackageNames: [
          'actioncable',
          'actionmailbox',
          'actionmailer',
          'actionpack',
          'actiontext',
          'actionview',
          'activejob',
          'activemodel',
          'activerecord',
          'activestorage',
          'activesupport',
          'railties',
          'rails',
        ],
      },
    ],
  },
  socketio: {
    description: 'Group socket.io packages.',
    packageRules: [
      {
        groupName: 'socket.io packages',
        matchPackagePrefixes: ['socket.io'],
      },
    ],
  },
  springAmqp: {
    description: 'Group Java Spring AMQP packages.',
    packageRules: [
      {
        groupName: 'spring amqp',
        matchPackagePrefixes: ['org.springframework.amqp:'],
      },
    ],
  },
  springAndroid: {
    description: 'Group Java Spring Android packages.',
    packageRules: [
      {
        groupName: 'spring android',
        matchPackagePrefixes: ['org.springframework.android:'],
      },
    ],
  },
  springBatch: {
    description: 'Group Java Spring Batch packages.',
    packageRules: [
      {
        groupName: 'spring batch',
        matchPackagePrefixes: ['org.springframework.batch:'],
      },
    ],
  },
  springBoot: {
    description: 'Group Java Spring Boot packages.',
    packageRules: [
      {
        groupName: 'spring boot',
        matchDepNames: ['org.springframework.boot'],
        matchPackagePrefixes: ['org.springframework.boot:'],
      },
    ],
  },
  springCloud: {
    description: 'Group Java Spring Cloud packages.',
    packageRules: [
      {
        groupName: 'spring cloud',
        matchPackagePrefixes: ['org.springframework.cloud:'],
      },
    ],
  },
  springCore: {
    description: 'Group Java Spring Core packages.',
    packageRules: [
      {
        groupName: 'spring core',
        matchPackagePrefixes: ['org.springframework:'],
      },
    ],
  },
  springData: {
    description: 'Group Java Spring Data packages.',
    packageRules: [
      {
        groupName: 'spring data',
        matchPackagePrefixes: ['org.springframework.data:'],
      },
    ],
  },
  springHateoas: {
    description: 'Group Java Spring HATEOAS packages.',
    packageRules: [
      {
        groupName: 'spring hateoas',
        matchPackagePrefixes: ['org.springframework.hateoas:'],
      },
    ],
  },
  springIntegration: {
    description: 'Group Java Spring Integration packages.',
    packageRules: [
      {
        groupName: 'spring integration',
        matchPackagePrefixes: ['org.springframework.integration:'],
      },
    ],
  },
  springKafka: {
    description: 'Group Java Spring Kafka packages.',
    packageRules: [
      {
        groupName: 'spring kafka',
        matchPackagePrefixes: ['org.springframework.kafka:'],
      },
    ],
  },
  springLdap: {
    description: 'Group Java Spring LDAP packages.',
    packageRules: [
      {
        groupName: 'spring ldap',
        matchPackagePrefixes: ['org.springframework.ldap:'],
      },
    ],
  },
  springMobile: {
    description: 'Group Java Spring Mobile packages.',
    packageRules: [
      {
        groupName: 'spring mobile',
        matchPackagePrefixes: ['org.springframework.mobile:'],
      },
    ],
  },
  springOsgi: {
    description: 'Group Java Spring OSGi packages.',
    packageRules: [
      {
        groupName: 'spring osgi',
        matchPackagePrefixes: ['org.springframework.osgi:'],
      },
    ],
  },
  springRestDocs: {
    description: 'Group Java Spring REST Docs packages.',
    packageRules: [
      {
        groupName: 'spring restdocs',
        matchPackagePrefixes: ['org.springframework.restdocs:'],
      },
    ],
  },
  springRoo: {
    description: 'Group Java Spring Roo packages.',
    packageRules: [
      {
        groupName: 'spring roo',
        matchPackagePrefixes: ['org.springframework.roo:'],
      },
    ],
  },
  springScala: {
    description: 'Group Java Spring Scala packages.',
    packageRules: [
      {
        groupName: 'spring scala',
        matchPackagePrefixes: ['org.springframework.scala:'],
      },
    ],
  },
  springSecurity: {
    description: 'Group Java Spring Security packages.',
    packageRules: [
      {
        groupName: 'spring security',
        matchPackagePrefixes: ['org.springframework.security:'],
      },
    ],
  },
  springSession: {
    description: 'Group Java Spring Session packages.',
    packageRules: [
      {
        groupName: 'spring session',
        matchPackagePrefixes: ['org.springframework.session:'],
      },
    ],
  },
  springShell: {
    description: 'Group Java Spring Shell packages.',
    packageRules: [
      {
        groupName: 'spring shell',
        matchPackagePrefixes: ['org.springframework.shell:'],
      },
    ],
  },
  springSocial: {
    description: 'Group Java Spring Social packages.',
    packageRules: [
      {
        groupName: 'spring social',
        matchPackagePrefixes: ['org.springframework.social:'],
      },
    ],
  },
  springStatemachine: {
    description: 'Group Java Spring Statemachine packages.',
    packageRules: [
      {
        groupName: 'spring statemachine',
        matchPackagePrefixes: ['org.springframework.statemachine:'],
      },
    ],
  },
  springWebflow: {
    description: 'Group Java Spring WebFlow packages.',
    packageRules: [
      {
        groupName: 'spring webflow',
        matchPackagePrefixes: ['org.springframework.webflow:'],
      },
    ],
  },
  springWs: {
    description: 'Group Java Spring WS packages.',
    packageRules: [
      {
        groupName: 'spring ws',
        matchPackagePrefixes: ['org.springframework.ws:'],
      },
    ],
  },
  symfony: {
    description: 'Group PHP Symfony packages together.',
    packageRules: [
      {
        groupName: 'symfony packages',
        groupSlug: 'symfony',
        matchPackagePrefixes: ['symfony/'],
      },
    ],
  },
  test: {
    description: 'Group all test packages together.',
    packageRules: [
      {
        extends: 'packages:test',
        groupName: 'test packages',
      },
    ],
  },
  testNonMajor: {
    description: 'Group all non-major test package updates together.',
    packageRules: [
      {
        extends: 'packages:test',
        groupName: 'test packages',
        matchUpdateTypes: ['minor', 'patch'],
      },
    ],
  },
  unitTest: {
    description: 'Group all unit test packages together.',
    packageRules: [
      {
        extends: 'packages:unitTest',
        groupName: 'unit test packages',
      },
    ],
  },
  unitTestNonMajor: {
    description: 'Group all unit test packages together for non-major updates.',
    packageRules: [
      {
        extends: 'packages:unitTest',
        groupName: 'unit test packages',
        matchUpdateTypes: ['minor', 'patch'],
      },
    ],
  },
};

const config: any = { ...staticGroups };

const monorepoNames = [];
for (const monorepo of Object.keys(monorepos.presets)) {
  const name = `${monorepo}Monorepo`;
  monorepoNames.push(`group:${name}`);
  config[name] = {
    packageRules: [
      {
        description: `Group packages from ${monorepo} monorepo together.`,
        extends: `monorepo:${monorepo}`,
        groupName: `${monorepo} monorepo`,
        matchUpdateTypes: nonPinUpdateTypes,
      },
    ],
  };
}
config.monorepos = {
  description: 'Group known monorepo packages together.',
  extends: monorepoNames,
  ignoreDeps: [], // Hack to improve onboarding PR description
};

export const presets: Record<string, Preset> = config;

import type { Preset } from '../types';
import * as monorepos from './monorepo';

const nonPinUpdateTypes = ['digest', 'patch', 'minor', 'major'];

const staticGroups = {
  all: {
    description: 'Group all updates together.',
    groupName: 'all dependencies',
    separateMajorMinor: false,
    groupSlug: 'all',
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        groupName: 'all dependencies',
        groupSlug: 'all',
      },
    ],
    lockFileMaintenance: {
      enabled: false,
    },
  },
  allNonMajor: {
    description: 'Group all `minor` and `patch` updates together.',
    packageRules: [
      {
        matchPackagePatterns: ['*'],
        matchUpdateTypes: ['minor', 'patch'],
        groupName: 'all non-major dependencies',
        groupSlug: 'all-minor-patch',
      },
    ],
  },
  nodeJs: {
    description:
      "Group anything that looks like Node.js together so that it's updated together.",
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchPackageNames: ['node'],
        matchPackagePatterns: ['/node$'],
        excludePackageNames: ['calico/node', 'kindest/node'],
        commitMessageTopic: 'Node.js',
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
      'group:kubernetes',
      'group:phpstan',
      'group:polymer',
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
    ignoreDeps: [],
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
        matchDatasources: ['docker'],
        matchPackagePrefixes: ['mcr.microsoft.com/dotnet/'],
        groupName: '.NET Core Docker containers',
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
  illuminate: {
    description: 'Group PHP Illuminate packages together.',
    packageRules: [
      {
        matchPackagePrefixes: ['illuminate/'],
        groupName: 'illuminate packages',
        groupSlug: 'illuminate',
      },
    ],
  },
  symfony: {
    description: 'Group PHP Symfony packages together.',
    packageRules: [
      {
        matchPackagePrefixes: ['symfony/'],
        groupName: 'symfony packages',
        groupSlug: 'symfony',
      },
    ],
  },
  phpstan: {
    description: 'Group PHPStan packages together.',
    packageRules: [
      {
        matchDatasources: ['packagist'],
        matchPackagePatterns: ['^phpstan\\/phpstan$', '\\/phpstan-'],
        groupName: 'PHPStan packages',
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
  hibernateCore: {
    description: 'Group Java Hibernate Core packages.',
    packageRules: [
      {
        matchPackagePrefixes: ['org.hibernate:'],
        groupName: 'hibernate core',
      },
    ],
  },
  hibernateValidator: {
    description: 'Group Java Hibernate Validator packages.',
    packageRules: [
      {
        matchPackagePrefixes: ['org.hibernate.validator:'],
        groupName: 'hibernate validator',
      },
    ],
  },
  hibernateOgm: {
    description: 'Group Java Hibernate OGM packages.',
    packageRules: [
      {
        matchPackagePrefixes: ['org.hibernate.ogm:'],
        groupName: 'hibernate ogm',
      },
    ],
  },
  hibernateCommons: {
    description: 'Group Java Hibernate Commons packages.',
    packageRules: [
      {
        matchPackagePrefixes: ['org.hibernate.common:'],
        groupName: 'hibernate commons',
      },
    ],
  },
  resilience4j: {
    description: 'Group Java Resilience4j packages.',
    packageRules: [
      {
        matchPackagePrefixes: ['io.github.resilience4j:'],
        groupName: 'resilience4j',
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
        matchPackagePrefixes: ['org.springframework.boot:'],
        matchPackageNames: ['org.springframework.boot'],
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
  socketio: {
    description: 'Group socket.io packages.',
    packageRules: [
      {
        groupName: 'socket.io packages',
        matchPackagePrefixes: ['socket.io'],
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
  jekyllEcosystem: {
    description: 'Group Jekyll and related Ruby packages together.',
    packageRules: [
      {
        matchSourceUrlPrefixes: [
          'https://github.com/jekyll/',
          'https://github.com/github/pages-gem',
        ],
        groupName: 'jekyll ecosystem packages',
      },
    ],
  },
  rubyOnRails: {
    description: 'Group Ruby on Rails packages together.',
    packageRules: [
      {
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
        groupName: 'Ruby on Rails packages',
      },
    ],
  },
  rubyOmniauth: {
    description: 'Group OmniAuth packages together.',
    packageRules: [
      {
        matchDatasources: ['rubygems'],
        matchPackagePrefixes: ['omniauth'],
        groupName: 'omniauth packages',
      },
    ],
  },
  goOpenapi: {
    description: 'Group `go-openapi` packages together.',
    packageRules: [
      {
        matchDatasources: ['go'],
        groupName: 'go-openapi packages',
        groupSlug: 'go-openapi',
        matchPackagePrefixes: ['github.com/go-openapi/'],
      },
    ],
  },
  kubernetes: {
    description: 'Group Kubernetes packages together.',
    packageRules: [
      {
        matchDatasources: ['go'],
        groupName: 'kubernetes packages',
        groupSlug: 'kubernetes-go',
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
  googleapis: {
    description: 'Group `googleapis` packages together.',
    packageRules: [
      {
        extends: 'packages:googleapis',
        groupName: 'googleapis packages',
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
        matchUpdateTypes: ['minor', 'patch'],
        groupName: 'JS unit test packages',
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
        matchUpdateTypes: ['minor', 'patch'],
        groupName: 'unit test packages',
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
  jsTestMonMajor: {
    description: 'Group non-major JS test package updates together.',
    packageRules: [
      {
        extends: 'packages:jsTest',
        matchUpdateTypes: ['minor', 'patch'],
        groupName: 'JS test packages',
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
        matchUpdateTypes: ['minor', 'patch'],
        groupName: 'test packages',
      },
    ],
  },
  jestPlusTSJest: {
    description: 'Add `ts-jest` `major` update to Jest monorepo.',
    packageRules: [
      {
        matchSourceUrlPrefixes: ['https://github.com/kulshekhar/ts-jest'],
        matchUpdateTypes: ['major'],
        groupName: 'jest monorepo',
      },
    ],
  },
  jestPlusTypes: {
    description: 'Add `@types/jest` update to Jest monorepo.',
    packageRules: [
      {
        matchPackageNames: ['@types/jest'],
        matchUpdateTypes: nonPinUpdateTypes,
        groupName: 'jest monorepo',
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
        matchUpdateTypes: nonPinUpdateTypes,
        groupName: `${monorepo} monorepo`,
      },
    ],
  };
}
config.monorepos = {
  description: 'Group known monorepo packages together.',
  ignoreDeps: [],
  extends: monorepoNames,
};

export const presets: Record<string, Preset> = config;

import type { Preset } from '../types';

/* eslint sort-keys: ["error", "asc", {caseSensitive: false, natural: true}] */

export const presets: Record<string, Preset> = {
  all: {
    description: [
      'Apply crowd-sourced workarounds for known problems with packages.',
    ],
    extends: [
      'workarounds:mavenCommonsAncientVersion',
      'workarounds:ignoreSpringCloudNumeric',
      'workarounds:ignoreWeb3jCoreWithOldReleaseTimestamp',
      'workarounds:ignoreHttp4sDigestMilestones',
      'workarounds:typesNodeVersioning',
      'workarounds:nodeDockerVersioning',
      'workarounds:doNotUpgradeFromAlpineStableToEdge',
      'workarounds:supportRedHatImageVersion',
      'workarounds:javaLTSVersions',
      'workarounds:disableEclipseLifecycleMapping',
      'workarounds:disableMavenParentRoot',
      'workarounds:containerbase',
      'workarounds:bitnamiDockerImageVersioning',
      'workarounds:k3sKubernetesVersioning',
      'workarounds:rke2KubernetesVersioning',
      'workarounds:libericaJdkDockerVersioning',
      'workarounds:ubuntuDockerVersioning',
    ],
    ignoreDeps: [], // Hack to improve onboarding PR description
  },
  bitnamiDockerImageVersioning: {
    description: 'Use custom regex versioning for bitnami images',
    packageRules: [
      {
        matchCurrentValue:
          '/^(?<major>\\d+)(?:\\.(?<minor>\\d+)(?:\\.(?<patch>\\d+))?)?-(?<compatibility>.+)-(?<build>\\d+)(?:-r(?<revision>\\d+))?$/',
        matchDatasources: ['docker'],
        matchPackageNames: [
          'bitnami/**',
          'docker.io/bitnami/**',
          'gcr.io/bitnami-containers/**',
        ],
        versioning:
          'regex:^(?<major>\\d+)(?:\\.(?<minor>\\d+)(?:\\.(?<patch>\\d+))?)?(:?-(?<compatibility>.+)-(?<build>\\d+)(?:-r(?<revision>\\d+))?)?$',
      },
    ],
  },
  containerbase: {
    description: 'Add some containerbase overrides.',
    packageRules: [
      {
        description:
          'Use node versioning for `(containerbase|renovate)/node` images',
        matchDatasources: ['docker'],
        matchPackageNames: [
          '/^(?:(?:docker|ghcr)\\.io/)?(?:containerbase|renovate)/node$/',
        ],
        versioning: 'node',
      },
    ],
  },
  disableEclipseLifecycleMapping: {
    description: 'Disable Eclipse m2e lifecycle-mapping placeholder package.',
    packageRules: [
      {
        enabled: false,
        matchDatasources: ['maven'],
        matchPackageNames: ['org.eclipse.m2e:lifecycle-mapping'],
      },
    ],
  },
  disableMavenParentRoot: {
    description:
      'Avoid version fetching for Maven packages detected as project root.',
    packageRules: [
      {
        enabled: false,
        matchDepTypes: ['parent-root'],
        matchManagers: ['maven'],
      },
    ],
  },
  doNotUpgradeFromAlpineStableToEdge: {
    description: 'Do not upgrade from Alpine stable to edge.',
    packageRules: [
      {
        allowedVersions: '<20000000',
        matchCurrentVersion: '!/^\\d{8}$/',
        matchDatasources: ['docker'],
        matchDepNames: ['alpine'],
      },
      {
        allowedVersions: '<20000000',
        matchCurrentVersion: '!/^\\d{8}$/',
        matchDatasources: ['docker'],
        matchPackageNames: ['alpine'],
      },
    ],
  },
  ignoreHttp4sDigestMilestones: {
    description: 'Ignore `http4s` digest-based `1.x` milestones.',
    packageRules: [
      {
        allowedVersions: `!/^1\\.0-\\d+-[a-fA-F0-9]{7}$/`,
        matchManagers: ['sbt'],
        matchPackageNames: ['org.http4s:**'],
      },
    ],
  },
  ignoreSpringCloudNumeric: {
    description: 'Ignore spring cloud `1.x` releases.',
    packageRules: [
      {
        allowedVersions: '/^[A-Z]/',
        matchDatasources: ['maven'],
        matchPackageNames: [
          'org.springframework.cloud:spring-cloud-starter-parent',
        ],
      },
    ],
  },
  ignoreWeb3jCoreWithOldReleaseTimestamp: {
    description: 'Ignore `web3j` `5.0.0` release.',
    packageRules: [
      {
        allowedVersions: '!/^5\\.0\\.0/',
        matchDatasources: ['maven'],
        matchPackageNames: ['org.web3j:core'],
      },
    ],
  },
  javaLTSVersions: {
    description: 'Limit Java runtime versions to LTS releases.',
    packageRules: [
      {
        allowedVersions: '/^(?:8|11|17|21)(?:\\.|-|$)/',
        description:
          'Limit Java runtime versions to LTS releases. To receive all major releases add `workarounds:javaLTSVersions` to the `ignorePresets` array.',
        matchDatasources: ['docker', 'java-version'],
        matchPackageNames: [
          'eclipse-temurin',
          'amazoncorretto',
          'adoptopenjdk',
          'openjdk',
          'java',
          'java-jre',
          'sapmachine',
          '/^azul/zulu-openjdk/',
          '/^bellsoft/liberica-openj(dk|re)-/',
          '/^cimg/openjdk/',
        ],
        versioning:
          'regex:^(?<major>\\d+)?(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?([\\._+](?<build>(\\d\\.?)+)(LTS)?)?(-(?<compatibility>.*))?$',
      },
      {
        allowedVersions: '/^(?:8|11|17|21)(?:\\.|-|$)/',
        description:
          'Limit Java runtime versions to LTS releases. To receive all major releases add `workarounds:javaLTSVersions` to the `ignorePresets` array.',
        matchDatasources: ['docker', 'java-version'],
        matchDepNames: [
          'eclipse-temurin',
          'amazoncorretto',
          'adoptopenjdk',
          'openjdk',
          'java',
          'java-jre',
          'sapmachine',
        ],
        versioning:
          'regex:^(?<major>\\d+)?(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?([\\._+](?<build>(\\d\\.?)+)(LTS)?)?(-(?<compatibility>.*))?$',
      },
      {
        allowedVersions: '/^(?:jdk|jdk-all|jre)-(?:8|11|17|21)(?:\\.|-|$)/',
        description:
          'Limit Java runtime versions to LTS releases. To receive all major releases add `workarounds:javaLTSVersions` to the `ignorePresets` array.',
        matchDatasources: ['docker'],
        matchPackageNames: ['bellsoft/liberica-runtime-container'],
      },
    ],
  },
  k3sKubernetesVersioning: {
    description: 'Use custom regex versioning for k3s-io/k3s',
    packageRules: [
      {
        matchDatasources: ['github-releases'],
        matchPackageNames: ['k3s-io/k3s'],
        versioning:
          'regex:^v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:-(?<prerelease>[a-z]+\\d+))?(?<compatibility>\\+k3s)(?<build>\\d+)$',
      },
    ],
  },
  libericaJdkDockerVersioning: {
    description:
      'Use custom regex versioning for bellsoft/liberica-runtime-container',
    packageRules: [
      {
        description: 'Liberica JDK Lite version optimized for the Cloud',
        matchCurrentValue: '/^jdk-[^a][^l]{2}/',
        matchDatasources: ['docker'],
        matchPackageNames: ['bellsoft/liberica-runtime-container'],
        versioning:
          'regex:^jdk-(?<major>\\d+)?(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?([\\._+](?<build>(\\d\\.?)+))?(-(?<compatibility>.*))?$',
      },
      {
        description:
          'Liberica JDK that can be used to create a custom runtime with a help of jlink tool',
        matchCurrentValue: '/^jdk-all/',
        matchDatasources: ['docker'],
        matchPackageNames: ['bellsoft/liberica-runtime-container'],
        versioning:
          'regex:^jdk-all-(?<major>\\d+)?(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?([\\._+](?<build>(\\d\\.?)+))?(-(?<compatibility>.*))?$',
      },
      {
        description:
          'Liberica JRE (only the runtime without the rest of JDK tools) for running Java applications',
        matchCurrentValue: '/^jre-/',
        matchDatasources: ['docker'],
        matchPackageNames: ['bellsoft/liberica-runtime-container'],
        versioning:
          'regex:^jre-(?<major>\\d+)?(\\.(?<minor>\\d+))?(\\.(?<patch>\\d+))?([\\._+](?<build>(\\d\\.?)+))?(-(?<compatibility>.*))?$',
      },
    ],
  },
  mavenCommonsAncientVersion: {
    description: 'Fix some problems with very old Maven commons versions.',
    packageRules: [
      {
        allowedVersions: '!/^200\\d{5}(\\.\\d+)?/',
        matchDatasources: ['maven', 'sbt-package'],
        matchPackageNames: ['commons-**'],
      },
    ],
  },
  nodeDockerVersioning: {
    description: 'Use node versioning for `node` docker images.',
    packageRules: [
      {
        matchDatasources: ['docker'],
        // copied from https://github.com/renovatebot/renovate/blob/a471762e137619c06e73a678d6b63ca984da7dba/lib/config/presets/internal/group.ts#L351
        matchPackageNames: [
          '/(?:^|/)node$/', // node or ends with "/node, except those below"
          '!calico/node',
          '!docker.io/calico/node',
          '!kindest/node',
        ],
        versionCompatibility: '^(?<version>[^-]+)(?<compatibility>-.*)?$',
        versioning: 'node',
      },
    ],
  },
  rke2KubernetesVersioning: {
    description: 'Use custom regex versioning for rancher/rke2',
    packageRules: [
      {
        matchDatasources: ['github-releases'],
        matchPackageNames: ['rancher/rke2'],
        versioning:
          'regex:^v(?<major>\\d+)\\.(?<minor>\\d+)\\.(?<patch>\\d+)(?:-(?<prerelease>[a-z]+\\d+))?(?<compatibility>\\+rke2r)(?<build>\\d+)$',
      },
    ],
  },
  supportRedHatImageVersion: {
    description:
      'Use specific versioning for Red Hat-maintained container images.',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchPackageNames: [
          'registry.access.redhat.com/rhel',
          'registry.access.redhat.com/rhel-atomic',
          'registry.access.redhat.com/rhel-init',
          'registry.access.redhat.com/rhel-minimal',
          'registry.access.redhat.com/rhceph/**',
          'registry.access.redhat.com/rhgs3/**',
          'registry.access.redhat.com/rhel7**',
          'registry.access.redhat.com/rhel8/**',
          'registry.access.redhat.com/rhel9/**',
          'registry.access.redhat.com/rhscl/**',
          'registry.access.redhat.com/ubi*{,/}**',
          'redhat/**',
        ],
        versioning: 'redhat',
      },
    ],
  },
  typesNodeVersioning: {
    description: 'Use node versioning for `@types/node`.',
    packageRules: [
      {
        matchManagers: ['npm'],
        matchPackageNames: ['@types/node'],
        versioning: `node`,
      },
    ],
  },
  ubuntuDockerVersioning: {
    description: 'Use ubuntu versioning for `ubuntu` docker images.',
    packageRules: [
      {
        matchDatasources: ['docker'],
        matchDepNames: ['ubuntu'],
        versioning: 'ubuntu',
      },
    ],
  },
};

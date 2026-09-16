import { GithubReleasesDatasource } from '../../../datasource/github-releases/index.ts';
import * as condaVersioning from '../../../versioning/conda/index.ts';
import * as nodeVersioning from '../../../versioning/node/index.ts';
import * as npmVersioning from '../../../versioning/npm/index.ts';
import type { KnownActionConfig } from '../types.ts';
import { actionsVersionsExtractVersion, valSchema } from './utils.ts';

export const githubReleasesActions: Record<string, KnownActionConfig> = {
  // https://github.com/actions/setup-go
  'actions/setup-go': {
    datasource: GithubReleasesDatasource.id,
    depName: 'go',
    packageName: 'actions/go-versions',
    versioning: npmVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('go-version'),
  },
  // https://github.com/actions/setup-node
  'actions/setup-node': {
    datasource: GithubReleasesDatasource.id,
    depName: 'node',
    packageName: 'actions/node-versions',
    versioning: nodeVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('node-version'),
  },
  // https://github.com/actions/setup-python
  'actions/setup-python': {
    datasource: GithubReleasesDatasource.id,
    depName: 'python',
    packageName: 'actions/python-versions',
    versioning: npmVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('python-version'),
  },
  // https://github.com/aquaproj/aqua-installer
  'aquaproj/aqua-installer': {
    datasource: GithubReleasesDatasource.id,
    depName: 'aqua',
    packageName: 'aquaproj/aqua',
    withSchema: valSchema('aqua_version'),
  },
  // https://github.com/aquasecurity/setup-trivy
  'aquasecurity/setup-trivy': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'aquasecurity/trivy',
  },
  // https://github.com/aquasecurity/trivy-action
  'aquasecurity/trivy-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'aquasecurity/trivy',
  },
  // https://github.com/astral-sh/ruff-action
  'astral-sh/ruff-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'ruff',
    packageName: 'astral-sh/ruff',
  },
  // https://github.com/astral-sh/setup-uv
  'astral-sh/setup-uv': {
    datasource: GithubReleasesDatasource.id,
    versioning: npmVersioning.id,
    packageName: 'astral-sh/uv',
  },
  'azure/setup-helm': {
    datasource: GithubReleasesDatasource.id,
    depName: 'helm',
    packageName: 'helm/helm',
  },
  // https://github.com/azure/setup-kubectl
  'azure/setup-kubectl': {
    datasource: GithubReleasesDatasource.id,
    depName: 'kubectl',
    packageName: 'kubernetes/kubernetes',
  },
  // https://github.com/bufbuild/buf-setup-action
  'bufbuild/buf-setup-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'buf',
    packageName: 'bufbuild/buf',
  },
  // https://github.com/cargo-bins/cargo-binstall
  'cargo-bins/cargo-binstall': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'cargo-bins/cargo-binstall',
    // the repo also publishes releases for its internal sub-crates (e.g.
    // `detect-targets-v0.1.91`, `binstalk-v0.28.81`) — only match the bare
    // main-tool release tag
    extractVersion: '^v(?<version>\\d+\\.\\d+\\.\\d+)$',
  },
  // https://github.com/cue-lang/setup-cue
  'cue-lang/setup-cue': {
    datasource: GithubReleasesDatasource.id,
    depName: 'cue',
    packageName: 'cue-lang/cue',
  },
  // https://github.com/dagger/dagger-for-github
  'dagger/dagger-for-github': {
    datasource: GithubReleasesDatasource.id,
    depName: 'dagger',
    packageName: 'dagger/dagger',
    // the repo also publishes per-SDK/component tags sharing the same
    // version (e.g. `sdk/typescript/v0.21.9`, `helm/chart/v0.21.9`) — only
    // match the bare release tag
    extractVersion: '^v(?<version>\\d+\\..*)$',
  },
  // https://github.com/docker/setup-buildx-action
  'docker/setup-buildx-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'buildx',
    packageName: 'docker/buildx',
  },
  // https://github.com/docker/setup-compose-action
  'docker/setup-compose-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'docker/compose',
  },
  // https://github.com/docker/setup-docker-action
  'docker/setup-docker-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'docker',
    packageName: 'moby/moby',
    extractVersion: '^docker-(?<version>.+)$',
  },
  // https://github.com/extractions/setup-just
  'extractions/setup-just': {
    datasource: GithubReleasesDatasource.id,
    depName: 'just',
    packageName: 'casey/just',
    withSchema: valSchema('just-version'),
  },
  // https://github.com/foundry-rs/foundry-toolchain
  'foundry-rs/foundry-toolchain': {
    datasource: GithubReleasesDatasource.id,
    depName: 'foundry',
    packageName: 'foundry-rs/foundry',
  },
  // https://github.com/GitTools/actions (there is no root-level Action, only
  // subpaths are usable; the sibling `GitTools/actions/gitreleasemanager/setup`
  // is a separate, unrelated Action)
  'GitTools/actions/gitversion/setup': {
    datasource: GithubReleasesDatasource.id,
    depName: 'gitversion',
    packageName: 'GitTools/GitVersion',
    // `versionSpec` is documented as "the form of 6.8.x or exact version
    // like 6.0.0", so it may be a range
    versioning: npmVersioning.id,
    withSchema: valSchema('versionSpec'),
  },
  'golangci/golangci-lint-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'golangci/golangci-lint',
  },
  // https://github.com/goreleaser/goreleaser-action
  'goreleaser/goreleaser-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'goreleaser/goreleaser',
    // the default value (`~> v2`) is itself a range, not a pinned version
    versioning: npmVersioning.id,
  },
  // https://github.com/hashicorp/setup-packer
  'hashicorp/setup-packer': {
    datasource: GithubReleasesDatasource.id,
    depName: 'packer',
    packageName: 'hashicorp/packer',
  },
  // https://github.com/hashicorp/setup-terraform
  'hashicorp/setup-terraform': {
    datasource: GithubReleasesDatasource.id,
    depName: 'terraform',
    packageName: 'hashicorp/terraform',
    // `terraform_version` may be a constraint string (e.g. `<1.2.0`,
    // `~1.1.0`) rather than a full version
    versioning: npmVersioning.id,
    withSchema: valSchema('terraform_version'),
  },
  // https://github.com/helm/chart-releaser-action
  'helm/chart-releaser-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'chart-releaser',
    packageName: 'helm/chart-releaser',
  },
  // https://github.com/helm/chart-testing-action
  'helm/chart-testing-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'chart-testing',
    packageName: 'helm/chart-testing',
  },
  // https://github.com/j178/prek-action
  'j178/prek-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'prek',
    packageName: 'j178/prek',
    // the value may be a semver range (e.g. `0.3.x`, `<=1.0.0`), not just a
    // pinned version
    versioning: npmVersioning.id,
    withSchema: valSchema('prek-version'),
  },
  // https://github.com/jfrog/setup-jfrog-cli
  'jfrog/setup-jfrog-cli': {
    datasource: GithubReleasesDatasource.id,
    depName: 'jfrog-cli',
    packageName: 'jfrog/jfrog-cli',
  },
  // https://github.com/julia-actions/setup-julia
  'julia-actions/setup-julia': {
    datasource: GithubReleasesDatasource.id,
    depName: 'julia',
    packageName: 'JuliaLang/julia',
    // the action resolves `version` with node's semver package, so the value
    // may be a partial version (e.g. `1.10`) or a range (e.g. `^1.6`) rather
    // than a pinned version
    versioning: npmVersioning.id,
  },
  // https://github.com/jwlawson/actions-setup-cmake
  'jwlawson/actions-setup-cmake': {
    datasource: GithubReleasesDatasource.id,
    depName: 'cmake',
    packageName: 'Kitware/CMake',
    // `cmake-version` may be partly specified (e.g. `3.2`) or a wildcard
    // (e.g. `3.2.x`) rather than a full version
    versioning: npmVersioning.id,
    withSchema: valSchema('cmake-version'),
  },
  // https://github.com/mozilla-actions/sccache-action
  'mozilla-actions/sccache-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'sccache',
    packageName: 'mozilla/sccache',
  },
  // https://github.com/opentofu/setup-opentofu
  'opentofu/setup-opentofu': {
    datasource: GithubReleasesDatasource.id,
    depName: 'opentofu',
    packageName: 'opentofu/opentofu',
    // as with `hashicorp/setup-terraform` above, `tofu_version` may be a
    // constraint string rather than a full version
    versioning: npmVersioning.id,
    withSchema: valSchema('tofu_version'),
  },
  // https://github.com/peaceiris/actions-hugo
  'peaceiris/actions-hugo': {
    datasource: GithubReleasesDatasource.id,
    depName: 'hugo',
    packageName: 'gohugoio/hugo',
    withSchema: valSchema('hugo-version'),
  },
  'prefix-dev/setup-pixi': {
    datasource: GithubReleasesDatasource.id,
    versioning: condaVersioning.id,
    packageName: 'prefix-dev/pixi',
    withSchema: valSchema('pixi-version'),
  },
  // https://github.com/pulumi/actions
  'pulumi/actions': {
    datasource: GithubReleasesDatasource.id,
    depName: 'pulumi',
    packageName: 'pulumi/pulumi',
    withSchema: valSchema('pulumi-version'),
  },
  // https://github.com/pypa/hatch/tree/install
  'pypa/hatch': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'pypa/hatch',
    // Strip hatch- prefix from release tags
    extractVersion: '^hatch-(?<version>.+)$',
  },
  // https://github.com/raven-actions/actionlint
  'raven-actions/actionlint': {
    datasource: GithubReleasesDatasource.id,
    depName: 'actionlint',
    packageName: 'rhysd/actionlint',
  },
  // https://github.com/reviewdog/action-setup
  'reviewdog/action-setup': {
    datasource: GithubReleasesDatasource.id,
    depName: 'reviewdog',
    packageName: 'reviewdog/reviewdog',
    withSchema: valSchema('reviewdog_version'),
  },
  'sigstore/cosign-installer': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'sigstore/cosign',
    withSchema: valSchema('cosign-release'),
  },
  // https://github.com/stCarolas/setup-maven
  'stCarolas/setup-maven': {
    datasource: GithubReleasesDatasource.id,
    depName: 'maven',
    packageName: 'apache/maven',
    // apache/maven tags its releases as `maven-X.Y.Z`
    extractVersion: '^maven-(?<version>.+)$',
    // the input also documents range/glob specs (e.g. `10.x`, `>=10.15.0`),
    // not just pinned versions
    versioning: npmVersioning.id,
    withSchema: valSchema('maven-version'),
  },
  // https://github.com/subosito/flutter-action
  'subosito/flutter-action': {
    datasource: GithubReleasesDatasource.id,
    depName: 'flutter',
    packageName: 'flutter/flutter',
    // `flutter-version` may be an x-range (e.g. `3.x`, `1.22.x`) used to
    // pick the latest release of that line, rather than a full version
    versioning: npmVersioning.id,
    withSchema: valSchema('flutter-version'),
  },
  // https://github.com/superfly/flyctl-actions (there is no root-level
  // Action for this purpose — the repo root has an unrelated action.yml, and
  // the real usable Action lives at the `setup-flyctl` subpath)
  'superfly/flyctl-actions/setup-flyctl': {
    datasource: GithubReleasesDatasource.id,
    depName: 'flyctl',
    packageName: 'superfly/flyctl',
  },
  // https://github.com/swift-actions/setup-swift
  'swift-actions/setup-swift': {
    datasource: GithubReleasesDatasource.id,
    depName: 'swift',
    packageName: 'swiftlang/swift',
    // swiftlang/swift tags releases like `swift-6.3.3-RELEASE`
    extractVersion: '^swift-(?<version>.+)-RELEASE$',
    withSchema: valSchema('swift-version'),
  },
  'UpCloudLtd/upcloud-cli-action': {
    datasource: GithubReleasesDatasource.id,
    packageName: 'UpCloudLtd/upcloud-cli',
  },
  // https://github.com/WillAbides/setup-go-faster
  'WillAbides/setup-go-faster': {
    datasource: GithubReleasesDatasource.id,
    depName: 'go',
    packageName: 'actions/go-versions',
    versioning: npmVersioning.id,
    extractVersion: actionsVersionsExtractVersion,
    withSchema: valSchema('go-version'),
  },
};

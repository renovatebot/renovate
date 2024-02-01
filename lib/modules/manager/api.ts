import * as ansible from './ansible';
import * as ansibleGalaxy from './ansible-galaxy';
import * as argoCD from './argocd';
import * as asdf from './asdf';
import * as azurePipelines from './azure-pipelines';
import * as batect from './batect';
import * as batectWrapper from './batect-wrapper';
import * as bazel from './bazel';
import * as bazelModule from './bazel-module';
import * as bazelisk from './bazelisk';
import * as bicep from './bicep';
import * as bitbucketPipelines from './bitbucket-pipelines';
import * as buildkite from './buildkite';
import * as bun from './bun';
import * as bundler from './bundler';
import * as cake from './cake';
import * as cargo from './cargo';
import * as cdnurl from './cdnurl';
import * as circleci from './circleci';
import * as cloudbuild from './cloudbuild';
import * as cocoapods from './cocoapods';
import * as composer from './composer';
import * as conan from './conan';
import * as cpanfile from './cpanfile';
import * as crossplane from './crossplane';
import * as depsEdn from './deps-edn';
import * as dockerCompose from './docker-compose';
import * as dockerfile from './dockerfile';
import * as droneci from './droneci';
import * as fleet from './fleet';
import * as flux from './flux';
import * as fvm from './fvm';
import * as gitSubmodules from './git-submodules';
import * as githubActions from './github-actions';
import * as gitlabci from './gitlabci';
import * as gitlabciInclude from './gitlabci-include';
import * as gomod from './gomod';
import * as gradle from './gradle';
import * as gradleWrapper from './gradle-wrapper';
import * as helmRequirements from './helm-requirements';
import * as helmValues from './helm-values';
import * as helmfile from './helmfile';
import * as helmsman from './helmsman';
import * as helmv3 from './helmv3';
import * as hermit from './hermit';
import * as homebrew from './homebrew';
import * as html from './html';
import * as jenkins from './jenkins';
import * as jsonnetBundler from './jsonnet-bundler';
import * as kotlinScript from './kotlin-script';
import * as kubernetes from './kubernetes';
import * as kustomize from './kustomize';
import * as leiningen from './leiningen';
import * as maven from './maven';
import * as mavenWrapper from './maven-wrapper';
import * as meteor from './meteor';
import * as mint from './mint';
import * as mix from './mix';
import * as nix from './nix';
import * as nodenv from './nodenv';
import * as npm from './npm';
import * as nuget from './nuget';
import * as nvm from './nvm';
import * as ocb from './ocb';
import * as osgi from './osgi';
import * as pep621 from './pep621';
import * as pipCompile from './pip-compile';
import * as pip_requirements from './pip_requirements';
import * as pip_setup from './pip_setup';
import * as pipenv from './pipenv';
import * as poetry from './poetry';
import * as preCommit from './pre-commit';
import * as pub from './pub';
import * as puppet from './puppet';
import * as pyenv from './pyenv';
import * as rubyVersion from './ruby-version';
import * as sbt from './sbt';
import * as setupCfg from './setup-cfg';
import * as swift from './swift';
import * as tekton from './tekton';
import * as terraform from './terraform';
import * as terraformVersion from './terraform-version';
import * as terragrunt from './terragrunt';
import * as terragruntVersion from './terragrunt-version';
import * as tflintPlugin from './tflint-plugin';
import * as travis from './travis';
import type { ManagerApi } from './types';
import * as velaci from './velaci';
import * as woodpecker from './woodpecker';

const api = new Map<string, ManagerApi>();
export default api;

export const ManagerKeys = {
  ANISBLE: 'ansible',
  ANISBLE_GALAXY: 'ansible-galaxy',
  ARGOCD: 'argocd',
  ASDF: 'asdf',
  AZURE_PIPELINES: 'azure-pipelines',
  BATECT: 'batect',
  BATECT_WRAPPER: 'batect-wrapper',
  BAZEL: 'bazel',
  BAZEL_MODULE: 'bazel-module',
  BAZELISK: 'bazelisk',
  BICEP: 'bicep',
  BITBUCKET_PIPELINES: 'bitbucket-pipelines',
  BUILDKITE: 'buildkite',
  BUN: 'bun',
  BUNDLER: 'bundler',
  CAKE: 'cake',
  CARGO: 'cargo',
  CDNURL: 'cdnurl',
  CIRCLECI: 'circleci',
  CLOUDBUILD: 'cloudbuild',
  COCOAPODS: 'cocoapods',
  COMPOSER: 'composer',
  CONAN: 'conan',
  CPANFILE: 'cpanfile',
  CROSSPLANE: 'crossplane',
  DEPS_EDN: 'deps-edn',
  DOCKER_COMPOSE: 'docker-compose',
  DOCKERFILE: 'dockerfile',
  DRONECI: 'droneci',
  FLEET: 'fleet',
  FLUX: 'flux',
  FVM: 'fvm',
  GIT_SUBMODULES: 'git-submodules',
  GITHUB_ACTIONS: 'github-actions',
  GITLABCI: 'gitlabci',
  GITLABCI_INCLUDE: 'gitlabci-include',
  GOMOD: 'gomod',
  GRADLE: 'gradle',
  GRADLE_WRAPPER: 'gradle-wrapper',
  HELM_REQUIREMENTS: 'helm-requirements',
  HELM_VALUES: 'helm-values',
  HELMFILE: 'helmfile',
  HELMSMAN: 'helmsman',
  HELMV3: 'helmv3',
  HERMIT: 'hermit',
  HOMEBREW: 'homebrew',
  HTML: 'html',
  JENKINS: 'jenkins',
  JSONNET_BUNDLER: 'jsonnet-bundler',
  KOTLIN_SCRIPT: 'kotlin-script',
  KUBERNETES: 'kubernetes',
  KUSTOMIZE: 'kustomize',
  LEININGEN: 'leiningen',
  MAVEN: 'maven',
  MAVEN_WRAPPER: 'maven-wrapper',
  METEOR: 'meteor',
  MINT: 'mint',
  MIX: 'mix',
  NIX: 'nix',
  NODENV: 'nodenv',
  NPM: 'npm',
  NUGET: 'nuget',
  NVM: 'nvm',
  OCB: 'ocb',
  OSGI: 'osgi',
  PEP621: 'pep621',
  PIP_COMPILE: 'pip-compile',
  PIP_REQUIREMENTS: 'pip_requirements',
  PIP_SETUP: 'pip_setup',
  PIPENV: 'pipenv',
  POETRY: 'poetry',
  PRE_COMMIT: 'pre-commit',
  PUB: 'pub',
  PUPPET: 'puppet',
  PYENV: 'pyenv',
  RUBY_VERSION: 'ruby-version',
  SBT: 'sbt',
  SETUP_CFG: 'setup-cfg',
  SWIFT: 'swift',
  TEKTON: 'tekton',
  TERRAFORM: 'terraform',
  TERRAFORM_VERSION: 'terraform-version',
  TERRAGRUNT: 'terragrunt',
  TERRAGRUNT_VERSION: 'terragrunt-version',
  TFLINT_PLUGIN: 'tflint-plugin',
  TRAVIS: 'travis',
  VELACI: 'velaci',
  WOODPECKER: 'woodpecker',
} as const;

api.set(ManagerKeys.ANISBLE, ansible);
api.set(ManagerKeys.ANISBLE_GALAXY, ansibleGalaxy);
api.set(ManagerKeys.ARGOCD, argoCD);
api.set(ManagerKeys.ASDF, asdf);
api.set(ManagerKeys.AZURE_PIPELINES, azurePipelines);
api.set(ManagerKeys.BATECT, batect);
api.set(ManagerKeys.BATECT_WRAPPER, batectWrapper);
api.set(ManagerKeys.BAZEL, bazel);
api.set(ManagerKeys.BAZEL_MODULE, bazelModule);
api.set(ManagerKeys.BAZELISK, bazelisk);
api.set(ManagerKeys.BICEP, bicep);
api.set(ManagerKeys.BITBUCKET_PIPELINES, bitbucketPipelines);
api.set(ManagerKeys.BUILDKITE, buildkite);
api.set(ManagerKeys.BUN, bun);
api.set(ManagerKeys.BUNDLER, bundler);
api.set(ManagerKeys.CAKE, cake);
api.set(ManagerKeys.CARGO, cargo);
api.set(ManagerKeys.CDNURL, cdnurl);
api.set(ManagerKeys.CIRCLECI, circleci);
api.set(ManagerKeys.CLOUDBUILD, cloudbuild);
api.set(ManagerKeys.COCOAPODS, cocoapods);
api.set(ManagerKeys.COMPOSER, composer);
api.set(ManagerKeys.CONAN, conan);
api.set(ManagerKeys.CPANFILE, cpanfile);
api.set(ManagerKeys.CROSSPLANE, crossplane);
api.set(ManagerKeys.DEPS_EDN, depsEdn);
api.set(ManagerKeys.DOCKER_COMPOSE, dockerCompose);
api.set(ManagerKeys.DOCKERFILE, dockerfile);
api.set(ManagerKeys.DRONECI, droneci);
api.set(ManagerKeys.FLEET, fleet);
api.set(ManagerKeys.FLEET, flux);
api.set(ManagerKeys.FVM, fvm);
api.set(ManagerKeys.GIT_SUBMODULES, gitSubmodules);
api.set(ManagerKeys.GITHUB_ACTIONS, githubActions);
api.set(ManagerKeys.GITLABCI, gitlabci);
api.set(ManagerKeys.GITLABCI_INCLUDE, gitlabciInclude);
api.set(ManagerKeys.GOMOD, gomod);
api.set(ManagerKeys.GRADLE, gradle);
api.set(ManagerKeys.GRADLE_WRAPPER, gradleWrapper);
api.set(ManagerKeys.HELM_REQUIREMENTS, helmRequirements);
api.set(ManagerKeys.HELM_VALUES, helmValues);
api.set(ManagerKeys.HELMFILE, helmfile);
api.set(ManagerKeys.HELMSMAN, helmsman);
api.set(ManagerKeys.HELMV3, helmv3);
api.set(ManagerKeys.HERMIT, hermit);
api.set(ManagerKeys.HOMEBREW, homebrew);
api.set(ManagerKeys.HTML, html);
api.set(ManagerKeys.JENKINS, jenkins);
api.set(ManagerKeys.JSONNET_BUNDLER, jsonnetBundler);
api.set(ManagerKeys.KOTLIN_SCRIPT, kotlinScript);
api.set(ManagerKeys.KUBERNETES, kubernetes);
api.set(ManagerKeys.KUSTOMIZE, kustomize);
api.set(ManagerKeys.LEININGEN, leiningen);
api.set(ManagerKeys.MAVEN, maven);
api.set(ManagerKeys.MAVEN_WRAPPER, mavenWrapper);
api.set(ManagerKeys.METEOR, meteor);
api.set(ManagerKeys.MINT, mint);
api.set(ManagerKeys.MIX, mix);
api.set(ManagerKeys.NIX, nix);
api.set(ManagerKeys.NODENV, nodenv);
api.set(ManagerKeys.NPM, npm);
api.set(ManagerKeys.NUGET, nuget);
api.set(ManagerKeys.NVM, nvm);
api.set(ManagerKeys.OCB, ocb);
api.set(ManagerKeys.OSGI, osgi);
api.set(ManagerKeys.PEP621, pep621);
api.set(ManagerKeys.PIP_COMPILE, pipCompile);
api.set(ManagerKeys.PIP_REQUIREMENTS, pip_requirements);
api.set(ManagerKeys.PIP_SETUP, pip_setup);
api.set(ManagerKeys.PIPENV, pipenv);
api.set(ManagerKeys.POETRY, poetry);
api.set(ManagerKeys.PRE_COMMIT, preCommit);
api.set(ManagerKeys.PUB, pub);
api.set(ManagerKeys.PUPPET, puppet);
api.set(ManagerKeys.PYENV, pyenv);
api.set(ManagerKeys.RUBY_VERSION, rubyVersion);
api.set(ManagerKeys.SBT, sbt);
api.set(ManagerKeys.SETUP_CFG, setupCfg);
api.set(ManagerKeys.SWIFT, swift);
api.set(ManagerKeys.TEKTON, tekton);
api.set(ManagerKeys.TERRAFORM, terraform);
api.set(ManagerKeys.TERRAFORM_VERSION, terraformVersion);
api.set(ManagerKeys.TERRAGRUNT, terragrunt);
api.set(ManagerKeys.TERRAGRUNT_VERSION, terragruntVersion);
api.set(ManagerKeys.TFLINT_PLUGIN, tflintPlugin);
api.set(ManagerKeys.TRAVIS, travis);
api.set(ManagerKeys.VELACI, velaci);
api.set(ManagerKeys.WOODPECKER, woodpecker);

import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes: DepTypeMetadata[] = [
  {
    depType: 'container_pull',
    description: 'A Docker container image pulled via `container_pull`',
  },
  {
    depType: '_container_pull',
    description:
      'A Docker container image pulled via the private `_container_pull` rule',
  },
  {
    depType: 'git_repository',
    description: 'A Git repository dependency via `git_repository`',
  },
  {
    depType: '_git_repository',
    description:
      'A Git repository dependency via the private `_git_repository` rule',
  },
  {
    depType: 'new_git_repository',
    description:
      'A Git repository with a custom BUILD file via `new_git_repository`',
  },
  {
    depType: '_new_git_repository',
    description:
      'A Git repository with a custom BUILD file via the private `_new_git_repository` rule',
  },
  {
    depType: 'go_repository',
    description: 'A Go module dependency via `go_repository`',
  },
  {
    depType: '_go_repository',
    description: 'A Go module dependency via the private `_go_repository` rule',
  },
  {
    depType: 'http_archive',
    description: 'An archive downloaded over HTTP via `http_archive`',
  },
  {
    depType: '_http_archive',
    description:
      'An archive downloaded over HTTP via the private `_http_archive` rule',
  },
  {
    depType: 'http_file',
    description: 'A file downloaded over HTTP via `http_file`',
  },
  {
    depType: '_http_file',
    description:
      'A file downloaded over HTTP via the private `_http_file` rule',
  },
  {
    depType: 'oci_pull',
    description: 'An OCI container image pulled via `oci_pull`',
  },
  {
    depType: '_oci_pull',
    description:
      'An OCI container image pulled via the private `_oci_pull` rule',
  },
  {
    depType: 'maven_install',
    description: 'A Maven artifact installed via `maven_install`',
  },
  {
    depType: '_maven_install',
    description:
      'A Maven artifact installed via the private `_maven_install` rule',
  },
];

export type BazelDepType = (typeof knownDepTypes)[number]['depType'];

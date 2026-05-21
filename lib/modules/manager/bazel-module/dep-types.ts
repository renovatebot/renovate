import type { DepTypeMetadata } from '../types.ts';

export const knownDepTypes = [
  {
    depType: 'bazel_dep',
    description: 'A direct Bazel module dependency via `bazel_dep`',
  },
  {
    depType: 'git_override',
    description:
      'A Git-based override for a Bazel module dependency via `git_override`',
  },
  {
    depType: 'archive_override',
    description:
      'An archive-based override for a Bazel module dependency via `archive_override`',
  },
  {
    depType: 'local_path_override',
    description:
      'A local path override for a Bazel module dependency via `local_path_override`',
  },
  {
    depType: 'single_version_override',
    description:
      'A version or registry override for a Bazel module dependency via `single_version_override`',
  },
  {
    depType: 'git_repository',
    description:
      'A Git repository dependency via `git_repository` in a module extension',
  },
  {
    depType: 'new_git_repository',
    description:
      'A Git repository with a custom BUILD file via `new_git_repository` in a module extension',
  },
  {
    depType: 'oci_pull',
    description:
      'An OCI container image pulled via the `oci.pull` module extension tag',
  },
  {
    depType: 'maven_install',
    description: 'A Maven artifact installed via the `maven` module extension',
  },
  {
    depType: 'crate_spec',
    description:
      'A Rust crate dependency via the `crate.spec` module extension tag',
  },
  {
    depType: 'rules_img_pull',
    description:
      'A container image pulled via a `rules_img` repo rule in a module extension',
  },
] as const satisfies readonly DepTypeMetadata[];

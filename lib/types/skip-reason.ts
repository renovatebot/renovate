export type SkipReason =
  | 'any-version'
  | 'contains-variable'
  | 'disabled'
  | 'empty'
  | 'file-dependency'
  | 'file'
  | 'git-dependency'
  | 'git-plugin'
  | 'github-token-required'
  | 'ignored'
  | 'internal-error'
  | 'internal-package'
  | 'invalid-config'
  | 'invalid-dependency-specification'
  | 'invalid-name'
  | 'invalid-sha256'
  | 'invalid-url'
  | 'invalid-value'
  | 'invalid-version'
  | 'is-pinned'
  | 'local-chart'
  | 'local-dependency'
  | 'local'
  | 'missing-depname'
  | 'multiple-constraint-dep'
  | 'name-placeholder'
  | 'no-repository'
  | 'no-source-match'
  | 'no-source'
  | 'no-version'
  | 'non-hex-dep-types'
  | 'not-a-version'
  | 'path-dependency'
  | 'placeholder-url'
  | 'recursive-placeholder'
  | 'root-pom'
  | 'unknown-engines'
  | 'unknown-registry'
  | 'unknown-version'
  | 'unknown-volta'
  | 'unsupported-chart-type'
  | 'unsupported-datasource'
  | 'unsupported-remote'
  | 'unsupported-url'
  | 'unsupported-version'
  | 'unsupported'
  | 'unversioned-reference'
  | 'version-placeholder';

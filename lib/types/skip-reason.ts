export type SkipReason =
  | 'contains-variable'
  | 'disabled'
  | 'empty'
  | 'file-dependency'
  | 'file'
  | 'git-dependency'
  | 'git-plugin'
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
  | 'local-chart'
  | 'local-dependency'
  | 'local'
  | 'multiple-constraint-dep'
  | 'name-placeholder'
  | 'no-repository'
  | 'no-source-match'
  | 'no-source'
  | 'non-hex-dep-types'
  | 'not-a-version'
  | 'package-rules'
  | 'path-dependency'
  | 'placeholder-url'
  | 'unknown-engines'
  | 'unknown-registry'
  | 'unknown-volta'
  | 'unspecified-version'
  | 'unsupported-chart-type'
  | 'unsupported-datasource'
  | 'unsupported-remote'
  | 'unsupported-url'
  | 'unsupported-version'
  | 'unsupported'
  | 'unversioned-reference'
  | 'version-placeholder'
  | 'is-pinned'
  | 'missing-depname'
  | 'recursive-placeholder'
  | 'github-token-required'
  | 'inherited-dependency';

export type StageName =
  | 'current-timestamp'
  | 'datasource-merge'
  | 'extract'
  | 'lock-file-maintenance-merge'
  | 'lock-file-maintenance-merge-2'
  | 'lookup'
  | 'pre-lookup'
  | 'source-url'
  | 'update-type'
  | 'update-type-merge';

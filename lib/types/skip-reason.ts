export enum SkipReason {
  ANY_VERSION = 'any-version',
  DISABLED = 'disabled',
  EMPTY = 'empty',
  FILE_DEPENDENCY = 'file-dependency',
  FILE = 'file',
  GIT_DEPENDENCY = 'git-dependency',
  GIT_PLUGIN = 'git-plugin',
  IGNORED = 'ignored',
  INTERNAL_PACKAGE = 'internal-package',
  INVALID_DEPENDENCY_SPECIFICATION = 'invalid-dependency-specification',
  INVALID_NAME = 'invalid-name',
  INVALID_SHA256 = 'invalid-sha256',
  INVALID_URL = 'invalid-url',
  INVALID_VALUE = 'invalid-value',
  INVALID_VERSION = 'invalid-version',
  LOCAL_CHART = 'local-chart',
  LOCAL_DEPENDENCY = 'local-dependency',
  LOCAL = 'local',
  MULTIPLE_CONSTRAINT_DEP = 'multiple-constraint-dep',
  NAME_PLACEHOLDER = 'name-placeholder',
  NO_REPOSITORY = 'no-repository',
  NO_SOURCE_MATCH = 'no-source-match',
  NO_SOURCE = 'no-source',
  NO_VERSION = 'no-version',
  NON_HEX_DEPTYPES = 'non-hex depTypes',
  NOT_A_VERSION = 'not-a-version',
  PATH_DEPENDENCY = 'path-dependency',
  PLACEHOLDER_URL = 'placeholder-url',
  UNKNOWN_ENGINES = 'unknown-engines',
  UNKNOWN_REGISTRY = 'unknown-registry',
  UNKNOWN_VERSION = 'unknown-version',
  UNKNOWN_VOLTA = 'unknown-volta',
  UNKNOWN = 'unknown',
  UNSUPPORTED_CHART_TYPE = 'unsupported-chart-type',
  UNSUPPORTED_REMOTE = 'unsupported-remote',
  UNSUPPORTED_URL = 'unsupported-url',
  UNSUPPORTED_VALUE = 'unsupported-value',
  UNSUPPORTED_VERSION = 'unsupported-version',
  UNSUPPORTED = 'unsupported',
  UNVERSIONED_REFERENCE = 'unversioned-reference',
  VERSION_PLACEHOLDER = 'version-placeholder',
}

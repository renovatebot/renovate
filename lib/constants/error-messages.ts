// System error
export const SYSTEM_INSUFFICIENT_DISK_SPACE = 'disk-space';
export const SYSTEM_INSUFFICIENT_MEMORY = 'out-of-memory';

// Platform Error
export const PLATFORM_AUTHENTICATION_ERROR = 'authentication-error';
export const PLATFORM_BAD_CREDENTIALS = 'bad-credentials';
export const PLATFORM_GPG_FAILED = 'gpg-failed';
export const PLATFORM_INTEGRATION_UNAUTHORIZED = 'integration-unauthorized';
export const PLATFORM_NOT_FOUND = 'platform-not-found';
export const PLATFORM_RATE_LIMIT_EXCEEDED = 'rate-limit-exceeded';
export const PLATFORM_UNKNOWN_ERROR = 'platform-unknown-error';

// Config Error
export const CONFIG_VALIDATION = 'config-validation';
export const CONFIG_PRESETS_INVALID = 'config-presets-invalid';
export const CONFIG_SECRETS_EXPOSED = 'config-secrets-exposed';
export const CONFIG_SECRETS_INVALID = 'config-secrets-invalid';
export const CONFIG_GIT_URL_UNAVAILABLE = 'config-git-url-unavailable';
export const CONFIG_INHERIT_NOT_FOUND = 'config-inherit-not-found';
export const CONFIG_INHERIT_PARSE_ERROR = 'config-inherit-parse-error';

// Repository Errors - causes repo to be considered as disabled
export const REPOSITORY_ACCESS_FORBIDDEN = 'forbidden';
export const REPOSITORY_ARCHIVED = 'archived';
export const REPOSITORY_BLOCKED = 'blocked';
export const REPOSITORY_CANNOT_FORK = 'cannot-fork';
export const REPOSITORY_DISABLED = 'disabled';
export const REPOSITORY_CLOSED_ONBOARDING = 'disabled-closed-onboarding';
export const REPOSITORY_DISABLED_BY_CONFIG = 'disabled-by-config';
export const REPOSITORY_NO_CONFIG = 'disabled-no-config';
export const REPOSITORY_EMPTY = 'empty';
export const REPOSITORY_FORK_MISSING = 'fork-missing';
export const REPOSITORY_FORK_MODE_FORKED = 'fork-mode-forked';
export const REPOSITORY_FORKED = 'fork';
export const REPOSITORY_MIRRORED = 'mirror';
export const REPOSITORY_NOT_FOUND = 'not-found';
export const REPOSITORY_NO_PACKAGE_FILES = 'no-package-files';
export const REPOSITORY_RENAMED = 'renamed';
export const REPOSITORY_UNINITIATED = 'uninitiated';

// Temporary Error
export const REPOSITORY_CHANGED = 'repository-changed';
export const TEMPORARY_ERROR = 'temporary-error';
export const NO_VULNERABILITY_ALERTS = 'no-vulnerability-alerts';

// Manager Error
export const MANAGER_LOCKFILE_ERROR = 'lockfile-error';
export const FILE_ACCESS_VIOLATION_ERROR = 'file-access-violation-error';

// Host error
export const EXTERNAL_HOST_ERROR = 'external-host-error';
export const IGNORABLE_HOST_ERROR = 'ignorable-host-error';
export const HOST_DISABLED = 'host-disabled';

// Worker Error
export const WORKER_FILE_UPDATE_FAILED = 'update-failure';

// Bundler Error
export const BUNDLER_INVALID_CREDENTIALS = 'bundler-credentials';

// Unknown Error
export const UNKNOWN_ERROR = 'unknown-error';

// PATH Error
export const INVALID_PATH = 'invalid-path';

// PAGE NOT FOUND
export const PAGE_NOT_FOUND_ERROR = 'page-not-found';

// Missing API required credentials
export const MISSING_API_CREDENTIALS = 'missing-api-credentials';

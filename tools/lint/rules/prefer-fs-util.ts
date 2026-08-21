import { defineRule } from '@oxlint/plugins';

/**
 * Modules whose value imports are restricted in `lib/` in favor of the
 * scoped helpers from `lib/util/fs`.
 */
const RESTRICTED_MODULES = new Set([
  'fs',
  'node:fs',
  'fs/promises',
  'node:fs/promises',
  'fs-extra',
  'fs-extra/esm',
]);

/*
 * Paths exempt from this rule (via overrides in `.oxlintrc.json`). The
 * `lib/util/fs` helpers scope file access to the `localDir`/`cacheDir` from
 * `GlobalConfig`, so they only make sense for code that runs after those
 * directories are configured and that operates inside them. The following
 * areas legitimately need raw `fs` access:
 *
 * - `lib/util/fs/` implements the helpers themselves.
 * - `lib/logger/` opens log-file streams at user-configured system paths
 *   during process bootstrap, before any config exists; `lib/util/fs` also
 *   depends on the logger, so the reverse import would be a cycle.
 * - `lib/workers/global/` is process bootstrap: it creates `baseDir` and
 *   `cacheDir` themselves and reads/writes user-supplied paths (config
 *   files, `writeDiscoveredRepos` output) before `GlobalConfig` is seeded
 *   with the directory config the scoped helpers resolve against.
 * - `lib/config-validator.ts` is a standalone CLI entry point that validates
 *   arbitrary files without any `GlobalConfig`.
 * - `lib/util/git/` sits beneath the scoped-helper abstraction: it owns the
 *   `localDir` lifecycle (clone, emptyDir, symlinks) and manages private-key
 *   files with synchronous cleanup on process exit, which the async scoped
 *   helpers cannot express.
 * - `lib/instrumentation/` bootstraps OpenTelemetry and writes traces to a
 *   user-configured system path (`RENOVATE_TRACING_FILE_EXPORTER_PATH`)
 *   outside `localDir`/`cacheDir`, before any `GlobalConfig` exists.
 */

export default defineRule({
  meta: {
    type: 'suggestion',
    messages: {
      preferFsUtil:
        "Use the helpers from 'lib/util/fs' instead of importing '{{module}}' directly: they scope file access to the configured local/cache directories.",
    },
  },
  createOnce(context) {
    return {
      ImportDeclaration(node) {
        // type-only imports don't touch the filesystem
        if (node.importKind === 'type') {
          return;
        }
        const source = node.source.value;
        if (RESTRICTED_MODULES.has(source)) {
          context.report({
            node,
            messageId: 'preferFsUtil',
            data: { module: source },
          });
        }
      },
    };
  },
});

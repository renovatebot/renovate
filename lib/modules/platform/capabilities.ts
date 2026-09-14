// This module must not gain any runtime import. `lib/util/git` and `lib/util/fs` import it, while
// `lib/modules/platform/index.ts` imports `lib/util/git`, so anything imported here at runtime
// would close an import cycle.
import type { PlatformCapabilities } from './types.ts';

const defaultCapabilities = {
  git: true,
  htmlComments: false,
} as const satisfies Required<PlatformCapabilities>;

let capabilities: Required<PlatformCapabilities> = defaultCapabilities;

/**
 * Records the capabilities of the platform which has just been selected.
 *
 * Called from `setPlatformApi()`. This lives in its own module so that `lib/util/git` and
 * `lib/util/fs` can read the flags: they cannot import the platform API itself, because
 * `lib/modules/platform/index.ts` imports `lib/util/git`.
 */
export function setPlatformCapabilities(
  platformCapabilities: PlatformCapabilities | undefined,
): void {
  capabilities = { ...defaultCapabilities, ...platformCapabilities };
}

/**
 * Whether Renovate owns the checkout it works in, so it may clone, push branches and open pull
 * requests. See {@link PlatformCapabilities.git}.
 */
export function supportsGit(): boolean {
  return capabilities.git;
}

/**
 * Whether the platform renders HTML comments and task list checkboxes in issue and pull request
 * bodies. See {@link PlatformCapabilities.htmlComments}.
 */
export function supportsHtmlComments(): boolean {
  return capabilities.htmlComments;
}

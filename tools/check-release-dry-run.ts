import { argv, env } from 'node:process';
import { pathToFileURL } from 'node:url';
import semanticRelease from 'semantic-release';

// Release types that introduce a new major version. `premajor` is what the
// `next` prerelease branch reports for the same breaking change.
const MAJOR_TYPES = new Set(['major', 'premajor']);

// Structural subset of semantic-release's `Result` that we care about. The real
// result (`false | { lastRelease, nextRelease, ... }`) is assignable to this.
export interface DryRunResultLike {
  nextRelease?: { type: string; version: string } | null;
  lastRelease?: { version: string } | null;
}

export interface Verdict {
  willRelease: boolean;
  type: string | null;
  version: string | null;
  lastVersion: string | null;
  isMajor: boolean;
}

export function evaluateResult(result: DryRunResultLike | false): Verdict {
  if (!result || !result.nextRelease) {
    return {
      willRelease: false,
      type: null,
      version: null,
      lastVersion: null,
      isMajor: false,
    };
  }
  const { type, version } = result.nextRelease;
  return {
    willRelease: true,
    type,
    version,
    lastVersion: result.lastRelease?.version ?? null,
    isMajor: MAJOR_TYPES.has(type),
  };
}

/**
 * Run a full, offline semantic-release dry-run for the state that would exist
 * right after a PR merges, and return its structured result.
 *
 * - `repositoryUrl` is a local bare mirror, so no network or token is needed
 *   (works for fork PRs).
 * - Only the analysis plugins run; the publish plugins are dropped, which does
 *   not change the computed version.
 * - The spoofed `GITHUB_*` env presents the run as a push to `baseRef`, so
 *   `env-ci` does not treat it as a (non-releasing) pull request.
 */
function runDryRun(
  repositoryUrl: string,
  baseRef: string,
  headSha: string,
): Promise<DryRunResultLike | false> {
  return semanticRelease(
    {
      dryRun: true,
      repositoryUrl,
      plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
      ],
    },
    {
      env: {
        ...env,
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: `refs/heads/${baseRef}`,
        GITHUB_SHA: headSha,
      },
    },
  );
}

async function main(): Promise<void> {
  const [repositoryUrl, baseRef, headSha] = argv.slice(2);
  if (!repositoryUrl || !baseRef || !headSha) {
    throw new Error(
      'Usage: check-release-dry-run <repositoryUrl> <baseRef> <headSha>',
    );
  }

  const { willRelease, type, version, lastVersion, isMajor } = evaluateResult(
    await runDryRun(repositoryUrl, baseRef, headSha),
  );

  if (!willRelease) {
    console.log('semantic-release would not publish a new version.');
    return;
  }

  console.log(
    `semantic-release would publish ${version} (${type}); previous release: ${lastVersion ?? 'none'}.`,
  );

  if (!isMajor) {
    console.log('✓ Not a new major version.');
    return;
  }

  const title = 'Unexpected major release';
  const hint =
    `Merging this PR would make semantic-release publish a new major version ` +
    `(${lastVersion ?? '?'} → ${version}), because a commit carries a breaking-change ` +
    'marker (`!` in the header, or a `BREAKING CHANGE:`/`BREAKING-CHANGE:` note). ' +
    'Remove the marker, or — if a major bump is intended (e.g. preparing the next ' +
    'major) — override this check manually.';

  console.log(env.CI ? `::error title=${title}::${hint}` : `${title}: ${hint}`);
  process.exitCode = 1;
}

// Only run when executed directly, so tests can import the helpers.
if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) {
  await main();
}

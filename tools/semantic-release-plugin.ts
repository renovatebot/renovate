import fs from 'fs-extra';
import type {
  PrepareContext,
  PublishContext,
  SuccessContext,
} from 'semantic-release';
import { SemVer } from 'semver';
import { init } from '../lib/logger/index.ts';
import { generateDocs } from './docs/index.ts';
import { bake, sign } from './utils/docker.ts';
import { commandError, run } from './utils/exec.ts';

await init();

const platform = 'linux/amd64,linux/arm64';

/** Pushed images to sign, set by `publish` and signed in `success`. */
let images: string[] = [];

/**
 * Writes an error annotation to the GitHub Actions run.
 */
function annotateError(title: string, message: string): void {
  // an annotation ends at the first newline
  process.stdout.write(`::error title=${title}::${message.split('\n')[0]}\n`);
}

/**
 * Builds Renovate, the docs, the mkdocs site and the docker images.
 */
export async function prepare(
  _config: unknown,
  { branch, logger, nextRelease }: PrepareContext,
): Promise<void> {
  const { version } = nextRelease;
  logger.log(`Preparing v${version} ...`);

  await run('pnpm', [
    'version',
    version,
    '--no-git-tag-version',
    '--allow-same-version',
  ]);
  await run('pnpm', ['build']);
  await generateDocs(undefined, undefined, version);

  logger.log('Building Mkdocs site ...');
  await run('pnpm', [
    'mkdocs',
    'build',
    '--no-announcement',
    '--version',
    version,
  ]);
  await fs.ensureDir('tmp');
  await run('tar', [
    '-czf',
    'tmp/mkdocs-site.tgz',
    '-C',
    'tools/mkdocs/site',
    '.',
  ]);

  await bake('build', {
    platform,
    version: new SemVer(version),
    channel: branch.channel,
    tries: 3,
    delay: '30s',
  });
}

/**
 * Pushes the docker images, they are signed in `success` after all plugins
 * published.
 */
export async function publish(
  _config: unknown,
  { branch, logger, nextRelease }: PublishContext,
): Promise<void> {
  logger.log(`Publishing v${nextRelease.version} ...`);
  const meta = await bake('push', {
    platform,
    version: new SemVer(nextRelease.version),
    channel: branch.channel,
  });

  images = [];
  for (const target of ['push-slim', 'push-full'] as const) {
    const digest = meta[target]?.['containerimage.digest'];
    if (!digest) {
      throw commandError(`Missing image digest for ${target}`);
    }
    images.push(
      `ghcr.io/renovatebot/renovate@${digest}`,
      `renovate/renovate@${digest}`,
    );
  }
}

/**
 * Signs the pushed images and reports the release. A failed signing doesn't
 * fail the release, it is reported as a GitHub Actions error annotation.
 */
export async function success(
  _config: unknown,
  { logger, nextRelease }: SuccessContext,
): Promise<void> {
  for (const image of images) {
    try {
      await sign(image);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(message);
      annotateError('Image signing failed', message);
    }
  }

  const { version } = nextRelease;
  process.stdout.write(`::notice::Released Renovate ${version}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(
      process.env.GITHUB_STEP_SUMMARY,
      `## Released Renovate ${version}\n`,
    );
  }
}

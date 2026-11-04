import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { SemVer } from 'semver';
import { logger } from '../../lib/logger/index.ts';
import { toMs } from '../../lib/util/pretty-time.ts';
import { commandError, exec, run } from './exec.ts';

const file = 'tools/docker/bake.hcl';
const tmp = fs.mkdtemp(path.join(os.tmpdir(), 'renovate-docker-bake-'));

export interface MetaDataItem {
  'containerimage.digest'?: string;
}
export interface MetaData {
  'push-slim'?: MetaDataItem;
  'push-full'?: MetaDataItem;
}

export async function bake(
  target: string,
  opts: {
    platform?: string;
    version?: SemVer;
    args?: string[];
    delay?: string;
    tries?: number;
    channel?: string | false;
  },
): Promise<MetaData> {
  if (opts.version) {
    console.log(`Using version: ${opts.version.version}`);
    process.env.RENOVATE_VERSION = opts.version.version;
    if (!opts.version.prerelease.length) {
      process.env.RENOVATE_MAJOR_VERSION = `${opts.version.major}`;
      process.env.RENOVATE_MAJOR_MINOR_VERSION = `${opts.version.major}.${opts.version.minor}`;
    }
  }

  if (opts.channel) {
    process.env.CHANNEL = opts.channel.replace('maint/', '');
  }

  const metadataFile = path.join(await tmp, 'metadata.json');
  const args = [
    'buildx',
    'bake',
    '--file',
    file,
    '--metadata-file',
    metadataFile,
  ];

  if (opts.platform) {
    console.log(`Using platform: ${opts.platform}`);
    args.push('--set', `settings.platform=${opts.platform}`);
  }

  if (Array.isArray(opts.args)) {
    console.log(`Using args: ${opts.args.join(' ')}`);
    args.push(...opts.args);
  }

  args.push(target);

  for (let tries = opts.tries ?? 0; ; tries--) {
    // the output goes straight to the log, so it is only shown once
    const result = await exec('docker', args, {
      reject: false,
      stdio: 'inherit',
    });
    if (!result.failed) {
      break;
    }
    const message = result.shortMessage ?? `docker bake ${target} failed`;
    if (result.signal || tries <= 0) {
      throw commandError(message);
    }
    logger.warn(message);
    const delay = opts.delay ? toMs(opts.delay) : null;
    if (delay) {
      logger.info(`Retrying in ${opts.delay} ...`);
      await setTimeout(delay);
    }
  }

  const meta = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
  logger.debug({ meta }, 'metadata');

  return meta;
}

export async function sign(image: string): Promise<void> {
  logger.info(`Signing ${image} ...`);
  await run('cosign', ['sign', '--yes', image]);
}

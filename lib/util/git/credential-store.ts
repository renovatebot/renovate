import os from 'node:os';
import fs from 'fs-extra';
import upath from 'upath';
import { logger } from '../../logger/index.ts';
import { newlineRegex } from '../regex.ts';
import { parseUrl } from '../url.ts';
import { setCredentialStoreConfig, simpleGitConfig } from './config.ts';
import { createSimpleGit } from './index.ts';

/**
 * Returns the path of the file used by the Git credential store helper.
 */
export function getGitCredentialStorePath(): string {
  return upath.join(os.homedir(), '.git-credentials');
}

function parseStoreUrl(url: string): URL {
  const parsedUrl = parseUrl(url);
  if (!parsedUrl) {
    throw new Error(`Invalid URL for the Git credential store: ${url}`);
  }
  return parsedUrl;
}

// An empty value resets the list of credential helpers collected so far
const storeOnlyHelpers = ['', 'store'];

function isStoreOnly(values: string[]): boolean {
  return (
    values.length === storeOnlyHelpers.length &&
    values.every((value, index) => value === storeOnlyHelpers[index])
  );
}

/**
 * Makes the `store` credential helper the only one used for the origin of `url`, via the global Git configuration.
 */
export async function enableGitCredentialStore(url: string): Promise<void> {
  const { origin } = parseStoreUrl(url);
  const key = `credential.${origin}.helper`;
  const git = createSimpleGit({
    config: {
      // simple-git refuses to write `credential.*.helper` unless explicitly allowed
      unsafe: {
        ...simpleGitConfig().unsafe,
        allowUnsafeCredentialHelper: true,
      },
    },
  });
  const { values } = await git.getConfig(key, 'global');
  if (isStoreOnly(values)) {
    logger.debug(`Git credential store is already enabled for ${origin}`);
    return;
  }

  // Helpers configured earlier for this origin (e.g. the GitLab Runner's CI job token helper) would otherwise answer first
  logger.debug(`Enabling the Git credential store for ${origin}`);
  if (values.length) {
    await git.raw(['config', '--global', '--unset-all', key]);
  }
  for (const helper of storeOnlyHelpers) {
    await git.addConfig(key, helper, true, 'global');
  }
}

function isEntryForOrigin(line: string, origin: URL): boolean {
  const entry = parseUrl(line);
  return entry?.protocol === origin.protocol && entry.host === origin.host;
}

async function readGitCredentialStore(path: string): Promise<string[]> {
  if (!(await fs.pathExists(path))) {
    return [];
  }

  const content = await fs.readFile(path, 'utf8');
  return content.split(newlineRegex).filter((line) => line.trim() !== '');
}

/**
 * Creates or replaces the entry for the origin of `url` in the Git credential store file.
 */
export async function updateGitCredentialStore(
  url: string,
  username: string,
  password: string,
): Promise<void> {
  const path = getGitCredentialStorePath();
  const target = parseStoreUrl(url);
  target.username = username;
  target.password = password;
  const entry = `${target.protocol}//${target.username}:${target.password}@${target.host}`;

  const lines = await readGitCredentialStore(path);
  const matchingEntries = lines.filter((line) =>
    isEntryForOrigin(line, target),
  );
  if (matchingEntries.length === 1 && matchingEntries[0] === entry) {
    logger.debug(
      `Git credential store at ${path} is up to date for ${target.origin}`,
    );
    return;
  }

  const otherEntries = lines.filter((line) => !isEntryForOrigin(line, target));
  logger.debug(
    `Writing credentials for ${target.origin} to the Git credential store at ${path}`,
  );
  try {
    await fs.writeFile(path, `${[...otherEntries, entry].join('\n')}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch (err) {
    throw new Error(`Cannot write the Git credential store file ${path}`, {
      cause: err,
    });
  }
}

/**
 * Makes the Git credential store the only credential source for the origin of `url`, and stores the credentials in it.
 */
export async function setupGitCredentialStore(
  url: string,
  username: string,
  password: string,
): Promise<void> {
  await enableGitCredentialStore(url);
  await updateGitCredentialStore(url, username, password);

  // Config files in other scopes can reset the helpers or set another username, e.g. the GitLab Runner's config for the CI job token
  const { origin } = parseStoreUrl(url);
  setCredentialStoreConfig([
    { key: `credential.${origin}.helper`, value: '' },
    { key: `credential.${origin}.helper`, value: 'store' },
    { key: `credential.${origin}.username`, value: username },
  ]);
}

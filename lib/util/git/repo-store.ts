import { spawn } from 'child_process';
import { GlobalConfig } from '../../config/global';
import { logger } from '../../logger';
import type { LongCommitSha } from './types';
import { syncGit } from '.';

interface ExecResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function execGit(cmd: string[], input?: string): Promise<ExecResult> {
  const cwd = GlobalConfig.get('localDir');

  return new Promise((resolve, reject) => {
    const proc = spawn('git', cmd, { cwd });

    const stdout: string[] = [];
    const stderr: string[] = [];

    if (input) {
      proc.stdin.write(input);
      proc.stdin.end();
    }

    proc.stdout.on('data', (data) => {
      stdout.push(data.toString());
    });

    proc.stderr.on('data', (data) => {
      stderr.push(data.toString());
    });

    proc.on('close', (code) => {
      resolve({
        code,
        stdout: stdout.join(''),
        stderr: stderr.join(''),
      });
    });

    proc.on('error', reject);
  });
}

async function createBlob(content: string): Promise<LongCommitSha | null> {
  const { code, stdout, stderr } = await execGit(
    ['hash-object', '-w', '--stdin'],
    content,
  );

  if (code !== 0) {
    logger.debug(`git hash-object failed: ${stderr}`);
    return null;
  }

  return stdout.trim() as LongCommitSha;
}

interface TreeEntry {
  sha: string;
  path: string;
}

async function createTree(entries: TreeEntry[]): Promise<LongCommitSha | null> {
  const treeEntries = entries
    .map(({ sha, path }) => `100644 blob ${sha}\t${path}`)
    .join('\n');

  const { code, stdout, stderr } = await execGit(['mktree'], treeEntries);

  if (code !== 0) {
    logger.debug(`git mktree failed: ${stderr}`);
    return null;
  }

  return stdout.trim() as LongCommitSha;
}

interface CreateCommitOptions {
  tree: LongCommitSha;
  message: string;
  parents?: LongCommitSha[];
}

async function createCommit({
  tree,
  message,
  parents = [],
}: CreateCommitOptions): Promise<LongCommitSha | null> {
  const args = ['commit-tree', tree];

  for (const parent of parents) {
    args.push('-p', parent);
  }

  const { code, stdout, stderr } = await execGit(args, message);

  if (code !== 0) {
    logger.debug(`git commit-tree failed: ${stderr}`);
    return null;
  }

  return stdout.trim() as LongCommitSha;
}

async function createRef(ref: string, sha: LongCommitSha): Promise<boolean> {
  const { code, stderr } = await execGit(['update-ref', ref, sha]);

  if (code !== 0) {
    logger.debug(`git update-ref failed: ${stderr}`);
    return false;
  }

  return true;
}

export async function deleteRef(ref: string): Promise<boolean> {
  const { code, stderr } = await execGit(['update-ref', '-d', ref]);

  if (code !== 0) {
    logger.debug(`git update-ref failed: ${stderr}`);
    return false;
  }
  return true;
}

export async function set(
  key: string,
  value: string,
  blobName = 'data.json',
): Promise<void> {
  await syncGit();

  const blobSha = await createBlob(value);
  if (!blobSha) {
    return;
  }
  logger.debug(`Git blob created: ${blobSha}`);

  const treeSha = await createTree([{ sha: blobSha, path: blobName }]);
  if (!treeSha) {
    return;
  }
  logger.debug(`Git tree created: ${treeSha}`);

  const commitSha = await createCommit({ tree: treeSha, message: key });
  if (!commitSha) {
    return;
  }
  logger.debug(`Git commit created: ${commitSha}`);

  const refName = `refs/renovate-data/${key}`;
  await createRef(refName, commitSha);
  logger.debug(`Git ref created: ${refName}`);

  await execGit(['push', '--force', 'origin', refName]);
  logger.debug(`Git ref pushed: ${refName}`);
}

async function getRefCommit(ref: string): Promise<LongCommitSha | null> {
  const { code, stdout, stderr } = await execGit(['show-ref', ref]);

  if (code !== 0) {
    if (stderr.includes('exists')) {
      return null;
    }

    logger.debug(`git show-ref failed: ${stderr}`);
    return null;
  }

  return stdout.split(' ')[0].trim() as LongCommitSha;
}

async function getTree(commitSha: LongCommitSha): Promise<string | null> {
  const { code, stdout, stderr } = await execGit(['ls-tree', commitSha]);

  if (code !== 0) {
    logger.debug(`git ls-tree failed: ${stderr}`);
    return null;
  }

  return stdout;
}

async function getBlobContent(blobSha: string): Promise<string | null> {
  const { code, stdout, stderr } = await execGit(['cat-file', 'blob', blobSha]);

  if (code !== 0) {
    logger.debug(`git cat-file failed: ${stderr}`);
    return null;
  }

  return stdout;
}

function findBlobInTree(treeContent: string, blobName: string): string | null {
  const treeEntry = treeContent
    .split('\n')
    .find((line) => line.endsWith(blobName));

  if (!treeEntry) {
    return null;
  }

  return treeEntry.split(/\s+/)[2];
}

export async function get(
  key: string,
  blobName = 'data.json',
): Promise<string | null> {
  await syncGit();

  try {
    const ref = `refs/renovate-data/${key}`;

    await execGit([
      'fetch',
      'origin',
      'refs/renovate-data/*:refs/renovate-data/*',
    ]);

    const commitSha = await getRefCommit(ref);
    if (!commitSha) {
      return null;
    }

    const treeContent = await getTree(commitSha);
    if (!treeContent) {
      return null;
    }

    const blobSha = findBlobInTree(treeContent, blobName);
    if (!blobSha) {
      return null;
    }

    const content = await getBlobContent(blobSha);
    return content;
  } catch (err) {
    if (err instanceof Error) {
      logger.debug(err.message);
    }

    return null;
  }
}

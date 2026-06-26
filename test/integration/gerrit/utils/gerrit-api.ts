import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { execa } from 'execa';
import type { GerritChange } from '../../../../lib/modules/platform/gerrit/schema.ts';
import type { GerritRequestDetail } from '../../../../lib/modules/platform/gerrit/types.ts';
import {
  GERRIT_ADMIN_PASSWORD,
  GERRIT_ADMIN_USERNAME,
  getBaseUrl,
} from './gerrit-container.ts';

function parseGerritJson(text: string): unknown {
  return JSON.parse(text.replace(/^\)]}'\n/, ''));
}

async function gerritFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`${GERRIT_ADMIN_USERNAME}:${GERRIT_ADMIN_PASSWORD}`).toString('base64')}`,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Gerrit request failed: ${options.method ?? 'GET'} ${url} → ${res.status} ${res.statusText}\n${body}`,
    );
  }
  return res;
}

export async function createProject(project: string): Promise<void> {
  await gerritFetch(`/a/projects/${encodeURIComponent(project)}`, {
    method: 'PUT',
    body: JSON.stringify({
      create_empty_commit: true,
      branches: ['master'],
    }),
  });
}

export async function configureAdminSelfApproval(): Promise<void> {
  await gerritFetch('/a/projects/All-Projects/access', {
    method: 'POST',
    body: JSON.stringify({
      add: {
        'refs/*': {
          permissions: {
            'label-Code-Review': {
              rules: {
                Administrators: { min: -2, max: 2 },
              },
            },
          },
        },
      },
    }),
  });
}

export async function getOpenChanges(project: string): Promise<GerritChange[]> {
  const query = encodeURIComponent(`project:${project} status:open owner:self`);
  const res = await gerritFetch(
    `/a/changes/?q=${query}&o=LABELS&o=SUBMITTABLE&o=CURRENT_REVISION&o=CURRENT_COMMIT&o=MESSAGES`,
  );
  const text = await res.text();
  return parseGerritJson(text) as GerritChange[];
}

export async function getChange(
  changeNumber: number,
  requestDetails: GerritRequestDetail[] = [
    'LABELS',
    'MESSAGES',
    'DETAILED_ACCOUNTS',
  ],
): Promise<GerritChange> {
  const o = requestDetails.map((d) => `o=${d}`).join('&');
  const qs = o ? `?${o}` : '';
  const res = await gerritFetch(`/a/changes/${changeNumber}${qs}`);
  const text = await res.text();
  return parseGerritJson(text) as GerritChange;
}

export async function getReviewers(changeNumber: number): Promise<any[]> {
  const res = await gerritFetch(`/a/changes/${changeNumber}/reviewers/`);
  const text = await res.text();
  return parseGerritJson(text) as any[];
}

const TAG_PULL_REQUEST_BODY = 'pull-request';

export function getPrBodies(changes: GerritChange[]): string[] {
  return changes.flatMap(
    (change) =>
      change.messages
        ?.filter((m) => m.tag === TAG_PULL_REQUEST_BODY)
        .map((m) => m.message) ?? [],
  );
}

export async function pushFilesToGerrit(
  project: string,
  files: Record<string, string>,
): Promise<void> {
  // 1. Create a change
  const createRes = await gerritFetch('/a/changes/', {
    method: 'POST',
    body: JSON.stringify({
      project,
      branch: 'master',
      subject: 'chore: push files',
      status: 'NEW',
    }),
  });
  const createText = await createRes.text();
  const change = parseGerritJson(createText) as { _number: number };
  const changeId = String(change._number);

  // 2. Add each file via Change Edit
  for (const [path, content] of Object.entries(files)) {
    await gerritFetch(
      `/a/changes/${changeId}/edit/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: content,
      },
    );
  }

  // 3. Publish the edit
  await gerritFetch(`/a/changes/${changeId}/edit:publish`, {
    method: 'POST',
    body: JSON.stringify({ notify: 'NONE' }),
  });

  // 4. Approve the change (Code-Review +2)
  await gerritFetch(`/a/changes/${changeId}/revisions/current/review`, {
    method: 'POST',
    body: JSON.stringify({ labels: { 'Code-Review': 2 } }),
  });

  // 5. Submit the change
  await gerritFetch(`/a/changes/${changeId}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function createAndConfigureProject(
  project: string,
  files?: Record<string, string>,
): Promise<void> {
  await createProject(project);
  if (files && Object.keys(files).length > 0) {
    await pushFilesToGerrit(project, files);
  }
}

export async function getFileContent(
  project: string,
  branch: string,
  filePath: string,
): Promise<string | null> {
  const path = `/a/projects/${encodeURIComponent(project)}/branches/${encodeURIComponent(
    branch,
  )}/files/${encodeURIComponent(filePath)}/content`;
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${GERRIT_ADMIN_USERNAME}:${GERRIT_ADMIN_PASSWORD}`,
      ).toString('base64')}`,
    },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Gerrit request failed: GET ${url} → ${res.status} ${res.statusText}\n${body}`,
    );
  }
  const b64 = await res.text();
  return Buffer.from(b64, 'base64').toString();
}

export async function abandonChange(
  changeNumber: number,
  message?: string,
): Promise<void> {
  await gerritFetch(`/a/changes/${changeNumber}/abandon`, {
    method: 'POST',
    body: JSON.stringify({ message, notify: 'OWNER_REVIEWERS' }),
  });
}

export async function setLabel(
  changeNumber: number,
  label: string,
  value: number,
): Promise<void> {
  await gerritFetch(`/a/changes/${changeNumber}/revisions/current/review`, {
    method: 'POST',
    body: JSON.stringify({ labels: { [label]: value }, notify: 'NONE' }),
  });
}

export async function submitChange(changeNumber: number): Promise<void> {
  await gerritFetch(`/a/changes/${changeNumber}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function setHashtags(
  changeNumber: number,
  { add = [], remove = [] }: { add?: string[]; remove?: string[] },
): Promise<void> {
  if (add.length === 0 && remove.length === 0) {
    return;
  }
  await gerritFetch(`/a/changes/${changeNumber}/hashtags`, {
    method: 'POST',
    body: JSON.stringify({ add, remove }),
  });
}

export async function createBranch(
  project: string,
  branchName: string,
  revision: string,
): Promise<void> {
  await gerritFetch(
    `/a/projects/${encodeURIComponent(project)}/branches/${encodeURIComponent(branchName)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ revision }),
    },
  );
}

export async function createGerritUser(
  username: string,
  password: string,
  displayName = username,
): Promise<void> {
  // Create the account as admin
  await gerritFetch(`/a/accounts/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: JSON.stringify({
      username,
      name: displayName,
      email: `${username}@example.com`,
    }),
  });

  // Set the HTTP password for the new user
  await gerritFetch(
    `/a/accounts/${encodeURIComponent(username)}/password.http`,
    {
      method: 'PUT',
      body: JSON.stringify({ http_password: password }),
    },
  );
}

export async function amendChangeAsOtherUser(
  changeNumber: number,
  username: string,
  password: string,
  filePath: string,
  content: string,
): Promise<void> {
  const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const base = getBaseUrl().replace(/\/$/, '');

  // Upload file via the change edit API as the other user (this will create a new revision)
  const editUrl = `${base}/a/changes/${changeNumber}/edit/${encodeURIComponent(filePath)}`;
  const editRes = await fetch(editUrl, {
    method: 'PUT',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });
  if (!editRes.ok) {
    const body = await editRes.text();
    throw new Error(
      `amendChangeAsOtherUser edit failed: ${editRes.status} ${body}`,
    );
  }

  // Publish the edit → creates new patch set with uploader = the authenticated user
  const publishUrl = `${base}/a/changes/${changeNumber}/edit:publish`;
  const publishRes = await fetch(publishUrl, {
    method: 'POST',
    headers: {
      Authorization: auth,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ notify: 'NONE' }),
  });
  if (!publishRes.ok) {
    const body = await publishRes.text();
    throw new Error(
      `amendChangeAsOtherUser publish failed: ${publishRes.status} ${body}`,
    );
  }
}

/** Gerrit Change-Id must be `I` + 40 hex chars (SHA-1 format). */
function makeChangeId(): string {
  const h = createHash('sha1')
    .update(randomUUID() + Date.now().toString(16))
    .digest('hex');
  return `I${h}`;
}

/**
 * Creates an *open* (unsubmitted) Gerrit change that looks like one created by Renovate:
 * - commit message contains `Renovate-Branch: <branchName>`
 * - has a tagged 'pull-request' message with the given body
 *
 * Returns the change number and current revision sha.
 */
export async function createOpenRenovateChange(
  project: string,
  opts: {
    branchName: string;
    subject: string;
    prBody: string;
    files: Record<string, string>;
  },
): Promise<{ number: number; revision: string }> {
  const tmp = await mkdtemp(join(tmpdir(), 'gerrit-synth-'));
  const base = getBaseUrl().replace(/\/$/, '');
  const remote = `${base.replace(
    'http://',
    `http://${GERRIT_ADMIN_USERNAME}:${GERRIT_ADMIN_PASSWORD}@`,
  )}/a/${encodeURIComponent(project)}`;

  // Prepare a git repo with the desired commit (with footer), based on current master
  await execa('git', ['init', '-b', 'main'], { cwd: tmp });
  await execa('git', ['config', 'user.name', 'Renovate Gerrit'], { cwd: tmp });
  await execa('git', ['config', 'user.email', 'renovate-gerrit@example.com'], {
    cwd: tmp,
  });
  await execa('git', ['remote', 'add', 'origin', remote], { cwd: tmp });

  // Fetch current master so our commit has common ancestry
  await execa('git', ['fetch', 'origin', 'master', '--depth=1'], { cwd: tmp });
  await execa('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: tmp });

  for (const [filePath, content] of Object.entries(opts.files)) {
    const full = join(tmp, filePath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
    await execa('git', ['add', filePath], { cwd: tmp });
  }

  const fullMessage = `${opts.subject}\n\nRenovate-Branch: ${opts.branchName}\nChange-Id: ${makeChangeId()}`;
  await execa('git', ['commit', '-m', fullMessage], { cwd: tmp });

  // Push for review (creates open change)
  const push = await execa('git', ['push', 'origin', 'HEAD:refs/for/master'], {
    cwd: tmp,
    all: true,
  });

  // Parse change number from output, e.g. ".../c/NNN ..." or "New Changes:"
  const out = push.all ?? push.stdout ?? '';
  const match = /\/\+(\d+)|\/c\/(\d+)|#(\d+)/.exec(out);
  let changeNum = match
    ? parseInt(match[1] || match[2] || match[3] || '0', 10) || undefined
    : undefined;

  if (!changeNum) {
    // Fallback: query the most recent open change by us with matching subject fragment
    const recent = await getOpenChanges(project);
    const found = recent.find((c) =>
      c.subject.includes(opts.subject.slice(0, 20)),
    );
    if (found) {
      changeNum = found._number;
    }
  }

  if (!changeNum) {
    throw new Error(
      `Could not determine change number after synthetic push. Output:\n${out}`,
    );
  }

  // Add the PR body as tagged message (like Renovate does)
  await gerritFetch(`/a/changes/${changeNum}/revisions/current/review`, {
    method: 'POST',
    body: JSON.stringify({
      message: opts.prBody,
      tag: 'pull-request',
      notify: 'NONE',
    }),
  });

  // Fetch current revision
  const ch = await getChange(changeNum, ['CURRENT_REVISION']);
  const revision = ch.current_revision!;
  if (!revision) {
    throw new Error('Synthetic change has no current_revision');
  }

  return { number: changeNum, revision };
}

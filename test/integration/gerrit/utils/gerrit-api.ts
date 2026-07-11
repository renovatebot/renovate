import { isNonEmptyObject, isNonEmptyString } from '@sindresorhus/is';
import type { GerritChange } from '../../../../lib/modules/platform/gerrit/schema.ts';
import type { GerritRequestDetail } from '../../../../lib/modules/platform/gerrit/types.ts';
import { TAG_PULL_REQUEST_BODY } from '../../../../lib/modules/platform/gerrit/utils.ts';
import { regEx } from '../../../../lib/util/regex.ts';
import {
  GERRIT_ADMIN_PASSWORD,
  GERRIT_ADMIN_USERNAME,
  getBaseUrl,
} from './gerrit-container.ts';

const gerritMagicPrefixRe = regEx(/^\)\]\}'\n/);

function parseGerritJson(text: string): unknown {
  return JSON.parse(text.replace(gerritMagicPrefixRe, ''));
}

function basicAuth(
  username = GERRIT_ADMIN_USERNAME,
  password = GERRIT_ADMIN_PASSWORD,
): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

async function gerritFetch(
  path: string,
  options: RequestInit = {},
  auth = basicAuth(),
): Promise<Response> {
  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: auth,
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

async function gerritJson<T>(path: string, options?: RequestInit): Promise<T> {
  return parseGerritJson(await (await gerritFetch(path, options)).text()) as T;
}

/** Create change, edit files, optionally set message / submit. */
async function writeChange(
  project: string,
  files: Record<string, string>,
  opts: {
    subject: string;
    message?: string;
    submit?: boolean;
  },
): Promise<{ number: number; change_id: string }> {
  const change = await gerritJson<{ _number: number; change_id: string }>(
    '/a/changes/',
    {
      method: 'POST',
      body: JSON.stringify({
        project,
        branch: 'master',
        subject: opts.subject,
        status: 'NEW',
      }),
    },
  );
  const id = String(change._number);

  for (const [path, content] of Object.entries(files)) {
    await gerritFetch(`/a/changes/${id}/edit/${encodeURIComponent(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: content,
    });
  }

  if (isNonEmptyString(opts.message)) {
    const message = opts.message.includes('Change-Id:')
      ? opts.message
      : `${opts.message.trimEnd()}\nChange-Id: ${change.change_id}\n`;
    await gerritFetch(`/a/changes/${id}/edit:message`, {
      method: 'PUT',
      body: JSON.stringify({ message }),
    });
  }

  await gerritFetch(`/a/changes/${id}/edit:publish`, {
    method: 'POST',
    body: JSON.stringify({ notify: 'NONE' }),
  });

  if (opts.submit) {
    await setLabel(change._number, 'Code-Review', 2);
    await gerritFetch(`/a/changes/${id}/submit`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  return { number: change._number, change_id: change.change_id };
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
  return gerritJson(
    `/a/changes/?q=${query}&o=LABELS&o=SUBMITTABLE&o=CURRENT_REVISION&o=CURRENT_COMMIT&o=MESSAGES`,
  );
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
  return gerritJson(`/a/changes/${changeNumber}${o ? `?${o}` : ''}`);
}

export async function getReviewers(
  changeNumber: number,
): Promise<{ username?: string }[]> {
  return gerritJson(`/a/changes/${changeNumber}/reviewers/`);
}

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
  await writeChange(project, files, {
    subject: 'chore: push files',
    submit: true,
  });
}

export async function createAndConfigureProject(
  project: string,
  files?: Record<string, string>,
): Promise<void> {
  await createProject(project);
  if (isNonEmptyObject(files)) {
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
    headers: { Authorization: basicAuth() },
  });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(
      `Gerrit request failed: GET ${url} → ${res.status} ${res.statusText}\n${await res.text()}`,
    );
  }
  return Buffer.from(await res.text(), 'base64').toString();
}

export async function abandonChange(changeNumber: number): Promise<void> {
  await gerritFetch(`/a/changes/${changeNumber}/abandon`, {
    method: 'POST',
    body: JSON.stringify({ notify: 'OWNER_REVIEWERS' }),
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

/**
 * Create or override a project label definition (e.g. Code-Review with max +1).
 * Requires admin write access to refs/meta/config.
 */
export async function setProjectLabel(
  project: string,
  labelName: string,
  definition: {
    values: Record<string, string>;
    default_value: number;
  },
): Promise<void> {
  await gerritFetch(
    `/a/projects/${encodeURIComponent(project)}/labels/${encodeURIComponent(labelName)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        commit_message: `Set ${labelName} label definition`,
        values: definition.values,
        default_value: definition.default_value,
      }),
    },
  );
}

export async function setHashtags(
  changeNumber: number,
  add: string[],
): Promise<void> {
  await gerritFetch(`/a/changes/${changeNumber}/hashtags`, {
    method: 'POST',
    body: JSON.stringify({ add }),
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
  await gerritFetch(`/a/accounts/${encodeURIComponent(username)}`, {
    method: 'PUT',
    body: JSON.stringify({
      username,
      name: displayName,
      email: `${username}@example.com`,
    }),
  });
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
  const auth = basicAuth(username, password);
  await gerritFetch(
    `/a/changes/${changeNumber}/edit/${encodeURIComponent(filePath)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: content,
    },
    auth,
  );
  await gerritFetch(
    `/a/changes/${changeNumber}/edit:publish`,
    {
      method: 'POST',
      body: JSON.stringify({ notify: 'NONE' }),
    },
    auth,
  );
}

/**
 * Open change that looks like Renovate's: Renovate-Branch footer + pull-request tag.
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
  const created = await writeChange(project, opts.files, {
    subject: opts.subject,
    message: `${opts.subject}\n\nRenovate-Branch: ${opts.branchName}\n`,
  });

  await gerritFetch(`/a/changes/${created.number}/revisions/current/review`, {
    method: 'POST',
    body: JSON.stringify({
      message: opts.prBody,
      tag: TAG_PULL_REQUEST_BODY,
      notify: 'NONE',
    }),
  });

  const ch = await getChange(created.number, ['CURRENT_REVISION']);
  if (!isNonEmptyString(ch.current_revision)) {
    throw new Error('Synthetic change has no current_revision');
  }
  return { number: created.number, revision: ch.current_revision };
}

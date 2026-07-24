import { isNonEmptyObject, isNonEmptyString } from '@sindresorhus/is';
import type { GerritChange } from '../../../../lib/modules/platform/gerrit/schema.ts';
import type { GerritRequestDetail } from '../../../../lib/modules/platform/gerrit/types.ts';
import { TAG_PULL_REQUEST_BODY } from '../../../../lib/modules/platform/gerrit/utils.ts';
import { regEx } from '../../../../lib/util/regex.ts';
import {
  GERRIT_ADMIN_PASSWORD,
  GERRIT_ADMIN_USERNAME,
  GERRIT_RENOVATE_DISPLAY_NAME,
  GERRIT_RENOVATE_PASSWORD,
  GERRIT_RENOVATE_USERNAME,
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

function renovateAuth(): string {
  return basicAuth(GERRIT_RENOVATE_USERNAME, GERRIT_RENOVATE_PASSWORD);
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

async function gerritJson<T>(
  path: string,
  options?: RequestInit,
  auth = basicAuth(),
): Promise<T> {
  return parseGerritJson(
    await (await gerritFetch(path, options, auth)).text(),
  ) as T;
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
  auth = basicAuth(),
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
    auth,
  );
  const id = String(change._number);

  for (const [path, content] of Object.entries(files)) {
    await gerritFetch(
      `/a/changes/${id}/edit/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: content,
      },
      auth,
    );
  }

  if (isNonEmptyString(opts.message)) {
    const message = opts.message.includes('Change-Id:')
      ? opts.message
      : `${opts.message.trimEnd()}\nChange-Id: ${change.change_id}\n`;
    await gerritFetch(
      `/a/changes/${id}/edit:message`,
      {
        method: 'PUT',
        body: JSON.stringify({ message }),
      },
      auth,
    );
  }

  await gerritFetch(
    `/a/changes/${id}/edit:publish`,
    {
      method: 'POST',
      body: JSON.stringify({ notify: 'NONE' }),
    },
    auth,
  );

  if (opts.submit) {
    await setLabel(change._number, 'Code-Review', 2, auth);
    await gerritFetch(
      `/a/changes/${id}/submit`,
      {
        method: 'POST',
        body: JSON.stringify({}),
      },
      auth,
    );
  }

  return { number: change._number, change_id: change.change_id };
}

export async function createProject(
  project: string,
  opts: {
    requireSignedPush?: boolean;
  } = {},
): Promise<void> {
  await gerritFetch(`/a/projects/${encodeURIComponent(project)}`, {
    method: 'PUT',
    body: JSON.stringify({
      create_empty_commit: true,
      branches: ['master'],
      ...(opts.requireSignedPush
        ? {
            enable_signed_push: 'TRUE',
            require_signed_push: 'TRUE',
          }
        : {}),
    }),
  });
}

/** Register an OpenPGP public key on the given account (default: Renovate bot). */
export async function registerGpgKey(
  publicKeyArmored: string,
  auth = renovateAuth(),
): Promise<void> {
  await gerritFetch(
    '/a/accounts/self/gpgkeys',
    {
      method: 'POST',
      body: JSON.stringify({ add: [publicKeyArmored] }),
    },
    auth,
  );
}

/** Register an OpenSSH public key on the given account (default: Renovate bot). */
export async function registerSshKey(
  publicKey: string,
  auth = renovateAuth(),
): Promise<void> {
  await gerritFetch(
    '/a/accounts/self/sshkeys',
    {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: publicKey,
    },
    auth,
  );
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

/** Open changes owned by the Renovate bot (not admin). */
export async function getOpenChanges(project: string): Promise<GerritChange[]> {
  const query = encodeURIComponent(
    `project:${project} status:open owner:${GERRIT_RENOVATE_USERNAME}`,
  );
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
  opts: {
    requireSignedPush?: boolean;
  } = {},
): Promise<void> {
  await createProject(project, opts);
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

/** File content from a change's current revision (base64-decoded). */
export async function getChangeFileContent(
  changeNumber: number,
  filePath: string,
): Promise<string | null> {
  const path = `/a/changes/${changeNumber}/revisions/current/files/${encodeURIComponent(filePath)}/content`;
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
  auth = basicAuth(),
): Promise<void> {
  await gerritFetch(
    `/a/changes/${changeNumber}/revisions/current/review`,
    {
      method: 'POST',
      body: JSON.stringify({ labels: { [label]: value }, notify: 'NONE' }),
    },
    auth,
  );
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
    function?: string;
    copy_condition?: string;
    allow_post_submit?: boolean;
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
        ...(isNonEmptyString(definition.function)
          ? { function: definition.function }
          : {}),
        ...(isNonEmptyString(definition.copy_condition)
          ? { copy_condition: definition.copy_condition }
          : {}),
        ...(definition.allow_post_submit === undefined
          ? {}
          : { allow_post_submit: definition.allow_post_submit }),
      }),
    },
  );
}

/** Fetch a single project label definition (not including inherited-only labels). */
export async function getProjectLabel(
  project: string,
  labelName: string,
): Promise<{
  values: Record<string, string>;
  default_value: number;
  function?: string;
  copy_condition?: string;
  allow_post_submit?: boolean;
}> {
  return gerritJson(
    `/a/projects/${encodeURIComponent(project)}/labels/${encodeURIComponent(labelName)}`,
  );
}

/**
 * Delete a label defined on the given project.
 * Inherited labels must be deleted from the project that defines them (often All-Projects).
 * Gerrit requires a JSON body when Content-Type is application/json.
 */
export async function deleteProjectLabel(
  project: string,
  labelName: string,
): Promise<void> {
  await gerritFetch(
    `/a/projects/${encodeURIComponent(project)}/labels/${encodeURIComponent(labelName)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({
        commit_message: `Delete ${labelName} label definition`,
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

/** HEAD revision of a project branch (default: master). */
export async function getBranchRevision(
  project: string,
  branch = 'master',
): Promise<string> {
  const body = await gerritJson<{ revision: string }>(
    `/a/projects/${encodeURIComponent(project)}/branches/${encodeURIComponent(branch)}`,
  );
  if (!isNonEmptyString(body.revision)) {
    throw new Error(
      `Branch ${branch} of project ${project} has no revision in response`,
    );
  }
  return body.revision;
}

/**
 * Create a git tag on a project.
 * With `message`, Gerrit creates an annotated tag; without it, a lightweight tag.
 * @see https://gerrit-review.googlesource.com/Documentation/rest-api-projects.html#create-tag
 */
export async function createTag(
  project: string,
  tag: string,
  revision: string,
  opts: { message?: string } = {},
): Promise<void> {
  await gerritFetch(
    `/a/projects/${encodeURIComponent(project)}/tags/${encodeURIComponent(tag)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        revision,
        ...(isNonEmptyString(opts.message) ? { message: opts.message } : {}),
      }),
    },
  );
}

export async function listTags(
  project: string,
): Promise<{ ref: string; revision: string; object?: string }[]> {
  return gerritJson(`/a/projects/${encodeURIComponent(project)}/tags/`);
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

export async function addGroupMember(
  groupName: string,
  username: string,
): Promise<void> {
  await gerritFetch(
    `/a/groups/${encodeURIComponent(groupName)}/members/${encodeURIComponent(username)}`,
    { method: 'PUT', body: '{}' },
  );
}

/**
 * Create the Renovate bot account and grant it Administrators so it can
 * Code-Review +2 / submit like a typical privileged service account.
 * Harness setup (projects, seeds) still uses admin.
 */
export async function ensureRenovateBotAccount(): Promise<void> {
  await createGerritUser(
    GERRIT_RENOVATE_USERNAME,
    GERRIT_RENOVATE_PASSWORD,
    GERRIT_RENOVATE_DISPLAY_NAME,
  );
  await addGroupMember('Administrators', GERRIT_RENOVATE_USERNAME);
}

/** Amend a change as admin (human user), not the Renovate bot. */
export async function amendChangeAsAdmin(
  changeNumber: number,
  filePath: string,
  content: string,
): Promise<void> {
  await gerritFetch(
    `/a/changes/${changeNumber}/edit/${encodeURIComponent(filePath)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: content,
    },
  );
  await gerritFetch(`/a/changes/${changeNumber}/edit:publish`, {
    method: 'POST',
    body: JSON.stringify({ notify: 'NONE' }),
  });
}

/**
 * Open change that looks like Renovate's: owned by the bot account, with
 * Renovate-Branch footer + pull-request tag (author/committer = bot email).
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
  const auth = renovateAuth();
  const created = await writeChange(
    project,
    opts.files,
    {
      subject: opts.subject,
      message: `${opts.subject}\n\nRenovate-Branch: ${opts.branchName}\n`,
    },
    auth,
  );

  await gerritFetch(
    `/a/changes/${created.number}/revisions/current/review`,
    {
      method: 'POST',
      body: JSON.stringify({
        message: opts.prBody,
        tag: TAG_PULL_REQUEST_BODY,
        notify: 'NONE',
      }),
    },
    auth,
  );

  const ch = await getChange(created.number, ['CURRENT_REVISION']);
  if (!isNonEmptyString(ch.current_revision)) {
    throw new Error('Synthetic change has no current_revision');
  }
  return { number: created.number, revision: ch.current_revision };
}

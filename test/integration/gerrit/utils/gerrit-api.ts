import type { GerritChange } from '../../../../lib/modules/platform/gerrit/types.ts';
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

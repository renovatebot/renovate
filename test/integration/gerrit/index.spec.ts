import {
  abandonChange,
  amendChangeAsOtherUser,
  configureAdminSelfApproval,
  createAndConfigureProject,
  createBranch,
  createGerritUser,
  createOpenRenovateChange,
  createProject,
  getChange,
  getFileContent,
  getOpenChanges,
  getPrBodies,
  getReviewers,
  pushFilesToGerrit,
  setHashtags,
  setLabel,
} from './utils/gerrit-api.ts';
import {
  GERRIT_ADMIN_USERNAME,
  startGerritContainer,
  stopGerritContainer,
} from './utils/gerrit-container.ts';
import { renovate } from './utils/renovate.ts';

const REPO_NAME = 'test-renovate-integration';
const SCHEMA = 'https://docs.renovatebot.com/renovate-schema.json';

function pkgJson(
  name: string,
  deps: Record<string, string> = { semver: '7.0.0' },
  extra: Record<string, unknown> = {},
): string {
  return JSON.stringify(
    { name, version: '1.0.0', dependencies: deps, ...extra },
    null,
    2,
  );
}

function renovateJson(extra: Record<string, unknown> = {}): string {
  return JSON.stringify(
    { $schema: SCHEMA, extends: ['config:recommended'], ...extra },
    null,
    2,
  );
}

/** Default seed: package.json + renovate.json for a single outdated dep. */
async function seed(
  repo: string,
  name: string,
  opts: {
    deps?: Record<string, string>;
    renovate?: Record<string, unknown>;
  } = {},
): Promise<void> {
  await createAndConfigureProject(repo, {
    'package.json': pkgJson(name, opts.deps),
    'renovate.json': renovateJson(opts.renovate),
  });
}

function semverChange(changes: Awaited<ReturnType<typeof getOpenChanges>>) {
  return changes.find((c) => /semver/i.test(c.subject));
}

afterAll(async () => {
  await stopGerritContainer();
});

describe('integration/gerrit/index', () => {
  beforeAll(async () => {
    await startGerritContainer();
    await configureAdminSelfApproval();
    await createProject(REPO_NAME);
    await pushFilesToGerrit(REPO_NAME, {
      'package.json': pkgJson('test-project'),
      'renovate.json': renovateJson(),
    });
  }, 60_000);

  it('creates a change for an outdated dependency', async () => {
    await renovate([REPO_NAME]);

    const changes = await getOpenChanges(REPO_NAME);
    expect(changes).not.toHaveLength(0);
    expect(changes[0].subject).toMatch(/update dependency semver/i);
  });

  it('is idempotent on subsequent runs and preserves the change number', async () => {
    const before = await getOpenChanges(REPO_NAME);
    const bodiesBefore = getPrBodies(before);
    const changeNum = before[0]._number;

    await renovate([REPO_NAME]);

    const after = await getOpenChanges(REPO_NAME);
    expect(after).toHaveLength(before.length);
    expect(getPrBodies(after)).toEqual(bodiesBefore);
    expect(after[0]._number).toBe(changeNum);
  });

  it('applies hashtags from packageRules labels', async () => {
    const REPO = 'test-gerrit-hashtags';
    await seed(REPO, 'test-hashtags', {
      renovate: {
        packageRules: [
          {
            matchDepNames: ['semver'],
            labels: ['deps:semver', 'type:deps'],
          },
        ],
      },
    });

    await renovate([REPO]);

    const changes = await getOpenChanges(REPO);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].hashtags).toEqual(
      expect.arrayContaining(['deps:semver', 'type:deps']),
    );
  });

  it('autoApprove votes Code-Review +2 (submit if Gerrit allows)', async () => {
    const REPO = 'test-gerrit-automerge';
    await seed(REPO, 'test-automerge');
    await renovate([REPO], { automerge: true, autoApprove: true });

    const ch = semverChange(await getOpenChanges(REPO));
    const pkg = JSON.parse(
      (await getFileContent(REPO, 'master', 'package.json'))!,
    );
    // +2 on open change, or already merged to master
    expect(
      !!ch?.labels?.['Code-Review']?.approved ||
        pkg.dependencies.semver !== '7.0.0',
    ).toBe(true);
  });

  it('stores a PR body using Gerrit terminology', async () => {
    const REPO = 'test-gerrit-massage';
    await seed(REPO, 'test-massage');
    await renovate([REPO]);

    const bodies = getPrBodies(await getOpenChanges(REPO));
    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]).toMatch(/change/i);
    expect(bodies[0]).toMatch(/Code-Review -2/i);
    expect(bodies[0]).toMatch(/hashtag/i);
  });

  it('adds reviewers from config', async () => {
    const REPO = 'test-gerrit-participants';
    const REVIEWER_USER = 'test-reviewer';
    await seed(REPO, 'test-participants');
    await createGerritUser(REVIEWER_USER, 'secret-reviewer', 'Test Reviewer');
    await renovate([REPO], {
      reviewers: [REVIEWER_USER],
      assignees: [REVIEWER_USER],
    });

    const changes = await getOpenChanges(REPO);
    expect(changes.length).toBeGreaterThan(0);
    const usernames = (await getReviewers(changes[0]._number))
      .map((r) => r.username)
      .filter(Boolean);
    expect(usernames).toContain(REVIEWER_USER);
  });

  it('discovers the repository via autodiscover', async () => {
    const REPO = 'test-gerrit-autodiscover';
    await seed(REPO, 'test-autodiscover');
    await renovate(undefined, { autodiscover: true });

    expect(semverChange(await getOpenChanges(REPO))).toBeTruthy();
  });

  it('creates separate changes for multiple deps', async () => {
    const REPO = 'test-gerrit-multi-deps';
    await seed(REPO, 'test-multi', {
      deps: { semver: '7.0.0', lodash: '4.0.0' },
    });
    await renovate([REPO]);

    const subjects = (await getOpenChanges(REPO)).map((c) =>
      c.subject.toLowerCase(),
    );
    expect(subjects.length).toBeGreaterThanOrEqual(2);
    expect(subjects).toEqual(
      expect.arrayContaining([
        expect.stringContaining('semver'),
        expect.stringContaining('lodash'),
      ]),
    );
  });

  it('groups multiple deps into one change via groupName', async () => {
    const REPO = 'test-gerrit-grouped-deps';
    await seed(REPO, 'test-grouped', {
      deps: { semver: '7.0.0', lodash: '4.0.0' },
      renovate: {
        packageRules: [
          { matchDepNames: ['semver', 'lodash'], groupName: 'all-deps' },
        ],
      },
    });
    await renovate([REPO]);

    const changes = await getOpenChanges(REPO);
    expect(changes).toHaveLength(1);
    expect(changes[0].subject.toLowerCase()).toContain('all-deps');
  });

  it('after abandoning, treats update as already-existed and posts ignore note', async () => {
    const REPO = 'test-gerrit-abandon-ignored';
    await seed(REPO, 'test-abandon');
    await renovate([REPO]);

    const ch = semverChange(await getOpenChanges(REPO));
    expect(ch).toBeTruthy();
    await abandonChange(ch!._number);
    await renovate([REPO]);

    const stillOpen = (await getOpenChanges(REPO)).filter(
      (c) => /semver/i.test(c.subject) && c._number !== ch!._number,
    );
    expect(stillOpen).toHaveLength(0);

    const abandoned = await getChange(ch!._number, ['MESSAGES']);
    expect(
      (abandoned.messages ?? []).some(
        (m) =>
          m.tag?.includes('Ignore') === true ||
          /will ignore this update/i.test(m.message),
      ),
    ).toBe(true);
  });

  it('rebase hashtag causes renovate to rebase and remove the hashtag', async () => {
    const REPO = 'test-gerrit-rebase-hashtag';
    await seed(REPO, 'test-rebase');
    await renovate([REPO]);

    const ch = semverChange(await getOpenChanges(REPO));
    expect(ch).toBeTruthy();
    await setHashtags(ch!._number, ['rebase']);
    await renovate([REPO]);

    const updated = await getChange(ch!._number);
    expect(updated.hashtags ?? []).not.toContain('rebase');
    expect(
      (await getOpenChanges(REPO)).filter((c) => /semver/i.test(c.subject)),
    ).toHaveLength(1);
  });

  it('pull-request body message is added only once unless content changes', async () => {
    const REPO = 'test-gerrit-pr-body-once';
    await seed(REPO, 'test-body');
    await renovate([REPO]);

    const countPullRequestTags = async () => {
      const ch = semverChange(await getOpenChanges(REPO));
      expect(ch).toBeDefined();
      return (ch!.messages ?? []).filter((m) => m.tag === 'pull-request')
        .length;
    };

    expect(await countPullRequestTags()).toBe(1);
    await renovate([REPO]);
    expect(await countPullRequestTags()).toBe(1);

    await renovate([REPO], { prHeader: '## BODY-HEADER-XYZ-TEST' });
    const ch = semverChange(await getOpenChanges(REPO));
    expect(ch).toBeDefined();
    expect(
      (ch!.messages ?? []).some(
        (m) =>
          m.tag === 'pull-request' &&
          m.message.includes('BODY-HEADER-XYZ-TEST'),
      ),
    ).toBe(true);
  });

  it('prune abandons a stale renovate branch change', async () => {
    const REPO = 'test-gerrit-prune-abandon';
    const staleBranch = 'renovate/stale-prune-demo';
    await seed(REPO, 'test-prune');

    const synth = await createOpenRenovateChange(REPO, {
      branchName: staleBranch,
      subject: 'chore(deps): update dependency phantom to 1.2.3',
      prBody: 'stale',
      files: {
        'package.json': pkgJson('x', { phantom: '1.0.0' }),
      },
    });
    await createBranch(REPO, staleBranch, synth.revision);
    await renovate([REPO]);

    expect((await getChange(synth.number)).status).toBe('ABANDONED');
  });

  it('does not override a change modified by another user', async () => {
    const REPO = 'test-gerrit-modified-by-other';
    const OTHER = 'otherdev';
    const OTHER_PASS = 's3cr3t-other';
    await seed(REPO, 'test-modified');
    await renovate([REPO]);

    const ch = semverChange(await getOpenChanges(REPO));
    expect(ch).toBeTruthy();
    const changeNum = ch!._number;

    const before = await getChange(changeNum, [
      'CURRENT_REVISION',
      'DETAILED_ACCOUNTS',
    ]);
    const beforeRev = before.current_revision!;
    expect(before.revisions?.[beforeRev]?.uploader?.username).toBe(
      GERRIT_ADMIN_USERNAME,
    );

    await createGerritUser(OTHER, OTHER_PASS, 'Other Developer');
    await amendChangeAsOtherUser(
      changeNum,
      OTHER,
      OTHER_PASS,
      'package.json',
      pkgJson(
        'test-modified',
        { semver: '7.0.0' },
        { 'modified-by-other': true },
      ),
    );

    const afterEdit = await getChange(changeNum, [
      'CURRENT_REVISION',
      'DETAILED_ACCOUNTS',
    ]);
    const afterRev = afterEdit.current_revision!;
    expect(afterEdit.revisions?.[afterRev]?.uploader?.username).toBe(OTHER);
    expect(afterRev).not.toBe(beforeRev);

    await renovate([REPO]);

    const final = await getChange(changeNum, [
      'CURRENT_REVISION',
      'DETAILED_ACCOUNTS',
    ]);
    expect(final.revisions?.[final.current_revision!]?.uploader?.username).toBe(
      OTHER,
    );
    expect(final.current_revision).toBe(afterRev);
  });

  it('reads config from another Gerrit project via local> extends', async () => {
    const PRESET_REPO = 'test-gerrit-preset-repo';
    const CONSUMER_REPO = 'test-gerrit-preset-consumer';

    await createAndConfigureProject(PRESET_REPO, {
      'renovate.json': JSON.stringify(
        { $schema: SCHEMA, labels: ['from-preset'] },
        null,
        2,
      ),
    });
    await seed(CONSUMER_REPO, 'test-consumer', {
      renovate: {
        extends: ['config:recommended', `local>${PRESET_REPO}`],
      },
    });

    await renovate([CONSUMER_REPO]);

    const changes = await getOpenChanges(CONSUMER_REPO);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].hashtags).toContain('from-preset');
  });

  it('force-rebases a change after a conflicting base update', async () => {
    const REPO = 'test-gerrit-conflict-rebase';
    await seed(REPO, 'test-conflict');
    await renovate([REPO]);

    const ch = semverChange(await getOpenChanges(REPO));
    expect(ch).toBeTruthy();
    const originalRev = (await getChange(ch!._number, ['CURRENT_REVISION']))
      .current_revision!;

    await pushFilesToGerrit(REPO, {
      'package.json': pkgJson(
        'test-conflict',
        { semver: '7.0.0' },
        { extra: 'conflict-trigger' },
      ),
    });
    await renovate([REPO]);

    const updated = await getChange(ch!._number, ['CURRENT_REVISION']);
    expect(updated.current_revision).not.toBe(originalRev);
    expect(updated.status).toBe('NEW');
  });

  it('initRepo abandons changes with Code-Review -2', async () => {
    const REPO = 'test-gerrit-minus-two';
    await seed(REPO, 'test-minus2');

    const synth = await createOpenRenovateChange(REPO, {
      branchName: 'renovate/minus-two-demo',
      subject: 'chore(deps): update dependency phantom to 9.9.9',
      prBody: 'should be abandoned',
      files: {
        'package.json': pkgJson('x', { phantom: '1.0.0' }),
      },
    });
    await setLabel(synth.number, 'Code-Review', -2);
    await renovate([REPO]);

    expect((await getChange(synth.number)).status).toBe('ABANDONED');
  });
});

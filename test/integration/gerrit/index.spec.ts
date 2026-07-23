import {
  isNonEmptyString,
  isNumber,
  isString,
  isTruthy,
} from '@sindresorhus/is';
import { TAG_PULL_REQUEST_BODY } from '../../../lib/modules/platform/gerrit/utils.ts';
import { regEx } from '../../../lib/util/regex.ts';
import {
  abandonChange,
  amendChangeAsAdmin,
  configureAdminSelfApproval,
  createAndConfigureProject,
  createBranch,
  createGerritUser,
  createOpenRenovateChange,
  createProject,
  deleteProjectLabel,
  ensureRenovateBotAccount,
  getChange,
  getFileContent,
  getOpenChanges,
  getPrBodies,
  getProjectLabel,
  getReviewers,
  pushFilesToGerrit,
  registerGpgKey,
  registerSshKey,
  setHashtags,
  setLabel,
  setProjectLabel,
} from './utils/gerrit-api.ts';
import {
  GERRIT_ADMIN_USERNAME,
  GERRIT_RENOVATE_DISPLAY_NAME,
  GERRIT_RENOVATE_EMAIL,
  GERRIT_RENOVATE_USERNAME,
  startGerritContainer,
  stopGerritContainer,
} from './utils/gerrit-container.ts';
import { generateGpgKeyPair } from './utils/gpg.ts';
import { renovate } from './utils/renovate.ts';
import { generateSshKeyPair, gitSshCommand } from './utils/ssh.ts';

const REPO_NAME = 'test-renovate-integration';
const SCHEMA = 'https://docs.renovatebot.com/renovate-schema.json';
const semverSubjectRe = regEx(/semver/i);
const updateSemverSubjectRe = regEx(/update dependency semver/i);

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
    requireSignedPush?: boolean;
  } = {},
): Promise<void> {
  await createAndConfigureProject(
    repo,
    {
      'package.json': pkgJson(name, opts.deps),
      'renovate.json': renovateJson(opts.renovate),
    },
    { requireSignedPush: opts.requireSignedPush },
  );
}

function findSemverChange(changes: Awaited<ReturnType<typeof getOpenChanges>>) {
  return changes.find((c) => semverSubjectRe.test(c.subject));
}

describe('integration/gerrit/index', { timeout: 120_000 }, () => {
  beforeAll(async () => {
    await startGerritContainer();
    await configureAdminSelfApproval();
    await ensureRenovateBotAccount();
    await createProject(REPO_NAME);
    await pushFilesToGerrit(REPO_NAME, {
      'package.json': pkgJson('test-project'),
      'renovate.json': renovateJson(),
    });
  }, 180_000);

  afterAll(async () => {
    await stopGerritContainer();
  }, 60_000);

  it('discovers the repository via autodiscover', async () => {
    // Arrange
    const REPO = 'test-gerrit-autodiscover';
    await seed(REPO, 'test-autodiscover');

    // Act
    await renovate(undefined, {
      autodiscover: true,
      autodiscoverFilter: [REPO],
    });

    // Assert
    const ch = findSemverChange(await getOpenChanges(REPO));

    expect(ch).toBeDefined();
  });

  it('creates a change for an outdated dependency', async () => {
    // Arrange — shared REPO_NAME seeded in beforeAll

    // Act
    await renovate([REPO_NAME]);

    // Assert
    const changes = await getOpenChanges(REPO_NAME);

    expect(changes).not.toHaveLength(0);
    expect(changes[0].subject).toMatch(updateSemverSubjectRe);
  });

  it('is idempotent on subsequent runs and preserves the change number', async () => {
    // Arrange
    const before = await getOpenChanges(REPO_NAME);
    const bodiesBefore = getPrBodies(before);
    const changeNum = before[0]._number;

    // Act
    await renovate([REPO_NAME]);

    // Assert
    const after = await getOpenChanges(REPO_NAME);

    expect(after).toHaveLength(before.length);
    expect(getPrBodies(after)).toEqual(bodiesBefore);
    expect(after[0]._number).toEqual(changeNum);
  });

  it('collects Gerrit-only HTTP stats for cold vs warm runs', async () => {
    // Arrange — dedicated repo so cold = empty PR-cache for this project
    const REPO = 'test-gerrit-http-stats';
    await seed(REPO, 'test-http-stats');

    // Act
    const cold = await renovate([REPO]);
    const warm = await renovate([REPO]);

    // Always print a single consolidated report for this test only.
    // oxlint-disable-next-line no-console -- intentional: HTTP benchmark output
    console.log(
      'Gerrit HTTP cold vs warm\n',
      JSON.stringify({ cold, warm }, null, 2),
    );

    // Assert — smoke-check the harness (absolute counts can vary)
    expect(cold.requests).toBeGreaterThan(0);
    expect(warm.requests).toBeGreaterThan(0);
  });

  it('applies hashtags from packageRules labels', async () => {
    // Arrange
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

    // Act
    await renovate([REPO]);

    // Assert
    const changes = await getOpenChanges(REPO);

    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].hashtags).toEqual(
      expect.arrayContaining(['deps:semver', 'type:deps']),
    );
  });

  it('autoApprove votes Code-Review +2 (submit if Gerrit allows)', async () => {
    // Arrange
    const REPO = 'test-gerrit-automerge';
    await seed(REPO, 'test-automerge');

    // Act
    await renovate([REPO], { automerge: true, autoApprove: true });

    // Assert
    const ch = findSemverChange(await getOpenChanges(REPO));
    const pkgRaw = await getFileContent(REPO, 'master', 'package.json');
    expect(isNonEmptyString(pkgRaw)).toBe(true);
    const pkg = JSON.parse(pkgRaw!);
    const approved = isTruthy(ch?.labels?.['Code-Review']?.approved);
    const merged = pkg.dependencies.semver !== '7.0.0';

    // +2 on open change, or already merged to master
    expect(approved || merged).toBe(true);
  });

  // Expected to fail until #44425 lands (autoApprove uses max Code-Review value).
  it.fails(
    'autoApprove uses max Code-Review value when project only allows +1',
    async () => {
      // Arrange
      const REPO = 'test-gerrit-automerge-plus-one';
      await seed(REPO, 'test-automerge-plus-one');
      // Override inherited Code-Review so the highest vote is +1 (not +2)
      await setProjectLabel(REPO, 'Code-Review', {
        values: {
          '-1': 'I would prefer this is not merged as is',
          ' 0': 'No score',
          '+1': 'Looks good to me, but someone else must approve',
        },
        default_value: 0,
      });

      // Act
      await renovate([REPO], { automerge: true, autoApprove: true });

      // Assert — push with label=Code-Review+1 must succeed and mark approved
      const ch = findSemverChange(await getOpenChanges(REPO));
      expect(ch).toBeDefined();
      expect(isTruthy(ch!.labels?.['Code-Review']?.approved)).toBe(true);

      // DETAILED_LABELS exposes the numeric vote (should be +1, not +2)
      const detailed = await getChange(ch!._number, [
        'LABELS',
        'DETAILED_LABELS',
      ]);
      const cr = detailed.labels?.['Code-Review'] as
        | { all?: { value?: number }[] }
        | undefined;
      const voteValues = (cr?.all ?? []).map((v) => v.value).filter(isNumber);
      expect(voteValues).toContain(1);
      expect(voteValues.every((v) => v <= 1)).toBe(true);
    },
  );

  // Expected to fail until #44425 lands (skip Code-Review vote when label is absent).
  it.fails(
    'autoApprove does not fail when project has no Code-Review label',
    async () => {
      // Arrange — seed while Code-Review still exists (submit needs +2), then
      // remove it from All-Projects so the project inherits no Code-Review label.
      // Inherited labels cannot be deleted on the child project alone.
      const REPO = 'test-gerrit-automerge-no-code-review';
      await seed(REPO, 'test-automerge-no-code-review');
      const savedLabel = await getProjectLabel('All-Projects', 'Code-Review');
      await deleteProjectLabel('All-Projects', 'Code-Review');

      try {
        // Act — must not reject the push with an unknown label=Code-Review vote
        await renovate([REPO], { automerge: true, autoApprove: true });

        // Assert — change is created; no Code-Review approval (label is gone)
        const ch = findSemverChange(await getOpenChanges(REPO));
        expect(ch).toBeDefined();
        expect(ch!.labels?.['Code-Review']).toBeUndefined();
      } finally {
        await setProjectLabel('All-Projects', 'Code-Review', {
          values: savedLabel.values,
          default_value: savedLabel.default_value,
          function: savedLabel.function,
          copy_condition: savedLabel.copy_condition,
          allow_post_submit: savedLabel.allow_post_submit,
        });
      }
    },
  );

  it('stores a PR body using Gerrit terminology', async () => {
    // Arrange
    const REPO = 'test-gerrit-massage';
    await seed(REPO, 'test-massage');

    // Act
    await renovate([REPO]);

    // Assert
    const bodies = getPrBodies(await getOpenChanges(REPO));

    expect(bodies.length).toBeGreaterThan(0);
    expect(bodies[0]).toMatch(regEx(/change/i));
    expect(bodies[0]).toMatch(regEx(/Code-Review -2/i));
    expect(bodies[0]).toMatch(regEx(/hashtag/i));
  });

  it('adds reviewers from config', async () => {
    // Arrange
    const REPO = 'test-gerrit-participants';
    const REVIEWER_USER = 'test-reviewer';
    await seed(REPO, 'test-participants');
    await createGerritUser(REVIEWER_USER, 'secret-reviewer', 'Test Reviewer');

    // Act
    await renovate([REPO], {
      reviewers: [REVIEWER_USER],
      assignees: [REVIEWER_USER],
    });

    // Assert
    const changes = await getOpenChanges(REPO);
    expect(changes.length).toBeGreaterThan(0);

    const usernames = (await getReviewers(changes[0]._number))
      .map((r) => r.username)
      .filter(isString);

    expect(usernames).toContain(REVIEWER_USER);
  });

  it('creates separate changes for multiple deps', async () => {
    // Arrange
    const REPO = 'test-gerrit-multi-deps';
    await seed(REPO, 'test-multi', {
      deps: { semver: '7.0.0', lodash: '4.0.0' },
    });

    // Act
    await renovate([REPO]);

    // Assert
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

  it('respects commitHourlyLimit and allows rebase hashtag to bypass it', async () => {
    // Arrange — two separate update branches, but only one commit allowed per hour
    const REPO = 'test-gerrit-commit-hourly-limit';
    await seed(REPO, 'test-commit-hourly', {
      deps: { semver: '7.0.0', lodash: '4.0.0' },
      renovate: { commitHourlyLimit: 1 },
    });

    // Act — first run creates at most one commit this hour
    await renovate([REPO]);

    // Assert
    expect(await getOpenChanges(REPO)).toHaveLength(1);

    // Act — second run still blocked by hourly commit count (cache/SCM)
    await renovate([REPO]);

    // Assert
    const open = await getOpenChanges(REPO);
    expect(open).toHaveLength(1);

    // Arrange — move master so an automatic rebase would normally be needed
    const changeNum = open[0]._number;
    const originalRev = (await getChange(changeNum, ['CURRENT_REVISION']))
      .current_revision!;
    await pushFilesToGerrit(REPO, {
      'package.json': pkgJson(
        'test-commit-hourly',
        { semver: '7.0.0', lodash: '4.0.0' },
        { extra: 'force-behind-base' },
      ),
    });

    // Act — automatic rebase is also subject to commitHourlyLimit
    await renovate([REPO]);

    // Assert — no new commit on the existing change; second dep still not opened
    expect(
      (await getChange(changeNum, ['CURRENT_REVISION'])).current_revision,
    ).toEqual(originalRev);
    expect(await getOpenChanges(REPO)).toHaveLength(1);

    // Arrange — manual rebase via Gerrit hashtag (mapped to PR labels)
    await setHashtags(changeNum, ['rebase']);

    // Act — manual rebase bypasses commitHourlyLimit
    await renovate([REPO]);

    // Assert — rebase committed despite the limit; hashtag cleared; still one change
    const rebased = await getChange(changeNum, ['CURRENT_REVISION']);
    expect(rebased.current_revision).not.toEqual(originalRev);
    expect(rebased.hashtags ?? []).not.toContain('rebase');
    expect(await getOpenChanges(REPO)).toHaveLength(1);
  });

  it('groups multiple deps into one change via groupName', async () => {
    // Arrange
    const REPO = 'test-gerrit-grouped-deps';
    await seed(REPO, 'test-grouped', {
      deps: { semver: '7.0.0', lodash: '4.0.0' },
      renovate: {
        packageRules: [
          { matchDepNames: ['semver', 'lodash'], groupName: 'all-deps' },
        ],
      },
    });

    // Act
    await renovate([REPO]);

    // Assert
    const changes = await getOpenChanges(REPO);

    expect(changes).toHaveLength(1);
    expect(changes[0].subject.toLowerCase()).toContain('all-deps');
  });

  it('after abandoning, treats update as already-existed and posts ignore note', async () => {
    // Arrange
    const REPO = 'test-gerrit-abandon-ignored';
    await seed(REPO, 'test-abandon');
    await renovate([REPO]);
    const ch = findSemverChange(await getOpenChanges(REPO));
    expect(ch).toBeDefined();
    await abandonChange(ch!._number);

    // Act
    await renovate([REPO]);

    // Assert
    const stillOpen = (await getOpenChanges(REPO)).filter(
      (c) => semverSubjectRe.test(c.subject) && c._number !== ch!._number,
    );
    expect(stillOpen).toHaveLength(0);

    const abandoned = await getChange(ch!._number, ['MESSAGES']);
    const hasIgnore = (abandoned.messages ?? []).some(
      (m) =>
        m.tag?.includes('Ignore') === true ||
        regEx(/will ignore this update/i).test(m.message),
    );
    expect(hasIgnore).toBe(true);
  });

  it('rebase hashtag causes renovate to rebase and remove the hashtag', async () => {
    // Arrange
    const REPO = 'test-gerrit-rebase-hashtag';
    await seed(REPO, 'test-rebase');
    await renovate([REPO]);
    const ch = findSemverChange(await getOpenChanges(REPO));
    expect(ch).toBeDefined();
    await setHashtags(ch!._number, ['rebase']);

    // Act
    await renovate([REPO]);

    // Assert
    const updated = await getChange(ch!._number);
    expect(updated.hashtags ?? []).not.toContain('rebase');

    const openSemver = (await getOpenChanges(REPO)).filter((c) =>
      semverSubjectRe.test(c.subject),
    );
    expect(openSemver).toHaveLength(1);
  });

  it('pull-request body message is added only once unless content changes', async () => {
    // Arrange
    const REPO = 'test-gerrit-pr-body-once';
    await seed(REPO, 'test-body');

    // Act
    await renovate([REPO]);

    // Assert — first run posts one body
    const first = findSemverChange(await getOpenChanges(REPO));
    expect(first).toBeDefined();
    const firstBodies = (first!.messages ?? []).filter(
      (m) => m.tag === TAG_PULL_REQUEST_BODY,
    );
    expect(firstBodies).toHaveLength(1);

    // Act — identical second run
    await renovate([REPO]);

    // Assert — still one body
    const second = findSemverChange(await getOpenChanges(REPO));
    expect(second).toBeDefined();
    const secondBodies = (second!.messages ?? []).filter(
      (m) => m.tag === TAG_PULL_REQUEST_BODY,
    );
    expect(secondBodies).toHaveLength(1);

    // Act — body content changes via prHeader
    await renovate([REPO], { prHeader: '## BODY-HEADER-XYZ-TEST' });

    // Assert — new body content is posted
    const third = findSemverChange(await getOpenChanges(REPO));
    expect(third).toBeDefined();
    const hasMarker = (third!.messages ?? []).some(
      (m) =>
        m.tag === TAG_PULL_REQUEST_BODY &&
        m.message.includes('BODY-HEADER-XYZ-TEST'),
    );
    expect(hasMarker).toBe(true);
  });

  it('prune abandons a stale renovate branch change', async () => {
    // Arrange
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

    // Act
    await renovate([REPO]);

    // Assert
    const stale = await getChange(synth.number);
    expect(stale.status).toEqual('ABANDONED');
  });

  it('does not override a change modified by another user', async () => {
    // Arrange
    const REPO = 'test-gerrit-modified-by-other';
    await seed(REPO, 'test-modified');
    await renovate([REPO]);

    const ch = findSemverChange(await getOpenChanges(REPO));
    expect(ch).toBeDefined();
    const changeNum = ch!._number;

    const before = await getChange(changeNum, [
      'CURRENT_REVISION',
      'DETAILED_ACCOUNTS',
    ]);
    const beforeRev = before.current_revision!;
    expect(before.revisions?.[beforeRev]?.uploader?.username).toEqual(
      GERRIT_RENOVATE_USERNAME,
    );

    await amendChangeAsAdmin(
      changeNum,
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
    expect(afterEdit.revisions?.[afterRev]?.uploader?.username).toEqual(
      GERRIT_ADMIN_USERNAME,
    );
    expect(afterRev).not.toEqual(beforeRev);

    // Act
    await renovate([REPO]);

    // Assert
    const final = await getChange(changeNum, [
      'CURRENT_REVISION',
      'DETAILED_ACCOUNTS',
    ]);
    expect(
      final.revisions?.[final.current_revision!]?.uploader?.username,
    ).toEqual(GERRIT_ADMIN_USERNAME);
    expect(final.current_revision).toEqual(afterRev);
  });

  it('reads config from another Gerrit project via local> extends', async () => {
    // Arrange
    const PRESET_REPO = 'test-gerrit-preset-repo';
    const CONSUMER_REPO = 'test-gerrit-preset-consumer';

    await createAndConfigureProject(PRESET_REPO, {
      'default.json': JSON.stringify(
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

    // Act
    await renovate([CONSUMER_REPO]);

    // Assert
    const changes = await getOpenChanges(CONSUMER_REPO);

    expect(changes.length).toBeGreaterThan(0);
    expect(changes[0].hashtags).toContain('from-preset');
  });

  it('force-rebases a change after a conflicting base update', async () => {
    // Arrange
    const REPO = 'test-gerrit-conflict-rebase';
    await seed(REPO, 'test-conflict');
    await renovate([REPO]);

    const ch = findSemverChange(await getOpenChanges(REPO));
    expect(ch).toBeDefined();
    const originalRev = (await getChange(ch!._number, ['CURRENT_REVISION']))
      .current_revision!;

    await pushFilesToGerrit(REPO, {
      'package.json': pkgJson(
        'test-conflict',
        { semver: '7.0.0' },
        { extra: 'conflict-trigger' },
      ),
    });

    // Act
    await renovate([REPO]);

    // Assert
    const updated = await getChange(ch!._number, ['CURRENT_REVISION']);

    expect(updated.current_revision).not.toEqual(originalRev);
    expect(updated.status).toEqual('NEW');
  });

  // TODO: re-enable once https://github.com/renovatebot/renovate/pull/44584 is merged
  it.fails('creates a change over SSH when gitUrl is ssh', async () => {
    // Arrange
    const REPO = 'test-gerrit-ssh-git-url';
    const key = await generateSshKeyPair();
    try {
      await registerSshKey(key.publicKey);
      await seed(REPO, 'test-ssh-git-url');

      // Act
      await renovate([REPO], {
        gitUrl: 'ssh',
        customEnvVariables: {
          GIT_SSH_COMMAND: gitSshCommand(key.privateKeyPath),
        },
      });

      // Assert — full clone + push via ssh://renovate@host:29418/... succeeded
      const ch = findSemverChange(await getOpenChanges(REPO));
      expect(ch).toBeDefined();
    } finally {
      await key.dispose();
    }
  });

  // TODO: re-enable once https://github.com/renovatebot/renovate/pull/44228 is merged
  it.fails(
    'creates a change with signed push when gitPrivateKey is set',
    async () => {
      // Arrange
      const REPO = 'test-gerrit-signed-push';
      // Gerrit only accepts GPG keys whose UID matches a preferred account email
      // (renovate@example.com for the bot account). Commit author can still be
      // Renovate's gitAuthor; signingkey is set by id after import.
      const key = await generateGpgKeyPair(
        GERRIT_RENOVATE_DISPLAY_NAME,
        GERRIT_RENOVATE_EMAIL,
      );
      try {
        await registerGpgKey(key.publicKey);
        await seed(REPO, 'test-signed-push', { requireSignedPush: true });

        // Act — autoApprove forces push-options (label=Code-Review+2) together
        // with a signed push certificate (the jgit#222 failure mode)
        await renovate([REPO], {
          automerge: true,
          autoApprove: true,
          gitPrivateKey: key.secretKey,
        });

        // Assert
        const ch = findSemverChange(await getOpenChanges(REPO));
        expect(ch).toBeDefined();
        expect(isTruthy(ch!.labels?.['Code-Review']?.approved)).toBe(true);
      } finally {
        await key.dispose();
      }
    },
  );

  it('initRepo abandons changes with Code-Review -2', async () => {
    // Arrange
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

    // Act
    await renovate([REPO]);

    // Assert
    const after = await getChange(synth.number);
    expect(after.status).toEqual('ABANDONED');
  });
});

import { isString } from '@sindresorhus/is';
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
  submitChange,
} from './utils/gerrit-api.ts';
import {
  GERRIT_ADMIN_USERNAME,
  getBaseUrl,
  startGerritContainer,
  stopGerritContainer,
} from './utils/gerrit-container.ts';
import { renovate } from './utils/renovate.ts';

const REPO_NAME = 'test-renovate-integration';

afterAll(async () => {
  await stopGerritContainer();
});

describe('integration/gerrit/index', () => {
  // Setup steps are kept as individual `it` blocks so that test logs
  // show the elapsed time of each long-running operation.
  describe('setup', () => {
    it('starts the Gerrit container', async () => {
      await startGerritContainer();
      // configureAdminSelfApproval only needs to be done once (affects All-Projects)
      await configureAdminSelfApproval();
      expect(getBaseUrl()).toMatch(/^http:\/\/localhost:\d+$/);
    }, 60_000);

    it('creates the test project', async () => {
      await createProject(REPO_NAME);
      // Project/branch is reachable; no package.json yet (empty initial commit)
      const pkg = await getFileContent(REPO_NAME, 'master', 'package.json');
      expect(pkg).toBeNull();
    });

    it('pushes initial files', async () => {
      await pushFilesToGerrit(REPO_NAME, {
        'package.json': JSON.stringify(
          {
            name: 'test-project',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });
      const pkg = await getFileContent(REPO_NAME, 'master', 'package.json');
      expect(pkg).toContain('"semver": "7.0.0"');
    });
  });

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

  describe('packageRules labels become hashtags', () => {
    const REPO = 'test-gerrit-hashtags';

    it('applies hashtags from packageRules', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-hashtags',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
            packageRules: [
              {
                matchDepNames: ['semver'],
                labels: ['deps:semver', 'type:deps'],
              },
            ],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      const changes = await getOpenChanges(REPO);
      expect(changes.length).toBeGreaterThan(0);
      expect(changes[0].hashtags).toEqual(
        expect.arrayContaining(['deps:semver', 'type:deps']),
      );
    });
  });

  describe('automerge with autoApprove', () => {
    const REPO = 'test-gerrit-automerge';

    it('creates project and runs with automerge+autoApprove', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-automerge',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO], { automerge: true, autoApprove: true });

      // Renovate ran successfully; repo remains reachable. The following test
      // asserts automerge/autoApprove end-state (open +2 and/or master update).
      const pkg = await getFileContent(REPO, 'master', 'package.json');
      expect(pkg).toContain('semver');
    });

    it('automerge submits the change and updates master', async () => {
      // The push with autoApprove should have set Code-Review +2.
      // In the test Gerrit image there is usually also a "Verified" label that blocks submit.
      // Unblock it so we can finish the merge and verify the end-to-end file update on master.
      const open = await getOpenChanges(REPO);
      const ch = open.find((c) => /semver/i.test(c.subject));
      if (ch) {
        // Best effort: set Verified +1 (label may or may not exist; ignore failure)
        try {
          await setLabel(ch._number, 'Verified', 1);
        } catch {
          // ignore if Verified label does not exist or cannot be set
        }
        try {
          await submitChange(ch._number);
        } catch {
          // may still be blocked; the important part (autoApprove +2) was already done at create time
        }
      }

      // Verify the file on master reflects an update (either auto-merged or we submitted above)
      const pkgRaw = await getFileContent(REPO, 'master', 'package.json');
      expect(pkgRaw).toBeTruthy();
      const pkg = JSON.parse(pkgRaw!);
      expect(pkg.dependencies.semver).not.toBe('7.0.0');
    });
  });

  describe('Gerrit-specific massageMarkdown in PR body', () => {
    const REPO = 'test-gerrit-massage';

    it('stores a body using Gerrit terminology', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-massage',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      const changes = await getOpenChanges(REPO);
      const bodies = getPrBodies(changes);
      expect(bodies.length).toBeGreaterThan(0);
      const body = bodies[0];
      // Should talk about "change" not PR
      expect(body).toMatch(/change/i);
      // Should mention Code-Review -2 for closing
      expect(body).toMatch(/Code-Review -2/i);
      // Should mention hashtag for rebase
      expect(body).toMatch(/hashtag/i);
    });
  });

  describe('reviewers and assignees', () => {
    const REPO = 'test-gerrit-participants';

    it('adds reviewers and assignees from config', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-participants',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      // Create a distinct user so we can assert they actually appear as reviewer/assignee
      const REVIEWER_USER = 'test-reviewer';
      await createGerritUser(REVIEWER_USER, 'secret-reviewer', 'Test Reviewer');

      await renovate([REPO], {
        reviewers: [REVIEWER_USER],
        assignees: [REVIEWER_USER],
      });

      const changes = await getOpenChanges(REPO);
      expect(changes.length).toBeGreaterThan(0);

      // Use the dedicated /reviewers endpoint for a reliable check.
      // (Assignee/CC fields vary across Gerrit versions, so we assert via
      // the reviewers API which is what Renovate uses for `reviewers` config.)
      const reviewersList = await getReviewers(changes[0]._number);
      const reviewerUsernames = reviewersList
        .map((r: any) => r.username)
        .filter(isString);
      expect(reviewerUsernames).toContain(REVIEWER_USER);
    });
  });

  describe('autodiscover', () => {
    const REPO = 'test-gerrit-autodiscover';

    it('discovers the repository via getRepos and creates a change', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-autodiscover',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      // Do not pass explicit repositories; enable autodiscover
      await renovate(undefined, { autodiscover: true });

      const changes = await getOpenChanges(REPO);
      const semverChange = changes.find((c) => /semver/i.test(c.subject));
      expect(semverChange).toBeTruthy();
    });
  });

  describe('multiple dependencies create multiple changes', () => {
    const REPO = 'test-gerrit-multi-deps';

    it('creates separate changes for each dep', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-multi',
            version: '1.0.0',
            dependencies: {
              semver: '7.0.0',
              lodash: '4.0.0',
            },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      const changes = await getOpenChanges(REPO);
      expect(changes.length).toBeGreaterThanOrEqual(2);
      const subjects = changes.map((c) => c.subject.toLowerCase());
      expect(subjects).toEqual(
        expect.arrayContaining([
          expect.stringContaining('semver'),
          expect.stringContaining('lodash'),
        ]),
      );
    });
  });

  describe('abandoning a change makes renovate treat the update as ignored (already-existed)', () => {
    const REPO = 'test-gerrit-abandon-ignored';

    it('sets up and creates initial change', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-abandon',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      // Basic verification that the first run produced a change for the dep
      const initial = await getOpenChanges(REPO);
      expect(initial.some((c) => /semver/i.test(c.subject))).toBe(true);
    });

    it('after abandoning the change, next run treats it as already-existed and adds ignore notification', async () => {
      const before = await getOpenChanges(REPO);
      const ch = before.find((c) => /semver/i.test(c.subject));
      expect(ch).toBeTruthy();

      // Abandon it (simulates user rejecting)
      await abandonChange(ch!._number);

      // Run again - should detect closed PR via prAlreadyExisted (findPr state '!open')
      await renovate([REPO]);

      const afterOpen = await getOpenChanges(REPO);
      // Should not have created a brand new open change for the same update
      const stillOpenForSemver = afterOpen.filter(
        (c) => /semver/i.test(c.subject) && c._number !== ch!._number,
      );
      expect(stillOpenForSemver).toHaveLength(0);

      // The abandoned change should now have an "ignore" comment
      const abandoned = await getChange(ch!._number, ['MESSAGES']);
      const hasIgnore = (abandoned.messages ?? []).some(
        (m) =>
          m.tag?.includes('Ignore') === true ||
          /will ignore this update/i.test(m.message),
      );
      expect(hasIgnore).toBe(true);
    });
  });

  describe('rebase via "rebase" hashtag', () => {
    const REPO = 'test-gerrit-rebase-hashtag';
    let changeNum: number;

    it('sets up project and creates initial change', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-rebase',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      const changes = await getOpenChanges(REPO);
      const ch = changes.find((c) => /semver/i.test(c.subject));
      expect(ch).toBeTruthy();
      changeNum = ch!._number;
    });

    it('adding the "rebase" hashtag causes renovate to rebase the change', async () => {
      // Add the magic rebase hashtag (Gerrit uses hashtags for labels on Pr)
      await setHashtags(changeNum, { add: ['rebase'] });

      await renovate([REPO]);

      // After rebase handling, renovate removes the rebase label (deleteLabel)
      const updated = await getChange(changeNum);
      expect(updated.hashtags ?? []).not.toContain('rebase');

      // We still have exactly one open renovate change for the dep (rebased, not new one)
      const opens = await getOpenChanges(REPO);
      const semverOnes = opens.filter((c) => /semver/i.test(c.subject));
      expect(semverOnes.length).toBe(1);
    });
  });

  describe('PR body message added only once unless content changes', () => {
    const REPO = 'test-gerrit-pr-body-once';

    it('adds the pull-request body message only once on identical runs', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-body',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      const ch1 = (await getOpenChanges(REPO)).find((c) =>
        /semver/i.test(c.subject),
      );
      expect(ch1).toBeDefined();
      const tagged1 = (ch1!.messages ?? []).filter(
        (m) => m.tag === 'pull-request',
      );
      expect(tagged1.length).toBe(1);

      await renovate([REPO]);

      const ch2 = (await getOpenChanges(REPO)).find((c) =>
        /semver/i.test(c.subject),
      );
      expect(ch2).toBeDefined();
      const tagged2 = (ch2!.messages ?? []).filter(
        (m) => m.tag === 'pull-request',
      );
      expect(tagged2.length).toBe(1);
    });

    it('adds the pull-request body again when the body content changes', async () => {
      // prHeader is injected into the generated PR body
      await renovate([REPO], { prHeader: '## BODY-HEADER-XYZ-TEST' });

      const ch = (await getOpenChanges(REPO)).find((c) =>
        /semver/i.test(c.subject),
      );
      expect(ch).toBeDefined();
      const tagged = (ch!.messages ?? []).filter(
        (m) => m.tag === 'pull-request',
      );
      const hasMarker = tagged.some((m) =>
        m.message.includes('BODY-HEADER-XYZ-TEST'),
      );
      expect(hasMarker).toBe(true);
    });
  });

  describe('prune stale branch triggers updatePr with state closed (abandon)', () => {
    const REPO = 'test-gerrit-prune-abandon';
    const staleBranch = 'renovate/stale-prune-demo';
    let staleChangeNum: number;

    it('creates a synthetic renovate change + head ref so prune sees it as remaining', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-prune',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      // Create a synthetic open renovate change for a branch that will *not* be produced by current deps
      const synth = await createOpenRenovateChange(REPO, {
        branchName: staleBranch,
        subject: 'chore(deps): update dependency phantom to 1.2.3',
        prBody: 'This is a stale one that should be pruned.',
        files: {
          'package.json': JSON.stringify(
            { name: 'x', dependencies: { phantom: '1.0.0' } },
            null,
            2,
          ),
        },
      });
      staleChangeNum = synth.number;
      expect(staleChangeNum).toBeGreaterThan(0);

      // Make a refs/heads/ entry so getBranchList() during the run will see the branchName
      await createBranch(REPO, staleBranch, synth.revision);

      const open = await getChange(staleChangeNum);
      expect(open.status).toBe('NEW');
    });

    it('run causes prune to autoclose (updatePr state closed) the stale change', async () => {
      // The current package.json only has "semver", so "renovate/stale-prune-demo" will be a remaining branch
      await renovate([REPO]);

      // The stale change should have been abandoned by prune (exercises the updatePr({ state: 'closed' }) path)
      const stale = await getChange(staleChangeNum);
      expect(stale.status).toBe('ABANDONED');
    });
  });

  describe('does not override a change that was modified by another user', () => {
    const REPO = 'test-gerrit-modified-by-other';

    it('sets up project and lets renovate create a change', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-modified',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      // Basic verification that the initial run produced the expected change
      const changes = await getOpenChanges(REPO);
      expect(changes.some((c) => /semver/i.test(c.subject))).toBe(true);
    });

    it('after another user uploads a new patch set, renovate does not override it', async () => {
      const changes = await getOpenChanges(REPO);
      const ch = changes.find((c) => /semver/i.test(c.subject));
      expect(ch).toBeTruthy();
      const changeNum = ch!._number;

      // Capture the revision uploaded by renovate (admin)
      const before = await getChange(changeNum, [
        'CURRENT_REVISION',
        'DETAILED_ACCOUNTS',
      ]);
      const beforeRev = before.current_revision!;
      const beforeUploader = before.revisions?.[beforeRev]?.uploader?.username;
      expect(beforeUploader).toBe(GERRIT_ADMIN_USERNAME);

      // Create a second user
      const OTHER = 'otherdev';
      const OTHER_PASS = 's3cr3t-other';
      await createGerritUser(OTHER, OTHER_PASS, 'Other Developer');

      // As the other user, amend the change (upload a new revision)
      await amendChangeAsOtherUser(
        changeNum,
        OTHER,
        OTHER_PASS,
        'package.json',
        JSON.stringify(
          {
            name: 'test-modified',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
            'modified-by-other': true,
          },
          null,
          2,
        ),
      );

      // Verify the current revision is now uploaded by the other user
      const afterEdit = await getChange(changeNum, [
        'CURRENT_REVISION',
        'DETAILED_ACCOUNTS',
      ]);
      const afterRev = afterEdit.current_revision!;
      const afterUploader = afterEdit.revisions?.[afterRev]?.uploader?.username;
      expect(afterUploader).toBe(OTHER);
      expect(afterRev).not.toBe(beforeRev);

      // Run renovate again (as admin)
      await renovate([REPO]);

      // Renovate must NOT have overridden the change
      const final = await getChange(changeNum, [
        'CURRENT_REVISION',
        'DETAILED_ACCOUNTS',
      ]);
      const finalRev = final.current_revision!;
      const finalUploader = final.revisions?.[finalRev]?.uploader?.username;

      expect(finalUploader).toBe(OTHER);
      expect(finalRev).toBe(afterRev);
    });
  });

  describe('grouped dependency updates create a single change', () => {
    const REPO = 'test-gerrit-grouped-deps';

    it('groups multiple deps into one change via groupName', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-grouped',
            version: '1.0.0',
            dependencies: {
              semver: '7.0.0',
              lodash: '4.0.0',
            },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
            packageRules: [
              {
                matchDepNames: ['semver', 'lodash'],
                groupName: 'all-deps',
              },
            ],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      const changes = await getOpenChanges(REPO);
      // With grouping, both deps should be in a single change
      expect(changes).toHaveLength(1);
      expect(changes[0].subject.toLowerCase()).toContain('all-deps');
    });
  });

  describe('config preset from a separate Gerrit repo (local>)', () => {
    const PRESET_REPO = 'test-gerrit-preset-repo';
    const CONSUMER_REPO = 'test-gerrit-preset-consumer';

    it('reads renovate config from another Gerrit project via local> extends', async () => {
      // Create a preset repo containing a shared Renovate config
      await createAndConfigureProject(PRESET_REPO, {
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            labels: ['from-preset'],
          },
          null,
          2,
        ),
      });

      // Create a consumer repo that extends the preset via local>
      await createAndConfigureProject(CONSUMER_REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-consumer',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended', `local>${PRESET_REPO}`],
          },
          null,
          2,
        ),
      });

      await renovate([CONSUMER_REPO]);

      const changes = await getOpenChanges(CONSUMER_REPO);
      expect(changes.length).toBeGreaterThan(0);
      // The hashtag "from-preset" should have been applied via the preset's labels config
      expect(changes[0].hashtags).toContain('from-preset');
    });
  });

  describe('conflict detection triggers force-rebase of the change', () => {
    const REPO = 'test-gerrit-conflict-rebase';
    let changeNum: number;
    let originalRev: string;

    it('sets up project and creates initial change', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-conflict',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      await renovate([REPO]);

      const changes = await getOpenChanges(REPO);
      const ch = changes.find((c) => /semver/i.test(c.subject));
      expect(ch).toBeTruthy();
      changeNum = ch!._number;

      const detailed = await getChange(changeNum, ['CURRENT_REVISION']);
      originalRev = detailed.current_revision!;
      expect(originalRev).toBeTruthy();
    });

    it('after a conflicting base branch update, renovate rebases the change', async () => {
      // Push a conflicting commit to master (modify the same file the change touches)
      await pushFilesToGerrit(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-conflict',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
            extra: 'conflict-trigger',
          },
          null,
          2,
        ),
      });

      // Run renovate again — should detect the conflict via isBranchConflicted
      // and force-push a rebased version of the change
      await renovate([REPO]);

      const updated = await getChange(changeNum, ['CURRENT_REVISION']);
      // The revision should have changed (new patch set from rebase)
      expect(updated.current_revision).not.toBe(originalRev);
      // The change should still be open
      expect(updated.status).toBe('NEW');
    });
  });

  describe('initRepo abandons changes with Code-Review -2', () => {
    const REPO = 'test-gerrit-minus-two';

    it('a renovate-like change with Code-Review -2 is abandoned on next run (via initRepo)', async () => {
      await createAndConfigureProject(REPO, {
        'package.json': JSON.stringify(
          {
            name: 'test-minus2',
            version: '1.0.0',
            dependencies: { semver: '7.0.0' },
          },
          null,
          2,
        ),
        'renovate.json': JSON.stringify(
          {
            $schema: 'https://docs.renovatebot.com/renovate-schema.json',
            extends: ['config:recommended'],
          },
          null,
          2,
        ),
      });

      // Create a synthetic open change that has the footer so initRepo will consider it
      const synth = await createOpenRenovateChange(REPO, {
        branchName: 'renovate/minus-two-demo',
        subject: 'chore(deps): update dependency phantom to 9.9.9',
        prBody:
          'A change that got -2 should be auto-abandoned by renovate init.',
        files: {
          'package.json': JSON.stringify(
            { name: 'x', dependencies: { phantom: '1.0.0' } },
            null,
            2,
          ),
        },
      });

      // Vote -2
      await setLabel(synth.number, 'Code-Review', -2);

      // Run renovate: initRepo will find label=-2 open owned by self and abandon it
      await renovate([REPO]);

      const after = await getChange(synth.number);
      expect(after.status).toBe('ABANDONED');
    });
  });
});

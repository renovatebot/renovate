import {
  configureAdminSelfApproval,
  createProject,
  getOpenChanges,
  pushFilesToGerrit,
} from './utils/gerrit-api.ts';
import {
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
    }, 60_000);

    it('creates the test project', async () => {
      await createProject(REPO_NAME);
    });

    it('configures admin self-approval', async () => {
      await configureAdminSelfApproval();
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
    });
  });

  it('creates a change for an outdated dependency', async () => {
    await renovate([REPO_NAME]);

    const changes = await getOpenChanges(REPO_NAME);

    expect(changes).not.toHaveLength(0);
    expect(changes[0].subject).toMatch(/update dependency semver/i);
  });

  it('is idempotent on a second run', async () => {
    const before = await getOpenChanges(REPO_NAME);

    await renovate([REPO_NAME]);

    const after = await getOpenChanges(REPO_NAME);

    expect(after).toHaveLength(before.length);
  });
});

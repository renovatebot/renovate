import { codeBlock } from 'common-tags';
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';

// 3.14+ includes a jgit that accepts signed push + push-options together
// (see eclipse-jgit/jgit#222). 3.8.x rejects that combination.
const GERRIT_IMAGE = 'gerritcodereview/gerrit:3.14.1-ubuntu24';
const GERRIT_CONTAINER_NAME = 'gerrit-renovate-integration-test';

/** Gerrit sshd port — Renovate hardcodes this in createSshUrl. */
export const GERRIT_SSH_PORT = 29418;

/** Admin: harness setup (projects, seeds, access config) and "human user" ops. */
export const GERRIT_ADMIN_USERNAME = 'admin';
export const GERRIT_ADMIN_PASSWORD = 'secret';

/**
 * Dedicated Renovate bot account. Used as Renovate platform credentials and
 * for synthetic "looks like Renovate" changes so git author/committer match.
 */
export const GERRIT_RENOVATE_USERNAME = 'renovate';
export const GERRIT_RENOVATE_PASSWORD = 'renovate-secret';
export const GERRIT_RENOVATE_DISPLAY_NAME = 'Renovate Bot';
export const GERRIT_RENOVATE_EMAIL = `${GERRIT_RENOVATE_USERNAME}@example.com`;
export const GERRIT_RENOVATE_GIT_AUTHOR = `${GERRIT_RENOVATE_DISPLAY_NAME} <${GERRIT_RENOVATE_EMAIL}>`;

let container: StartedTestContainer;
let baseUrl: string;

export function getBaseUrl(): string {
  return baseUrl;
}

export async function startGerritContainer(): Promise<void> {
  container = await new GenericContainer(GERRIT_IMAGE)
    // Bind SSH to the host's well-known 29418 so gitUrl=ssh URLs work
    // (Renovate always uses port 29418; HTTP can stay on a random port).
    .withExposedPorts(8080, {
      container: GERRIT_SSH_PORT,
      host: GERRIT_SSH_PORT,
    })
    .withEnvironment({
      GERRIT_ADMIN_USERNAME,
      GERRIT_ADMIN_PASSWORD,
    })
    .withName(GERRIT_CONTAINER_NAME)
    // Enable server-side signed-push support before the stock entrypoint runs
    .withEntrypoint([
      'bash',
      '-c',
      'git config -f /var/gerrit/etc/gerrit.config receive.enableSignedPush true && exec /entrypoint.sh',
    ])
    .withWaitStrategy(
      Wait.forAll([
        Wait.forHttp('/a/config/server/version', 8080)
          .withBasicCredentials(GERRIT_ADMIN_USERNAME, GERRIT_ADMIN_PASSWORD)
          .withStartupTimeout(90_000),
        Wait.forListeningPorts(),
      ]).withStartupTimeout(90_000),
    )
    .start();

  baseUrl = `http://localhost:${container.getMappedPort(8080)}`;
}

export async function stopGerritContainer(): Promise<void> {
  if (!container) {
    return;
  }

  if (['true', '1'].includes(process.env.KEEP_CONTAINERS ?? '')) {
    // oxlint-disable-next-line no-console -- intentional: display container info for debugging
    console.log(codeBlock`
      Gerrit container kept running. Access it at: ${baseUrl}

      Run renovate against it with:
        RENOVATE_PLATFORM=gerrit RENOVATE_ENDPOINT=${baseUrl}/ RENOVATE_USERNAME=${GERRIT_RENOVATE_USERNAME} RENOVATE_PASSWORD=${GERRIT_RENOVATE_PASSWORD} RENOVATE_GIT_AUTHOR='${GERRIT_RENOVATE_GIT_AUTHOR}' RENOVATE_AUTODISCOVER=true pnpm start

      Remove the container when done:
        docker rm -f ${GERRIT_CONTAINER_NAME}
    `);
    return;
  }

  await container.stop();
}

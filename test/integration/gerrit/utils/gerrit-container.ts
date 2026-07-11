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

export const GERRIT_ADMIN_USERNAME = 'admin';
export const GERRIT_ADMIN_PASSWORD = 'secret';

let container: StartedTestContainer;
let baseUrl: string;

export function getBaseUrl(): string {
  return baseUrl;
}

export async function startGerritContainer(): Promise<void> {
  container = await new GenericContainer(GERRIT_IMAGE)
    .withExposedPorts(8080)
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
      Wait.forHttp('/a/config/server/version', 8080)
        .withBasicCredentials(GERRIT_ADMIN_USERNAME, GERRIT_ADMIN_PASSWORD)
        .withStartupTimeout(90_000),
    )
    .start();

  baseUrl = `http://localhost:${container.getMappedPort(8080)}`;
}

export async function stopGerritContainer(): Promise<void> {
  if (!container) {
    return;
  }

  if (['true', '1'].includes(process.env.KEEP_GERRIT ?? '')) {
    // oxlint-disable-next-line no-console -- intentional: display container info for debugging
    console.log(codeBlock`
      Gerrit container kept running. Access it at: ${baseUrl}

      Run renovate against it with:
        RENOVATE_PLATFORM=gerrit RENOVATE_ENDPOINT=${baseUrl}/ RENOVATE_USERNAME=${GERRIT_ADMIN_USERNAME} RENOVATE_PASSWORD=${GERRIT_ADMIN_PASSWORD} RENOVATE_AUTODISCOVER=true pnpm start

      Remove the container when done:
        docker rm -f ${GERRIT_CONTAINER_NAME}
    `);
    return;
  }

  await container.stop();
}

import { codeBlock } from 'common-tags';
import {
  GenericContainer,
  type StartedTestContainer,
  Wait,
} from 'testcontainers';
import { coerceString } from '../../../../lib/util/string.ts';

const GERRIT_IMAGE = 'gerritcodereview/gerrit:3.8.9';
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
    .withWaitStrategy(
      Wait.forHttp('/a/config/server/version', 8080)
        .withBasicCredentials(GERRIT_ADMIN_USERNAME, GERRIT_ADMIN_PASSWORD)
        .withStartupTimeout(45_000),
    )
    .start();

  const port = container.getMappedPort(8080);
  baseUrl = `http://localhost:${port}`;
}

export async function stopGerritContainer(): Promise<void> {
  if (!container) {
    return;
  }

  if (['true', '1'].includes(coerceString(process.env.KEEP_GERRIT))) {
    // oxlint-disable-next-line no-console -- intentional: display container info for debugging
    console.log(
      codeBlock`
        Gerrit container kept running. Access it at: ${baseUrl}

        Run renovate against it with:
          RENOVATE_PLATFORM=gerrit RENOVATE_ENDPOINT=${baseUrl}/ RENOVATE_USERNAME=${GERRIT_ADMIN_USERNAME} RENOVATE_PASSWORD=${GERRIT_ADMIN_PASSWORD} RENOVATE_AUTODISCOVER=true pnpm start

        Remove the container when done:
          docker rm -f ${GERRIT_CONTAINER_NAME}
      `,
    );
  } else {
    await container.stop();
  }
}

import type { Url } from 'node:url';
import { afterAll, afterEach, beforeAll } from '@jest/globals';
import { codeBlock } from 'common-tags';
// eslint-disable-next-line no-restricted-imports
import nock from 'nock';
import { makeGraphqlSnapshot } from './graphql-snapshot';

// eslint-disable-next-line no-restricted-imports
export type { Scope, ReplyHeaders, Body } from 'nock';

interface RequestLog {
  headers: Record<string, string>;
  method: string;
  url: string;
  status: number;
  body?: any;
  graphql?: any;
}

interface MissingRequestLog {
  method: string;
  url: string;
}

type BasePath = string | RegExp | Url;

let requestsDone: RequestLog[] = [];
let requestsMissing: MissingRequestLog[] = [];

type TestRequest = {
  method: string;
  href: string;
};

function onMissing(req: TestRequest, opts?: TestRequest): void {
  if (opts) {
    requestsMissing.push({ method: opts.method, url: opts.href });
  } else {
    requestsMissing.push({ method: req.method, url: req.href });
  }
}

export function allUsed(): boolean {
  return nock.isDone();
}

function getPending(): string[] {
  return nock.pendingMocks().map((req) => `- ${req.replace(':443/', '/')}`);
}

/**
 *  Clear nock state. Will be called in `afterEach`
 *
 *  @argument check Use `false` to clear mocks without checking for the missing/unused ones.
 *                  Disabling such checks is discouraged.
 */
export function clear(check = true): void {
  const isDone = nock.isDone();
  const pending = getPending();

  nock.abortPendingRequests();
  nock.cleanAll();

  const done = requestsDone;
  requestsDone = [];

  const missing = requestsMissing;
  requestsMissing = [];

  if (!check) {
    return;
  }

  if (missing.length) {
    const err = new Error(missingHttpMockMessage(done, missing));
    massageHttpMockStacktrace(err);
    throw err;
  }

  if (!isDone) {
    const err = new Error(unusedHttpMockMessage(done, pending));
    massageHttpMockStacktrace(err);
    throw err;
  }
}

export function scope(basePath: BasePath, options?: nock.Options): nock.Scope {
  return nock(basePath, options).on('replied', (req) => {
    const { headers, method } = req;
    const url = req.options?.href;
    const status = req.response?.statusCode;
    const result: RequestLog = { headers, method, url, status };
    const requestBody = req.requestBodyBuffers?.[0]?.toString();

    if (requestBody && headers['content-type'] === 'application/json') {
      try {
        const body = JSON.parse(requestBody);
        const graphql = makeGraphqlSnapshot(body);
        if (graphql) {
          result.graphql = graphql;
        } else {
          result.body = body;
        }
      } catch {
        result.body = requestBody;
      }
    }
    requestsDone.push(result);
  });
}

export function getTrace(): RequestLog[] {
  return requestsDone;
}

function massageHttpMockStacktrace(err: Error): void {
  if (!err.stack) {
    return;
  }

  const state = expect.getState();
  if (!state.currentTestName || !state.testPath) {
    return;
  }

  const fs: typeof import('fs-extra') = jest.requireActual('fs-extra');
  const content = fs.readFileSync(state.testPath, { encoding: 'utf8' });

  // Shrink the `testName` until we could locate it in the source file
  let testName = state.currentTestName.replace(/^[^\s]*\s/, '');
  let idx = content.indexOf(testName);
  while (testName.length) {
    if (idx !== -1) {
      break;
    }

    const prevName = testName;
    testName = testName.replace(/^[^\s]*\s/, '');
    if (prevName === testName) {
      break;
    }

    idx = content.indexOf(testName);
  }

  if (idx === -1) {
    return;
  }

  const lines = content.slice(0, idx).split('\n');
  const lineNum = lines.length;
  const linePos = lines[lines.length - 1].length + 1;

  const stackLine = `    at <test> (${state.testPath}:${lineNum}:${linePos})`;
  err.stack = err.stack.replace(/\+\+\+.*$/s, stackLine);
}

function missingHttpMockMessage(
  done: RequestLog[],
  missing: MissingRequestLog[],
): string {
  const blocks: string[] = [];

  const title = codeBlock`
    *** Missing HTTP mocks ***
  `;

  const explanation = codeBlock`
    ---

    Renovate testing strategy requires that every HTTP request
    has a corresponding mock.

    This error occurs when some of the request aren't mocked.

    Let's suppose your code performs two HTTP calls:

      GET   https://example.com/foo/bar/fail     404  <without body>
      POST  https://example.com/foo/bar/success  200  { "ok": true }

    The unit test should have this mock:

      httpMock.scope('https://example.com/foo/bar')
        .get('/fail')
        .reply(404)
        .post('/success')
        .reply(200, { ok: true });

    Note: \`httpMock.scope(...)\` is the Renovate-specific construct.
          The scope object itself is provided by the \`nock\` library.

    Details: https://github.com/nock/nock#usage

    +++
  `;

  blocks.push(title);

  blocks.push(codeBlock`
    ${missing.map(({ method, url }) => `- ${method} ${url}`).join('\n')}
  `);

  if (done.length) {
    blocks.push(codeBlock`
      Requests done:

      ${done.map(({ method, url, status }) => `- ${method} ${url} [${status}]`).join('\n')}
    `);
  }

  blocks.push(explanation);

  return blocks.join('\n\n');
}

function unusedHttpMockMessage(done: RequestLog[], pending: string[]): string {
  const blocks: string[] = [];

  const title = codeBlock`
    *** Unused HTTP mocks ***
  `;

  const explanation = codeBlock`
    ---

    Renovate testing strategy requires that every HTTP request
    has a corresponding mock.

    This error occurs because some of the created mocks are unused.

    In most cases, you simply need to remove them.

    +++
  `;

  blocks.push(title);
  blocks.push(pending.join('\n'));

  if (done.length) {
    blocks.push(codeBlock`
      Requests done:

      ${done.map(({ method, url, status }) => `- ${method} ${url} [${status}]`).join('\n')}
    `);
  }

  blocks.push(explanation);

  return blocks.join('\n\n');
}

// init nock
beforeAll(() => {
  nock.emitter.on('no match', onMissing);
  nock.disableNetConnect();
});

// clean nock to clear memory leack from http module patching
afterAll(() => {
  nock.emitter.removeListener('no match', onMissing);
  nock.restore();
});

// clear nock state
afterEach(() => {
  clear();
});

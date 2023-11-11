import type { Url } from 'node:url';
import { afterAll, afterEach, beforeAll } from '@jest/globals';
// eslint-disable-next-line no-restricted-imports
import nock from 'nock';
import { makeGraphqlSnapshot } from './graphql-snapshot';

// eslint-disable-next-line no-restricted-imports
export type { Scope, ReplyHeaders, Body } from 'nock';

interface RequestLogItem {
  headers: Record<string, string>;
  method: string;
  url: string;
  body?: any;
  graphql?: any;
}

type BasePath = string | RegExp | Url;

let requestLog: RequestLogItem[] = [];
let missingLog: string[] = [];

type TestRequest = {
  method: string;
  href: string;
};

function onMissing(req: TestRequest, opts?: TestRequest): void {
  if (opts) {
    missingLog.push(`  ${opts.method} ${opts.href}`);
  } else {
    missingLog.push(`  ${req.method} ${req.href}`);
  }
}

export function allUsed(): boolean {
  return nock.isDone();
}

/**
 *  Clear nock state. Will be called in `afterEach`
 *  @argument throwOnPending Use `false` to simply clear mocks.
 */
export function clear(throwOnPending = true): void {
  const isDone = nock.isDone();
  const pending = nock.pendingMocks();
  nock.abortPendingRequests();
  nock.cleanAll();
  const missing = missingLog;
  requestLog = [];
  missingLog = [];
  if (missing.length && throwOnPending) {
    throw new Error(`Missing mocks!\n * ${missing.join('\n * ')}`);
  }
  if (!isDone && throwOnPending) {
    throw new Error(`Pending mocks!\n * ${pending.join('\n * ')}`);
  }
}

export function scope(basePath: BasePath, options?: nock.Options): nock.Scope {
  return nock(basePath, options).on('request', (req) => {
    const { headers, method } = req;
    const url = req.options?.href;
    const result: RequestLogItem = { headers, method, url };
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
      } catch (e) {
        result.body = requestBody;
      }
    }
    requestLog.push(result);
  });
}

export function getTrace(): RequestLogItem[] /* istanbul ignore next */ {
  const errorLines: string[] = [];
  if (missingLog.length) {
    errorLines.push('Missing mocks:');
    errorLines.push(...missingLog);
  }
  if (!nock.isDone()) {
    errorLines.push('Unused mocks:');
    errorLines.push(...nock.pendingMocks().map((x) => `  ${x}`));
  }
  if (errorLines.length) {
    throw new Error(
      [
        'Completed requests:',
        ...requestLog.map(({ method, url }) => `  ${method} ${url}`),
        ...errorLines,
      ].join('\n'),
    );
  }
  return requestLog;
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

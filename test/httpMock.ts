import nock from 'nock';
import { Url } from 'url';

export type { Scope } from 'nock';

interface RequestLogItem {
  headers: Record<string, string>;
  method: string;
  url: string;
  body?: any;
}

type BasePath = string | RegExp | Url;

let requestLog: RequestLogItem[] = [];
let missingLog: string[] = [];

function onMissing(_: any, opts: any): void /* istanbul ignore next */ {
  missingLog.push(`  ${opts.method} ${opts.href}`);
}

export function setup(): void {
  if (!nock.isActive()) {
    nock.activate();
  }
  nock.disableNetConnect();
  nock.emitter.on('no match', onMissing);
}

export function reset(): void {
  nock.emitter.removeListener('no match', onMissing);
  nock.abortPendingRequests();
  if (nock.isActive()) {
    nock.restore();
  }
  nock.cleanAll();
  requestLog = [];
  missingLog = [];
  nock.enableNetConnect();
}

export function scope(basePath: BasePath, options?: nock.Options): nock.Scope {
  return nock(basePath, options).on('request', (req) => {
    const { headers, method } = req;
    const url = req.options?.href;
    const result: RequestLogItem = { headers, method, url };
    const body = req.options?.body;
    if (body) {
      result.body = body;
    }
    requestLog.push(result);
  });
}

export function getTrace(): RequestLogItem[] /* istanbul ignore next */ {
  const errorLines = [];
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
      ].join('\n')
    );
  }
  return requestLog;
}

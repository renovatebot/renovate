import nock from 'nock';
import { Url } from 'url';

interface RequestLogItem {
  headers: Record<string, string>;
  method: string;
  url: string;
}

type BasePath = string | RegExp | Url;

let requestLog: RequestLogItem[] = [];

export function scope(basePath: BasePath, options?: nock.Options): nock.Scope {
  if (!nock.isActive()) {
    nock.activate();
  }
  return nock(basePath, options).on('request', (req) => {
    const { headers, method } = req;
    const url = req.options?.href;
    requestLog.push({ headers, method, url });
  });
}

export function reset(): void {
  nock.abortPendingRequests();
  if (nock.isActive()) {
    nock.restore();
  }
  nock.cleanAll();
  requestLog = [];
}

export function trace(): RequestLogItem[] {
  return requestLog;
}

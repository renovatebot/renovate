import { Url } from 'url';
import is from '@sindresorhus/is';
import { parse as parseGraphqlQuery } from 'graphql/language';
import nock from 'nock';

export type { Scope } from 'nock';

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

function simplifyGraphqlAST(tree: any): any {
  if (!tree || is.emptyArray(tree) || is.emptyObject(tree)) {
    return null;
  }

  if (is.array(tree)) {
    return tree.map(simplifyGraphqlAST);
  }
  if (is.object(tree)) {
    return [
      'operation',
      'definitions',
      'selectionSet',
      'arguments',
      'value',
      'alias',
      'directives',
    ].reduce((acc: Record<string, any>, field) => {
      const value = tree[field];
      let simplifiedValue;

      if (field === 'definitions') {
        return (value || []).reduce((defsAcc, def) => {
          const name = def?.operation;
          const defValue = simplifyGraphqlAST(def);
          if (name && defValue) {
            return { ...defsAcc, [name]: defValue };
          }
          return defsAcc;
        }, {});
      }

      if (field === 'arguments') {
        const args = (value || []).reduce((argsAcc, arg) => {
          const name = arg?.name?.value;
          const argValue = arg?.value?.value;
          if (name && argValue) {
            return { ...argsAcc, [name]: argValue };
          }
          return argsAcc;
        }, {});
        if (!is.emptyObject(args)) {
          acc.__args = args;
        }
      } else if (field === 'selectionSet') {
        (value?.selections || []).forEach((selection) => {
          const name = selection?.name?.value;
          const selValue = simplifyGraphqlAST(selection);
          if (name && selValue) {
            acc[name] = is.emptyObject(selValue) ? null : selValue;
          }
        });
      } else {
        simplifiedValue = simplifyGraphqlAST(value);
        if (simplifiedValue) {
          acc[`__${field}`] = simplifiedValue;
        }
      }
      return acc;
    }, {});
  }
  return tree;
}

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

export function allUsed(): boolean {
  return nock.isDone();
}

export function scope(basePath: BasePath, options?: nock.Options): nock.Scope {
  return nock(basePath, options).on('request', (req) => {
    const { headers, method } = req;
    const url = req.options?.href;
    const result: RequestLogItem = { headers, method, url };
    const body = req.requestBodyBuffers?.[0]?.toString();

    if (body) {
      try {
        const strQuery = JSON.parse(body).query;
        const rawQuery = parseGraphqlQuery(strQuery, {
          noLocation: true,
        });
        result.graphql = simplifyGraphqlAST(rawQuery);
      } catch (ex) {
        result.body = body;
      }
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

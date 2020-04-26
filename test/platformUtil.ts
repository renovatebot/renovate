import is from '@sindresorhus/is';
import { GotApi, GotResponse } from '../lib/platform';

type MockedResult = {
  method?: string;
  body?: any;
  error?: string;
  statusCode?: number;
};

export function mockGot<T = GotResponse<object>>(
  api: jest.Mocked<GotApi>,
  httpResults: MockedResult | MockedResult[],
  callArgs = []
): any[] {
  const allResults = is.array(httpResults) ? [...httpResults] : [httpResults];

  function makeImpl(implMethod: string): (...any) => void {
    const results = allResults.filter(
      ({ method = 'get' }) => method === implMethod
    );
    return (url, options) => {
      callArgs.push({ url, method: implMethod, options });
      const result = results.shift() || {};
      const { error = null, body = null, statusCode = 200 } = result;
      if (error) {
        throw new Error(error);
      }
      if (statusCode !== 200) {
        throw result;
      }
      return { body };
    };
  }

  ['get', 'head', 'post', 'put', 'patch', 'delete'].forEach((method) => {
    api[method].mockReset();
    api[method].mockImplementation(makeImpl(method) as any);
  });
  return callArgs;
}

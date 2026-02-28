// Renovate issue: https://github.com/renovatebot/renovate/issues/12127
// Got issue: https://github.com/sindresorhus/got/issues/1489
// From here: https://github.com/sindresorhus/got/issues/1489#issuecomment-805485731
// fixed in https://github.com/sindresorhus/got/releases/tag/v14.6.0
// TODO: remove when got is upgraded to v14.6.0+
import type { Hooks, Response } from 'got';

export function isResponseOk(response: Response): boolean {
  const { statusCode } = response;
  const limitStatusCode = response.request.options.followRedirect ? 299 : 399;

  return (
    (statusCode >= 200 && statusCode <= limitStatusCode) || statusCode === 304
  );
}

export function hook(response: Response): Response {
  if (isResponseOk(response)) {
    response.request.destroy();
  }

  return response;
}

export const hooks: Partial<Hooks> = {
  afterResponse: [hook],
};

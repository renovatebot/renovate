// Renovate issue: https://github.com/renovatebot/renovate/issues/12127
// Got issue: https://github.com/sindresorhus/got/issues/1489
// From here: https://github.com/sindresorhus/got/issues/1489#issuecomment-805485731
import type { Hooks, Response } from 'got';

function isResponseOk(response: Response): boolean {
  const { statusCode } = response;
  const limitStatusCode = response.request.options.followRedirect ? 299 : 399;

  return (
    (statusCode >= 200 && statusCode <= limitStatusCode) || statusCode === 304
  );
}

export const hooks: Hooks = {
  afterResponse: [
    (response: Response): Response => {
      if (isResponseOk(response)) {
        response.request.destroy();
      }

      return response;
    },
  ],
};

import {
  GithubIpAllowListError,
  findIpAllowListGraphqlMessage,
  isIpAllowListDenial,
  isIpAllowListError,
} from './ip-allow-list.ts';

const message =
  'Although you appear to have the correct authorization credentials, the `foo` organization has an IP allow list enabled, and 203.0.113.1 is not permitted to access this resource.';

function httpError(statusCode: number, body: unknown): unknown {
  return { response: { statusCode, body } };
}

describe('util/github/ip-allow-list', () => {
  describe('findIpAllowListGraphqlMessage', () => {
    it.each`
      description                              | errors                                                    | expected
      ${'a forbidden error'}                   | ${[{ type: 'FORBIDDEN', message }]}                       | ${message}
      ${'among other errors'}                  | ${[{ message: 'other' }, { type: 'FORBIDDEN', message }]} | ${message}
      ${'a bare message'}                      | ${[{ message }]}                                          | ${undefined}
      ${'another type'}                        | ${[{ type: 'NOT_FOUND', message }]}                       | ${undefined}
      ${'another forbidden error'}             | ${[{ type: 'FORBIDDEN', message: 'Forbidden' }]}          | ${undefined}
      ${'a forbidden error without a message'} | ${[{ type: 'FORBIDDEN' }]}                                | ${undefined}
    `('finds $description', ({ errors, expected }) => {
      expect(findIpAllowListGraphqlMessage(errors)).toBe(expected);
    });
  });

  describe('isIpAllowListError', () => {
    it.each`
      description                      | err                                         | expected
      ${'a 403 with an object'}        | ${httpError(403, { message })}              | ${true}
      ${'a 403 with text'}             | ${httpError(403, message)}                  | ${true}
      ${'another 403'}                 | ${httpError(403, { message: 'Forbidden' })} | ${false}
      ${'a 403 without a body'}        | ${httpError(403, undefined)}                | ${false}
      ${'another status'}              | ${httpError(404, { message })}              | ${false}
      ${'an error without a response'} | ${new Error(message)}                       | ${false}
    `('is $expected for $description', ({ err, expected }) => {
      expect(isIpAllowListError(err)).toBe(expected);
    });
  });

  describe('isIpAllowListDenial', () => {
    it('accepts a refusal by GraphQL and by REST', () => {
      expect(isIpAllowListDenial(new GithubIpAllowListError(message))).toBe(
        true,
      );
      expect(isIpAllowListDenial(httpError(403, { message }))).toBe(true);
    });

    it('rejects other errors', () => {
      expect(isIpAllowListDenial(new Error(message))).toBe(false);
      expect(isIpAllowListDenial(undefined)).toBe(false);
    });
  });
});

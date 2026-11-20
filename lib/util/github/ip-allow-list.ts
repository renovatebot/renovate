import { isPlainObject, isString } from '@sindresorhus/is';
import { isForbidden } from '../http/status.ts';

/**
 * GitHub refuses a token whose request does not come from an address allowed by the organization's IP allow list, even for public repositories which can be read anonymously.
 */
const ipAllowListDenial = 'has an IP allow list enabled';

/**
 * A GraphQL request which GitHub refused because of an IP allow list.
 *
 * GitHub answers such a request with `200` and an error, and the GraphQL API cannot be used without a token, so only the REST API can be used instead.
 */
export class GithubIpAllowListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GithubIpAllowListError';
  }
}

function isIpAllowListMessage(message: unknown): boolean {
  return isString(message) && message.includes(ipAllowListDenial);
}

/**
 * The message of the GraphQL error which reports a refused token because of an IP allow list.
 */
export function findIpAllowListGraphqlMessage(
  errors: { type?: string; message?: string }[],
): string | undefined {
  return errors.find(
    (err) => err.type === 'FORBIDDEN' && isIpAllowListMessage(err.message),
  )?.message;
}

/**
 * Whether `err` is a `403` refusing a token because of an IP allow list.
 * The body is a string when the response was requested as text.
 */
export function isIpAllowListError(err: any): boolean {
  if (!isForbidden(err)) {
    return false;
  }
  const body = err.response?.body;
  return isIpAllowListMessage(isPlainObject(body) ? body.message : body);
}

/**
 * Whether `err` reports that a token was refused because of an IP allow list, either in a REST response or in a GraphQL one.
 */
export function isIpAllowListDenial(err: unknown): boolean {
  return err instanceof GithubIpAllowListError || isIpAllowListError(err);
}

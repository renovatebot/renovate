import { isNonEmptyString, isString } from '@sindresorhus/is';
import {
  FORGEJO_API_USING_HOST_TYPES,
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../../constants/index.ts';
import type { GotOptions } from './types.ts';

export type AuthGotOptions = Pick<
  GotOptions,
  | 'hostType'
  | 'headers'
  | 'noAuth'
  | 'context'
  | 'token'
  | 'username'
  | 'password'
>;

export function applyAuthorization<GotOptions extends AuthGotOptions>(
  inOptions: GotOptions,
): GotOptions {
  const options: GotOptions = { ...inOptions };

  if (isNonEmptyString(options.headers?.authorization) || options.noAuth) {
    return options;
  }

  options.headers ??= {};
  if (options.token) {
    const authType = options.context?.authType;
    if (authType) {
      if (authType === 'Token-Only') {
        options.headers.authorization = options.token;
      } else {
        options.headers.authorization = `${authType} ${options.token}`;
      }
    } else if (
      options.hostType &&
      FORGEJO_API_USING_HOST_TYPES.includes(options.hostType)
    ) {
      options.headers.authorization = `Bearer ${options.token}`;
    } else if (
      options.hostType &&
      GITEA_API_USING_HOST_TYPES.includes(options.hostType)
    ) {
      // Gitea v1.8.0 and later support `Bearer` as alternate to `token`
      // https://github.com/go-gitea/gitea/pull/5378
      options.headers.authorization = `Bearer ${options.token}`;
    } else if (
      options.hostType &&
      GITHUB_API_USING_HOST_TYPES.includes(options.hostType)
    ) {
      options.headers.authorization = `token ${options.token}`;
      if (options.token.startsWith('x-access-token:')) {
        const appToken = options.token.replace('x-access-token:', '');
        options.headers.authorization = `token ${appToken}`;
        // v8 ignore else -- TODO: add test #40625
        if (isString(options.headers.accept)) {
          options.headers.accept = options.headers.accept.replace(
            'application/vnd.github.v3+json',
            'application/vnd.github.machine-man-preview+json',
          );
        }
      }
    } else if (
      options.hostType &&
      GITLAB_API_USING_HOST_TYPES.includes(options.hostType)
    ) {
      // GitLab versions earlier than 12.2 only support authentication with
      // a personal access token, which is 20 characters long.
      if (options.token.length === 20) {
        options.headers['Private-token'] = options.token;
      } else {
        options.headers.authorization = `Bearer ${options.token}`;
      }
    } else {
      options.headers.authorization = `Bearer ${options.token}`;
    }
    delete options.token;
  } else if (options.password !== undefined) {
    // Otherwise got will add username and password to url and header
    const auth = Buffer.from(
      `${options.username ?? ''}:${options.password}`,
    ).toString('base64');
    options.headers.authorization = `Basic ${auth}`;
    delete options.username;
    delete options.password;
  }
  return options;
}

import {
  BITBUCKET_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
  PlatformId,
} from '../../constants';
import { logger } from '../../logger';
import { hasProxy } from '../../proxy';
import type { HostRule } from '../../types';
import * as hostRules from '../host-rules';
import type { HttpOptions } from './types';

function findMatchingRules(options: HttpOptions, url: string): HostRule {
  const hostType = options?.gotOptions?.hostType;
  let res = hostRules.find({ hostType, url });

  if (res.token || res.username || res.password) {
    // do not fallback if we already have auth infos
    return res;
  }

  // Fallback to `github` hostType
  if (
    hostType &&
    GITHUB_API_USING_HOST_TYPES.includes(hostType) &&
    hostType !== PlatformId.Github
  ) {
    res = {
      ...hostRules.find({
        hostType: PlatformId.Github,
        url,
      }),
      ...res,
    };
  }

  // Fallback to `gitlab` hostType
  if (
    hostType &&
    GITLAB_API_USING_HOST_TYPES.includes(hostType) &&
    hostType !== PlatformId.Gitlab
  ) {
    res = {
      ...hostRules.find({
        hostType: PlatformId.Gitlab,
        url,
      }),
      ...res,
    };
  }

  // Fallback to `bitbucket` hostType
  if (
    hostType &&
    BITBUCKET_API_USING_HOST_TYPES.includes(hostType) &&
    hostType !== PlatformId.Bitbucket
  ) {
    res = {
      ...hostRules.find({
        hostType: PlatformId.Bitbucket,
        url,
      }),
      ...res,
    };
  }

  return res;
}

// Apply host rules to requests
export function applyHostRules(
  url: string,
  inOptions: HttpOptions
): HttpOptions['gotOptions'] {
  const options: HttpOptions = { ...inOptions };
  const foundRules = findMatchingRules(options, url);
  const { username, password, token, enabled, authType } = foundRules;
  if (options?.gotOptions?.noAuth) {
    logger.trace({ url }, `Authorization disabled`);
  } else if (
    options?.gotOptions?.headers?.authorization ||
    options?.gotOptions?.password ||
    options?.gotOptions?.token
  ) {
    logger.trace({ url }, `Authorization already set`);
  } else if (password !== undefined) {
    logger.trace({ url }, `Applying Basic authentication`);
    if (options.gotOptions) {
      options.gotOptions.username = username;
      options.gotOptions.password = password;
    }
  } else if (token) {
    logger.trace({ url }, `Applying Bearer authentication`);
    if (options.gotOptions) {
      options.gotOptions.token = token;
      options.gotOptions.context = {
        ...options?.gotOptions?.context,
        authType,
      };
    }
  } else if (enabled === false) {
    if (options.gotOptions) {
      options.gotOptions.enabled = false;
    }
  }
  // Apply optional params
  if (foundRules.abortOnError && options.gotOptions) {
    options.gotOptions.abortOnError = foundRules.abortOnError;
  }

  if (foundRules.abortIgnoreStatusCodes && options.gotOptions) {
    options.gotOptions.abortIgnoreStatusCodes =
      foundRules.abortIgnoreStatusCodes;
  }

  if (foundRules.timeout && options.gotOptions) {
    options.gotOptions.timeout = foundRules.timeout;
  }

  if (!hasProxy() && foundRules.enableHttp2 === true && options.gotOptions) {
    options.gotOptions.http2 = true;
  }
  return options.gotOptions;
}

export function getRequestLimit(url: string): number | null {
  const hostRule = hostRules.find({
    url,
  });
  const limit = hostRule.concurrentRequestLimit;
  return typeof limit === 'number' && limit > 0 ? limit : null;
}

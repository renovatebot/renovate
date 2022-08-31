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
import { dnsCache } from './dns';
import type { GotOptions } from './types';

export function findMatchingRules(options: GotOptions, url: string): HostRule {
  const { hostType } = options;
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
export function applyHostRules(url: string, inOptions: GotOptions): GotOptions {
  const options: GotOptions = { ...inOptions };
  const foundRules = findMatchingRules(options, url);
  const { username, password, token, enabled, authType } = foundRules;
  if (options.noAuth) {
    logger.trace({ url }, `Authorization disabled`);
  } else if (
    options.headers?.authorization ||
    options.password ||
    options.token
  ) {
    logger.trace({ url }, `Authorization already set`);
  } else if (password !== undefined) {
    logger.trace({ url }, `Applying Basic authentication`);
    options.username = username;
    options.password = password;
  } else if (token) {
    logger.trace({ url }, `Applying Bearer authentication`);
    options.token = token;
    options.context = { ...options.context, authType };
  } else if (enabled === false) {
    options.enabled = false;
  }
  // Apply optional params
  if (foundRules.abortOnError) {
    options.abortOnError = foundRules.abortOnError;
  }

  if (foundRules.abortIgnoreStatusCodes) {
    options.abortIgnoreStatusCodes = foundRules.abortIgnoreStatusCodes;
  }

  if (foundRules.timeout) {
    options.timeout = foundRules.timeout;
  }

  if (foundRules.dnsCache) {
    options.dnsCache = dnsCache;
  }

  if (!hasProxy() && foundRules.enableHttp2 === true) {
    options.http2 = true;
  }
  return options;
}

export function getRequestLimit(url: string): number | null {
  const hostRule = hostRules.find({
    url,
  });
  const limit = hostRule.concurrentRequestLimit;
  return typeof limit === 'number' && limit > 0 ? limit : null;
}

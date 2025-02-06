import is from '@sindresorhus/is';
import { GlobalConfig } from '../../config/global';
import {
  BITBUCKET_API_USING_HOST_TYPES,
  GITEA_API_USING_HOST_TYPES,
  GITHUB_API_USING_HOST_TYPES,
  GITLAB_API_USING_HOST_TYPES,
} from '../../constants';
import { logger } from '../../logger';
import { hasProxy } from '../../proxy';
import type { HostRule } from '../../types';
import * as hostRules from '../host-rules';
import { matchRegexOrGlobList } from '../string-match';
import { parseUrl } from '../url';
import { keepAliveAgents } from './keep-alive';
import type { GotOptions, InternalHttpOptions } from './types';

export type HostRulesGotOptions = Pick<
  GotOptions & InternalHttpOptions,
  | 'hostType'
  | 'url'
  | 'noAuth'
  | 'headers'
  | 'token'
  | 'username'
  | 'password'
  | 'context'
  | 'enabled'
  | 'abortOnError'
  | 'abortIgnoreStatusCodes'
  | 'timeout'
  | 'lookup'
  | 'agent'
  | 'http2'
  | 'https'
  | 'readOnly'
>;

export function findMatchingRule<GotOptions extends HostRulesGotOptions>(
  url: string,
  options: GotOptions,
): HostRule {
  const { hostType, readOnly } = options;
  let res = hostRules.find({ hostType, url, readOnly });

  if (
    is.nonEmptyString(res.token) ||
    is.nonEmptyString(res.username) ||
    is.nonEmptyString(res.password)
  ) {
    // do not fallback if we already have auth infos
    return res;
  }

  // Fallback to `github` hostType
  if (
    hostType &&
    GITHUB_API_USING_HOST_TYPES.includes(hostType) &&
    hostType !== 'github'
  ) {
    res = {
      ...hostRules.find({
        hostType: 'github',
        url,
      }),
      ...res,
    };
  }

  // Fallback to `gitlab` hostType
  if (
    hostType &&
    GITLAB_API_USING_HOST_TYPES.includes(hostType) &&
    hostType !== 'gitlab'
  ) {
    res = {
      ...hostRules.find({
        hostType: 'gitlab',
        url,
      }),
      ...res,
    };
  }

  // Fallback to `bitbucket` hostType
  if (
    hostType &&
    BITBUCKET_API_USING_HOST_TYPES.includes(hostType) &&
    hostType !== 'bitbucket'
  ) {
    res = {
      ...hostRules.find({
        hostType: 'bitbucket',
        url,
      }),
      ...res,
    };
  }

  // Fallback to `gitea` hostType
  if (
    hostType &&
    GITEA_API_USING_HOST_TYPES.includes(hostType) &&
    hostType !== 'gitea'
  ) {
    res = {
      ...hostRules.find({
        hostType: 'gitea',
        url,
      }),
      ...res,
    };
  }

  return res;
}

// Apply host rules to requests
export function applyHostRule<GotOptions extends HostRulesGotOptions>(
  url: string,
  options: GotOptions,
  hostRule: HostRule,
): GotOptions {
  const { username, password, token, enabled, authType } = hostRule;
  const host = parseUrl(url)?.host;
  if (options.noAuth) {
    logger.trace({ url }, `Authorization disabled`);
  } else if (
    is.nonEmptyString(options.headers?.authorization) ||
    is.nonEmptyString(options.password) ||
    is.nonEmptyString(options.token)
  ) {
    logger.once.debug(`hostRules: authentication already set for ${host}`);
    logger.trace({ url }, `Authorization already set`);
  } else if (password !== undefined) {
    logger.once.debug(`hostRules: applying Basic authentication for ${host}`);
    logger.trace({ url }, `Applying Basic authentication`);
    options.username = username;
    options.password = password;
  } else if (token) {
    logger.once.debug(`hostRules: applying Bearer authentication for ${host}`);
    logger.trace({ url }, `Applying Bearer authentication`);
    options.token = token;
    options.context = { ...options.context, authType };
  } else if (enabled === false) {
    options.enabled = false;
  } else {
    logger.once.debug(`hostRules: no authentication for ${host}`);
  }
  // Apply optional params
  if (hostRule.abortOnError) {
    options.abortOnError = hostRule.abortOnError;
  }

  if (hostRule.abortIgnoreStatusCodes) {
    options.abortIgnoreStatusCodes = hostRule.abortIgnoreStatusCodes;
  }

  if (hostRule.timeout) {
    options.timeout = hostRule.timeout;
  }

  if (hostRule.headers) {
    const allowedHeaders = GlobalConfig.get('allowedHeaders', []);
    const filteredHeaders: Record<string, string> = {};

    for (const [header, value] of Object.entries(hostRule.headers)) {
      if (matchRegexOrGlobList(header, allowedHeaders)) {
        filteredHeaders[header] = value;
      } else {
        logger.once.error(
          { allowedHeaders, header },
          'Disallowed hostRules headers',
        );
      }
    }

    options.headers = {
      ...options.headers,
      ...filteredHeaders,
    };
  }

  if (hostRule.keepAlive) {
    options.agent = keepAliveAgents;
  }

  if (!hasProxy() && hostRule.enableHttp2 === true) {
    options.http2 = true;
  }

  if (is.nonEmptyString(hostRule.httpsCertificateAuthority)) {
    options.https = {
      ...(options.https ?? {}),
      certificateAuthority: hostRule.httpsCertificateAuthority,
    };
  }

  if (is.nonEmptyString(hostRule.httpsPrivateKey)) {
    options.https = {
      ...(options.https ?? {}),
      key: hostRule.httpsPrivateKey,
    };
  }

  if (is.nonEmptyString(hostRule.httpsCertificate)) {
    options.https = {
      ...(options.https ?? {}),
      certificate: hostRule.httpsCertificate,
    };
  }

  return options;
}

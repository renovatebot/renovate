import is from '@sindresorhus/is';
import { PLATFORM_HOST_TYPES } from '../../constants/platforms';
import { logger } from '../../logger';
import type { HostRule } from '../../types';
import { detectPlatform } from '../common';
import { getEnv } from '../env';
import { find, getAll } from '../host-rules';
import { regEx } from '../regex';
import { createURLFromHostOrURL, isHttpUrl } from '../url';
import type { AuthenticationRule } from './types';
import { parseGitUrl } from './url';

const githubApiUrls = new Set([
  'github.com',
  'api.github.com',
  'https://api.github.com',
  'https://api.github.com/',
]);

/**
 * Add authorization to a Git Url and returns a new environment variables object
 * @returns a new NodeJS.ProcessEnv object without modifying any input parameters
 */
export function getGitAuthenticatedEnvironmentVariables(
  originalGitUrl: string,
  { token, username, password, hostType, matchHost }: HostRule,
  environmentVariables?: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  if (!token && !(username && password)) {
    logger.warn(
      { host: matchHost },
      `Could not create environment variable for host as neither token or username and password was set`,
    );
    return { ...environmentVariables };
  }

  const env = getEnv();
  // check if the environmentVariables already contain a GIT_CONFIG_COUNT or if the process has one
  const gitConfigCountEnvVariable =
    environmentVariables?.GIT_CONFIG_COUNT ?? env.GIT_CONFIG_COUNT;
  let gitConfigCount = 0;
  if (gitConfigCountEnvVariable) {
    // passthrough the gitConfigCountEnvVariable environment variable as start value of the index count
    gitConfigCount = parseInt(gitConfigCountEnvVariable, 10);
    if (Number.isNaN(gitConfigCount)) {
      logger.warn(
        {
          GIT_CONFIG_COUNT: env.GIT_CONFIG_COUNT,
        },
        `Found GIT_CONFIG_COUNT env variable, but couldn't parse the value to an integer. Ignoring it.`,
      );
      gitConfigCount = 0;
    }
  }
  let authenticationRules: AuthenticationRule[];
  if (token) {
    authenticationRules = getAuthenticationRulesWithToken(
      originalGitUrl,
      hostType,
      token,
    );
  } else {
    const encodedUsername = encodeURIComponent(username!);
    const encodedPassword = encodeURIComponent(password!);

    authenticationRules = getAuthenticationRules(
      originalGitUrl,
      hostType,
      `${encodedUsername}:${encodedPassword}`,
    );
  }

  // create a shallow copy of the environmentVariables as base so we don't modify the input parameter object
  // add the two new config key and value to the returnEnvironmentVariables object
  // increase the CONFIG_COUNT by one for each rule and add it to the object
  const newEnvironmentVariables = {
    ...environmentVariables,
  };
  for (const rule of authenticationRules) {
    newEnvironmentVariables[`GIT_CONFIG_KEY_${gitConfigCount}`] =
      `url.${rule.url}.insteadOf`;
    newEnvironmentVariables[`GIT_CONFIG_VALUE_${gitConfigCount}`] =
      rule.insteadOf;
    gitConfigCount++;
  }
  newEnvironmentVariables.GIT_CONFIG_COUNT = gitConfigCount.toString();

  return newEnvironmentVariables;
}

function getAuthenticationRulesWithToken(
  url: string,
  hostType: string | undefined | null,
  authToken: string,
): AuthenticationRule[] {
  let token = authToken;
  let type = hostType;
  type ??= detectPlatform(url);
  if (type === 'gitlab') {
    token = `gitlab-ci-token:${authToken}`;
  }
  return getAuthenticationRules(url, type, token);
}

/**
 * Generates the authentication rules for later git usage for the given host
 * @link https://coolaj86.com/articles/vanilla-devops-git-credentials-cheatsheet/
 * @param gitUrl Git repository URL
 * @param hostType Git host type
 * @param token Authentication token or `username:password` string
 */
export function getAuthenticationRules(
  gitUrl: string,
  hostType: string | undefined | null,
  token: string,
): AuthenticationRule[] {
  const authenticationRules = [];
  const hasUser = token.split(':').length > 1;
  const insteadUrl = parseGitUrl(gitUrl);
  let sshPort = insteadUrl.port;

  if (hostType === 'bitbucket-server') {
    // For Bitbucket Server/Data Center, `source` must be `bitbucket-server`
    // to generate HTTP(s) URLs correctly.
    // https://github.com/IonicaBizau/git-url-parse/blob/28828546c148d58bbcff61409915a4e1e8f7eb11/lib/index.js#L304
    insteadUrl.source = 'bitbucket-server';

    // sshPort is string, wrong type!
    // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/72361
    // https://github.com/IonicaBizau/parse-path/blob/87f71f273da90f85f6845937a70b7c032eeae4e3/lib/index.js#L45
    if (!sshPort || is.emptyString(sshPort)) {
      // By default, bitbucket-server SSH port is 7999.
      // For non-default port, the generated auth config will likely be incorrect.
      sshPort = '7999';
    }
  }

  const url = { ...insteadUrl };
  const protocol = regEx(/^https?$/).test(url.protocol)
    ? url.protocol
    : 'https';

  // ssh protocol with user if empty
  url.token = hasUser ? token : `ssh:${token}`;
  authenticationRules.push({
    url: url.toString(protocol),
    // only edge case, need to stringify ourself because the exact syntax is not supported by the library
    // https://github.com/IonicaBizau/git-url-parse/blob/246c9119fb42c2ea1c280028fe77c53eb34c190c/lib/index.js#L246
    insteadOf: `ssh://git@${insteadUrl.resource}${
      sshPort ? `:${sshPort}` : ''
    }/${insteadUrl.full_name}${insteadUrl.git_suffix ? '.git' : ''}`,
  });

  // alternative ssh protocol with user if empty
  url.token = hasUser ? token : `git:${token}`;
  authenticationRules.push({
    url: url.toString(protocol),
    insteadOf: { ...insteadUrl, port: sshPort }.toString('ssh'),
  });

  // https protocol with no user as default fallback
  url.token = token;
  authenticationRules.push({
    url: url.toString(protocol),
    insteadOf: insteadUrl.toString(protocol),
  });

  return authenticationRules;
}

export function getGitEnvironmentVariables(
  additionalHostTypes: string[] = [],
): NodeJS.ProcessEnv {
  let environmentVariables: NodeJS.ProcessEnv = {};

  // hard-coded logic to use authentication for github.com based on the githubToken for api.github.com
  const gitHubHostRule = find({
    hostType: 'github',
    url: 'https://api.github.com/',
  });

  if (gitHubHostRule?.token) {
    environmentVariables = getGitAuthenticatedEnvironmentVariables(
      'https://github.com/',
      gitHubHostRule,
    );
  }

  // construct the Set of allowed hostTypes consisting of the standard Git provides
  // plus additionalHostTypes, which are provided as parameter
  const gitAllowedHostTypes = new Set<string>([
    ...PLATFORM_HOST_TYPES,
    ...additionalHostTypes,
  ]);

  // filter rules without `matchHost` and `token` or username and password and github api github rules
  const hostRules = getAll()
    .filter((r) => r.matchHost && (r.token ?? (r.username && r.password)))
    .filter((r) => !gitHubHostRule || !githubApiUrls.has(r.matchHost!));

  // for each hostRule without hostType we add additional authentication variables to the environmentVariables
  // for each hostRule with hostType we add additional authentication variables to the environmentVariables
  for (const hostRule of hostRules) {
    if (!hostRule.hostType || gitAllowedHostTypes.has(hostRule.hostType)) {
      environmentVariables = addAuthFromHostRule(
        hostRule,
        environmentVariables,
      );
    }
  }
  return environmentVariables;
}

function addAuthFromHostRule(
  hostRule: HostRule,
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  let environmentVariables = env;
  const httpUrl = createURLFromHostOrURL(hostRule.matchHost!)?.toString();
  if (isHttpUrl(httpUrl)) {
    logger.trace(`Adding Git authentication for ${httpUrl} using token auth.`);
    environmentVariables = getGitAuthenticatedEnvironmentVariables(
      httpUrl!,
      hostRule,
      environmentVariables,
    );
  } else {
    logger.debug(
      `Could not parse registryUrl ${hostRule.matchHost!} or not using http(s). Ignoring`,
    );
  }
  return environmentVariables;
}

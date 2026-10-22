import { isNonEmptyString } from '@sindresorhus/is';
import { XmlDocument, type XmlElement, type XmlNodeBase } from 'xmldoc';
import { GlobalConfig } from '../../../config/global.ts';
import { logger } from '../../../logger/index.ts';
import type { HostRule } from '../../../types/index.ts';
import { getEnv } from '../../../util/env.ts';
import * as hostRules from '../../../util/host-rules.ts';
import { regEx } from '../../../util/regex.ts';

let nugetConfigRaw = '';

const hexCodeRegex = regEx(/_x(?<code>[0-9a-fA-F]{4})_/g);

export function unescapeFeedName(name: string): string {
  return name.replace(hexCodeRegex, (...args) => {
    const groups: { code: string } = args.at(-1);
    return String.fromCodePoint(Number.parseInt(groups.code, 16));
  });
}

const envVarRegex = regEx(
  /%(?<win>[^%]+)%|\$\{(?<posixBraced>[^}]+)\}|\$(?<posixBare>[a-zA-Z_][a-zA-Z0-9_]*)/g,
);

export function expandEnvVariables(value: string, isFromRepo: boolean): string {
  const hasEnvVar = regEx(/%[^%]+%|\$[a-zA-Z_]|\$\{[^}]+\}/).test(value);
  if (!hasEnvVar) {
    return value;
  }
  const allowEnv = !isFromRepo || GlobalConfig.get('exposeAllEnv');
  if (!allowEnv) {
    logger.debug(
      'Stripping credentials containing environment variables from untrusted repo nuget.config',
    );
    return '';
  }
  const env = getEnv();
  return value.replace(envVarRegex, (...args) => {
    const groups: {
      win?: string;
      posixBraced?: string;
      posixBare?: string;
    } = args.at(-1);
    const varName = groups.win ?? groups.posixBraced ?? groups.posixBare;
    const envVal = varName ? env[varName] : undefined;
    if (envVal === undefined) {
      logger.debug(
        { varName },
        'Environment variable not found for NuGet credential',
      );
      return '';
    }
    return envVal;
  });
}

function isXmlElement(child: XmlNodeBase): child is XmlElement {
  return child.type === 'element';
}

function getCredentialValue(
  elem: XmlElement,
  keyNames: string[],
): string | undefined {
  for (const child of elem.children) {
    if (!isXmlElement(child) || child.name !== 'add') {
      continue;
    }
    const key = child.attr?.key ?? child.attr?.Key;
    if (key && keyNames.some((k) => k.toLowerCase() === key.toLowerCase())) {
      return child.attr?.value ?? child.attr?.Value;
    }
  }
  return undefined;
}

export function extractAndRegisterPackageSourceCredentials(
  nuGetConfig: XmlDocument,
  isFromRepo = false,
): void {
  const packageSources = nuGetConfig.childNamed('packageSources');
  const packageSourceCredentials = nuGetConfig.childNamed(
    'packageSourceCredentials',
  );
  if (!packageSources || !packageSourceCredentials) {
    return;
  }

  const feedUrls = new Map<string, string>();
  for (const child of packageSources.children) {
    if (isXmlElement(child) && child.name === 'add') {
      const key = child.attr?.key ?? child.attr?.Key;
      const value = child.attr?.value ?? child.attr?.Value;
      if (key && value && regEx(/^https?:\/\//i).test(value)) {
        feedUrls.set(key, value);
        feedUrls.set(key.toLowerCase(), value);
      }
    }
  }

  for (const credElem of packageSourceCredentials.children) {
    if (!isXmlElement(credElem)) {
      continue;
    }
    const rawName = credElem.name;
    const unescapedName = unescapeFeedName(rawName);
    const feedUrl =
      feedUrls.get(rawName) ??
      feedUrls.get(unescapedName) ??
      feedUrls.get(rawName.toLowerCase()) ??
      feedUrls.get(unescapedName.toLowerCase());
    if (!feedUrl) {
      continue;
    }

    const rawUsername = getCredentialValue(credElem, ['Username']);
    const rawPassword = getCredentialValue(credElem, [
      'ClearTextPassword',
      'Password',
    ]);

    const username = rawUsername
      ? expandEnvVariables(rawUsername, isFromRepo)
      : undefined;
    const password = rawPassword
      ? expandEnvVariables(rawPassword, isFromRepo)
      : undefined;

    if (isNonEmptyString(username) || isNonEmptyString(password)) {
      const cleanUrl = feedUrl.replace(regEx(/#.*$/), '');
      const matchHosts = [cleanUrl];
      const baseUrl = cleanUrl.replace(regEx(/\/index\.json$/i), '');
      if (baseUrl !== cleanUrl) {
        matchHosts.push(baseUrl);
      }

      for (const matchHost of matchHosts) {
        const hostRule: HostRule = {
          hostType: 'nuget',
          matchHost,
        };
        if (isNonEmptyString(username)) {
          hostRule.username = username;
        }
        if (isNonEmptyString(password)) {
          hostRule.password = password;
        }
        logger.debug(
          { feedName: unescapedName, matchHost },
          'Adding credentials from nuget.config to hostRules',
        );
        hostRules.add(hostRule);
      }
    }
  }
}

export function setNugetConfig(input?: string): void {
  if (input) {
    if (input === nugetConfigRaw) {
      return;
    }
    nugetConfigRaw = input;
    try {
      const doc = new XmlDocument(input);
      extractAndRegisterPackageSourceCredentials(doc, false);
    } catch (err) {
      logger.debug({ err }, 'Failed to parse nugetConfig for credentials');
    }
  } else {
    nugetConfigRaw = '';
  }
}

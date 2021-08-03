import is from '@sindresorhus/is';
import * as datasourceDocker from '../../datasource/docker';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import { regEx } from '../../util/regex';
import * as ubuntuVersioning from '../../versioning/ubuntu';
import type { PackageDependency, PackageFile } from '../types';

export function splitImageParts(currentFrom: string): PackageDependency {
  if (currentFrom.includes('$')) {
    return {
      skipReason: SkipReason.ContainsVariable,
    };
  }
  const [currentDepTag, currentDigest] = currentFrom.split('@');
  const depTagSplit = currentDepTag.split(':');
  let depName: string;
  let currentValue: string;
  if (
    depTagSplit.length === 1 ||
    depTagSplit[depTagSplit.length - 1].includes('/')
  ) {
    depName = currentDepTag;
  } else {
    currentValue = depTagSplit.pop();
    depName = depTagSplit.join(':');
  }
  let registryUrl: string;
  const split = depName.split('/');
  if (split.length > 2) {
    // Assume the last two segments are the image name
    depName = split.slice(-2).join('/');
    registryUrl = split.slice(0, -2).join('/');
  } else if (
    // Split a two-part image if the first looks for sure like a hostName
    split.length === 2 &&
    (split[0].includes('.') || split[0].includes(':'))
  ) {
    registryUrl = split[0];
    depName = split[1];
  }
  if (registryUrl && !/^https?:\/\//.exec(registryUrl)) {
    registryUrl = `https://${registryUrl}`;
  }
  const dep: PackageDependency = {
    depName,
    currentValue,
    currentDigest,
  };
  if (registryUrl) {
    dep.registryUrls = [registryUrl];
  }
  return dep;
}

const quayRegex = regEx(/^quay\.io(?::[1-9][0-9]{0,4})?/i);

export function getDep(
  currentFrom: string,
  specifyReplaceString = true
): PackageDependency {
  if (!is.string(currentFrom)) {
    return {
      skipReason: SkipReason.InvalidValue,
    };
  }
  const dep = splitImageParts(currentFrom);
  if (dep.skipReason) {
    return dep; // currentFrom contains variable
  }
  if (specifyReplaceString && dep.depName) {
    dep.replaceString = currentFrom.substring(currentFrom.indexOf(dep.depName));
    dep.autoReplaceStringTemplate =
      '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
  }
  dep.datasource = datasourceDocker.id;

  // Pretty up special prefixes
  if (dep.depName) {
    const specialPrefixes = ['amd64', 'arm64', 'library'];
    for (const prefix of specialPrefixes) {
      if (dep.depName.startsWith(`${prefix}/`)) {
        dep.lookupName = dep.depName;
        dep.depName = dep.depName.replace(`${prefix}/`, '');
        if (specifyReplaceString) {
          dep.autoReplaceStringTemplate =
            '{{lookupName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
        }
      }
    }
  }

  if (dep.depName === 'ubuntu') {
    dep.versioning = ubuntuVersioning.id;
  }

  // Don't display quay.io ports
  if (quayRegex.test(dep.depName)) {
    const depName = dep.depName.replace(quayRegex, 'quay.io');
    if (depName !== dep.depName) {
      dep.lookupName = dep.depName;
      dep.depName = depName;
      dep.autoReplaceStringTemplate =
        '{{lookupName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
    }
  }

  return dep;
}

export function extractPackageFile(content: string): PackageFile | null {
  const deps: PackageDependency[] = [];
  const stageNames: string[] = [];

  const fromMatches = content.matchAll(
    /^[ \t]*FROM(?:\\\r?\n| |\t|#.*?\r?\n|[ \t]--[a-z]+=\S+?)*[ \t](?<image>\S+)(?:(?:\\\r?\n| |\t|#.*\r?\n)+as[ \t]+(?<name>\S+))?/gim // TODO #12070
  );

  for (const fromMatch of fromMatches) {
    if (fromMatch.groups.name) {
      logger.debug('Found a multistage build stage name');
      stageNames.push(fromMatch.groups.name);
    }
    if (fromMatch.groups.image === 'scratch') {
      logger.debug('Skipping scratch');
    } else if (stageNames.includes(fromMatch.groups.image)) {
      logger.debug({ image: fromMatch.groups.image }, 'Skipping alias FROM');
    } else {
      const dep = getDep(fromMatch.groups.image);
      logger.trace(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Dockerfile FROM'
      );
      deps.push(dep);
    }
  }

  const copyFromMatches = content.matchAll(
    /^[ \t]*COPY(?:\\\r?\n| |\t|#.*\r?\n|[ \t]--[a-z]+=\w+?)*[ \t]--from=(?<image>\S+)/gim // TODO #12070
  );

  for (const copyFromMatch of copyFromMatches) {
    if (stageNames.includes(copyFromMatch.groups.image)) {
      logger.debug(
        { image: copyFromMatch.groups.image },
        'Skipping alias COPY --from'
      );
    } else if (Number.isNaN(Number(copyFromMatch.groups.image))) {
      const dep = getDep(copyFromMatch.groups.image);
      logger.debug(
        {
          depName: dep.depName,
          currentValue: dep.currentValue,
          currentDigest: dep.currentDigest,
        },
        'Dockerfile COPY --from'
      );
      deps.push(dep);
    } else {
      logger.debug(
        { image: copyFromMatch.groups.image },
        'Skipping index reference COPY --from'
      );
    }
  }
  if (!deps.length) {
    return null;
  }
  for (const d of deps) {
    d.depType = 'stage';
  }
  deps[deps.length - 1].depType = 'final';
  return { deps };
}

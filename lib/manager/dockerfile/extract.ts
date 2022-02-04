import is from '@sindresorhus/is';
import * as datasourceDocker from '../../datasource/docker';
import { logger } from '../../logger';
import { regEx } from '../../util/regex';
import * as ubuntuVersioning from '../../versioning/ubuntu';
import type { PackageDependency, PackageFile } from '../types';

const variableMarker = '$';
const variableOpen = '${';
const variableClose = '}';
const variableDefaultValueSplit = ':-';

export function splitImageParts(currentFrom: string): PackageDependency {
  // Check if we have a variable in format of "${VARIABLE:-<image>:<defaultVal>@<digest>}"
  // If so, remove everything except the image, defaultVal and digest.
  let isVariable = false;
  let cleanedCurrentFrom: string = currentFrom;
  if (
    currentFrom.startsWith(variableOpen) &&
    currentFrom.endsWith(variableClose)
  ) {
    isVariable = true;

    // If the variable contains exactly one $ and has the default value, we consider it as a valid dependency;
    // otherwise skip it.
    if (
      currentFrom.split('$').length !== 2 ||
      currentFrom.indexOf(variableDefaultValueSplit) === -1
    ) {
      return {
        skipReason: 'contains-variable',
      };
    }

    cleanedCurrentFrom = currentFrom.substr(
      variableOpen.length,
      currentFrom.length - (variableClose.length + 2)
    );
    cleanedCurrentFrom = cleanedCurrentFrom.substr(
      cleanedCurrentFrom.indexOf(variableDefaultValueSplit) +
        variableDefaultValueSplit.length
    );
  }

  const [currentDepTag, currentDigest] = cleanedCurrentFrom.split('@');
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

  if (depName?.includes(variableMarker)) {
    // If depName contains a variable, after cleaning, e.g. "$REGISTRY/alpine", we currently not support this.
    return {
      skipReason: 'contains-variable',
    };
  }

  if (currentValue?.includes(variableMarker)) {
    // If tag contains a variable, e.g. "5.0${VERSION_SUFFIX}", we do not support this.
    return {
      skipReason: 'contains-variable',
    };
  }

  if (isVariable) {
    // If we have the variable and it contains the default value, we need to return
    // it as a valid dependency.

    const dep = {
      depName,
      currentValue,
      currentDigest,
      replaceString: cleanedCurrentFrom,
    };

    if (!dep.currentValue) {
      delete dep.currentValue;
    }

    if (!dep.currentDigest) {
      delete dep.currentDigest;
    }

    return dep;
  }

  const dep: PackageDependency = {
    depName,
    currentValue,
    currentDigest,
  };
  return dep;
}

const quayRegex = regEx(/^quay\.io(?::[1-9][0-9]{0,4})?/i);

export function getDep(
  currentFrom: string,
  specifyReplaceString = true
): PackageDependency {
  if (!is.string(currentFrom)) {
    return {
      skipReason: 'invalid-value',
    };
  }
  const dep = splitImageParts(currentFrom);
  if (specifyReplaceString) {
    if (!dep.replaceString) {
      dep.replaceString = currentFrom;
    }
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
    /^[ \t]*FROM(?:\\\r?\n| |\t|#.*?\r?\n|[ \t]--[a-z]+=\S+?)*[ \t](?<image>\S+)(?:(?:\\\r?\n| |\t|#.*\r?\n)+as[ \t]+(?<name>\S+))?/gim // TODO #12875 complex for re2 has too many not supported groups
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
    /^[ \t]*COPY(?:\\\r?\n| |\t|#.*\r?\n|[ \t]--[a-z]+=\w+?)*[ \t]--from=(?<image>\S+)/gim // TODO #12875 complex for re2 has too many not supported groups
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

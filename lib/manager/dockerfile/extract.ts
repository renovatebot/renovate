import is from '@sindresorhus/is';
import * as datasourceDocker from '../../datasource/docker';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
import * as ubuntuVersioning from '../../versioning/ubuntu';
import type { PackageDependency, PackageFile } from '../types';

export function splitImageParts(currentFrom: string): PackageDependency {
  // Check if we have a variable in format of "${VARIABLE:-<image>:<defaultVal>@<digest>}"
  // If so, remove everything except the image, defaultVal and digest.
  let isVariable = false;
  let hasDefaultValue = false;
  let cleanedCurrentFrom: string = currentFrom;
  if (currentFrom.startsWith('${') && currentFrom.endsWith('}')) {
    isVariable = true;

    if (
      currentFrom.split('$').length === 2 && // Ensure it has exactly one '$' to avoid the cases we don't support
      currentFrom.indexOf(':-') !== -1 // Ensure it has the default value
    ) {
      hasDefaultValue = true;
      cleanedCurrentFrom = currentFrom.substr(2, currentFrom.length - 3);
      cleanedCurrentFrom = cleanedCurrentFrom.substr(
        cleanedCurrentFrom.indexOf('-') + 1
      );
    }
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

  if (isVariable) {
    if (hasDefaultValue) {
      // If we have the variable and it contains the default value, we need to return
      // it as a valid dependency.

      const dep = {
        depName,
        currentValue,
        currentDigest,
        datasource: datasourceDocker.id,
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

    return {
      skipReason: SkipReason.ContainsVariable,
    };
  }

  const dep: PackageDependency = {
    depName,
    currentValue,
    currentDigest,
  };
  return dep;
}

const quayRegex = /^quay\.io(?::[1-9][0-9]{0,4})?/i;

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
    /^[ \t]*FROM(?:\\\r?\n| |\t|#.*?\r?\n|[ \t]--[a-z]+=\w+?)*[ \t](?<image>\S+)(?:(?:\\\r?\n| |\t|#.*\r?\n)+as[ \t]+(?<name>\S+))?/gim
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
    /^[ \t]*COPY(?:\\\r?\n| |\t|#.*\r?\n|[ \t]--[a-z]+=\w+?)*[ \t]--from=(?<image>\S+)/gim
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

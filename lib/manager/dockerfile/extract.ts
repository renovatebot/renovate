import is from '@sindresorhus/is';
import * as datasourceDocker from '../../datasource/docker';
import { logger } from '../../logger';
import { SkipReason } from '../../types';
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
  const dep: PackageDependency = {
    depName,
    currentValue,
    currentDigest,
  };
  return dep;
}

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
    dep.replaceString = currentFrom;
    dep.autoReplaceStringTemplate =
      '{{depName}}{{#if newValue}}:{{newValue}}{{/if}}{{#if newDigest}}@{{newDigest}}{{/if}}';
  }
  dep.datasource = datasourceDocker.id;
  if (dep.depName === 'ubuntu') {
    dep.versioning = ubuntuVersioning.id;
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

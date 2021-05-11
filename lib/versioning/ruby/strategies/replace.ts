import { satisfies } from '@renovatebot/ruby-semver';
import { logger } from '../../../logger';
import bump from './bump';

function countInstancesOf(str: string, char: string): number {
  return str.split(char).length - 1;
}

function isMajorRange(range: string): boolean {
  const splitRange = range.split(',').map((part) => part.trim());
  return (
    splitRange.length === 1 &&
    splitRange[0]?.startsWith('~>') &&
    countInstancesOf(splitRange[0], '.') === 0
  );
}

function isCommonRubyMajorRange(range: string): boolean {
  const splitRange = range.split(',').map((part) => part.trim());
  return (
    splitRange.length === 2 &&
    splitRange[0]?.startsWith('~>') &&
    countInstancesOf(splitRange[0], '.') === 1 &&
    splitRange[1]?.startsWith('>=')
  );
}

function isCommonRubyMinorRange(range: string): boolean {
  const splitRange = range.split(',').map((part) => part.trim());
  return (
    splitRange.length === 2 &&
    splitRange[0]?.startsWith('~>') &&
    countInstancesOf(splitRange[0], '.') === 2 &&
    splitRange[1]?.startsWith('>=')
  );
}

function reduceOnePrecision(version: string): string {
  const versionParts = version.split('.');
  /* c8 ignore next 3 */
  if (versionParts.length === 1) {
    return version;
  }
  versionParts.pop();
  return versionParts.join('.');
}

export function matchPrecision(existing: string, next: string): string {
  let res = next;
  while (res.split('.').length > existing.split('.').length) {
    res = reduceOnePrecision(res);
  }
  return res;
}

export default ({ to, range }: { range: string; to: string }): string => {
  if (satisfies(to, range)) {
    return range;
  }
  let newRange;
  if (isCommonRubyMajorRange(range)) {
    const firstPart = reduceOnePrecision(to);
    newRange = `~> ${firstPart}, >= ${to}`;
  } else if (isCommonRubyMinorRange(range)) {
    const firstPart = reduceOnePrecision(to) + '.0';
    newRange = `~> ${firstPart}, >= ${to}`;
  } else if (isMajorRange(range)) {
    const majorPart = to.split('.')[0];
    newRange = '~>' + (range.includes(' ') ? ' ' : '') + majorPart;
  } else {
    const lastPart = range
      .split(',')
      .map((part) => part.trim())
      .pop();
    const lastPartPrecision = lastPart.split('.').length;
    const toPrecision = to.split('.').length;
    let massagedTo: string = to;
    if (!lastPart.startsWith('<') && toPrecision > lastPartPrecision) {
      massagedTo = to.split('.').slice(0, lastPartPrecision).join('.');
    }
    const newLastPart = bump({ to: massagedTo, range: lastPart });
    newRange = range.replace(lastPart, newLastPart);
    const firstPart = range
      .split(',')
      .map((part) => part.trim())
      .shift();
    if (firstPart && !satisfies(to, firstPart)) {
      let newFirstPart = bump({ to: massagedTo, range: firstPart });
      newFirstPart = matchPrecision(firstPart, newFirstPart);
      newRange = newRange.replace(firstPart, newFirstPart);
    }
  }
  /* c8 ignore next 7 */
  if (!satisfies(to, newRange)) {
    logger.warn(
      { range, to, newRange },
      'Ruby versioning getNewValue problem: to version is not satisfied by new range'
    );
    return range;
  }
  return newRange;
};

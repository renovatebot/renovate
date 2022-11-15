import { regEx } from '../../../util/regex';
import {
  ascendingRange,
  descendingRange,
  exactVersion,
  inclusiveBound,
  lowerBound,
  matchVersion,
  upperBound,
} from './pattern';

function getVersionParts(input: string): [string, string] {
  const versionParts = input.split('-');
  if (versionParts.length === 1) {
    return [input, ''];
  }

  return [versionParts[0], '-' + versionParts[1]];
}

export function padZeroes(input: string): string {
  if (regEx(/[~^*]/).test(input)) {
    // ignore ranges
    return input;
  }

  const [output, stability] = getVersionParts(input);

  const sections = output.split('.');
  while (sections.length < 3) {
    sections.push('0');
  }
  return sections.join('.') + stability;
}

function plus2npm(input: string): string {
  if (input.includes('+')) {
    return '>=' + input.replace('+', ' ');
  }
  return input;
}

export function rez2npm(input: string): string {
  if (matchVersion.test(input)) {
    return input;
  }
  if (exactVersion.test(input)) {
    return input.replace('==', '=');
  }
  if (inclusiveBound.test(input)) {
    return '>=' + input.replace(regEx(/\.\./g), ' <');
  }
  if (lowerBound.test(input)) {
    return plus2npm(input);
  }
  if (upperBound.test(input)) {
    return input;
  }
  const matchAscRange = ascendingRange.exec(input);
  if (matchAscRange?.groups) {
    const lowerBoundAsc = matchAscRange.groups.range_lower_asc;
    const upperBoundAsc = matchAscRange.groups.range_upper_asc;
    return plus2npm(lowerBoundAsc) + ' ' + plus2npm(upperBoundAsc);
  }
  const matchDscRange = descendingRange.exec(input);
  if (matchDscRange?.groups) {
    const upperBoundDesc = matchDscRange.groups.range_upper_desc;
    const lowerBoundDesc = matchDscRange.groups.range_lower_desc;
    return plus2npm(lowerBoundDesc) + ' ' + plus2npm(upperBoundDesc);
  }
  return input;
}

export function rez2pep440(input: string): string {
  if (matchVersion.test(input)) {
    return input;
  }
  if (exactVersion.test(input)) {
    return input;
  }
  if (inclusiveBound.test(input)) {
    return '>=' + input.replace(regEx(/\.\./g), ', <');
  }
  if (lowerBound.test(input)) {
    return plus2npm(input);
  }
  if (upperBound.test(input)) {
    return input;
  }
  const matchAscRange = ascendingRange.exec(input);
  if (matchAscRange?.groups) {
    const lowerBoundAsc = matchAscRange.groups.range_lower_asc;
    const upperBoundAsc = matchAscRange.groups.range_upper_asc;
    return plus2npm(lowerBoundAsc) + ', ' + plus2npm(upperBoundAsc);
  }
  const matchDscRange = descendingRange.exec(input);
  if (matchDscRange?.groups) {
    const upperBoundDesc = matchDscRange.groups.range_upper_desc;
    const lowerBoundDesc = matchDscRange.groups.range_lower_desc;
    return plus2npm(lowerBoundDesc) + ', ' + plus2npm(upperBoundDesc);
  }
  return input;
}

export function pep4402rezInclusiveBound(input: string): string {
  return input
    .split(',')
    .map((v) => v.trim().replace(regEx(/[<>=]/g), ''))
    .join('..');
}

export function npm2rezplus(input: string): string {
  return input.trim().replace('>=', '') + '+';
}

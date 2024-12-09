import { regEx } from '../../../util/regex';
import type { Range } from './types';

// This range format was chosen because it is common in the ecosystem
const gteAndLtRange = regEx(/>=(?<lower>[\d.]+)&&<(?<upper>[\d.]+)/);
const ltAndGteRange = regEx(/<(?<upper>[\d.]+)&&>=(?<lower>[\d.]+)/);

export function parseRange(input: string): Range | null {
  const noSpaces = input.replaceAll(' ', '');
  let m = gteAndLtRange.exec(noSpaces);
  if (!m?.groups) {
    m = ltAndGteRange.exec(noSpaces);
    if (!m?.groups) {
      return null;
    }
  }
  return {
    lower: m.groups['lower'],
    upper: m.groups['upper'],
  };
}

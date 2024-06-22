import is from '@sindresorhus/is';
import { parse } from './parser';
import type { Fragment, FragmentPath, FragmentUpdater } from './types';

export function findCodeFragment(
  input: string,
  path: FragmentPath,
): Fragment | null {
  const parsed = parse(input);
  if (!parsed) {
    return null;
  }

  const [ruleIndex, ...restPath] = path;
  let fragment: Fragment | undefined = parsed[ruleIndex];
  for (let pathIndex = 0; pathIndex < restPath.length; pathIndex += 1) {
    if (!fragment) {
      break;
    }

    const key = restPath[pathIndex];

    if (fragment.type === 'array' && is.number(key)) {
      fragment = fragment.children[key];
    }

    if (fragment.type === 'record' && is.string(key)) {
      fragment = fragment.children[key];
    }
  }

  return fragment ?? null;
}

export function patchCodeAtFragment(
  input: string,
  fragment: Fragment,
  updater: FragmentUpdater,
): string {
  const { value, offset } = fragment;
  const left = input.slice(0, offset);
  const right = input.slice(offset + value.length);
  return is.string(updater)
    ? `${left}${updater}${right}`
    : `${left}${updater(value)}${right}`;
}

export function patchCodeAtFragments(
  input: string,
  fragments: Fragment[],
  updater: FragmentUpdater,
): string {
  const sortedFragments = fragments.sort(
    ({ offset: a }, { offset: b }) => b - a,
  );
  let result = input;
  for (const fragment of sortedFragments) {
    result = patchCodeAtFragment(result, fragment, updater);
  }
  return result;
}

export function updateCode(
  input: string,
  path: FragmentPath,
  updater: FragmentUpdater,
): string {
  const fragment = findCodeFragment(input, path);
  if (!fragment) {
    return input;
  }

  return patchCodeAtFragment(input, fragment, updater);
}

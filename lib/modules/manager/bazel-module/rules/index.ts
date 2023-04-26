import { regEx } from '../../../../util/regex';

const supportedRules = ['bazel_dep'];
export const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

// import type { Fragment, FragmentData } from '../../bazel/types';
// import type { PackageDependency } from '../../types';
// import { BazelDepTarget } from './bazel-dep';

// export function extractDepsFromFragment(
//   fragment: Fragment
// ): PackageDependency[] {
//   const fragmentData = extract(fragment);
//   return extractDepsFromFragmentData(fragmentData);
// }

// function extract(fragment: Fragment): FragmentData {
//   if (fragment.type === 'string') {
//     return fragment.value;
//   }

//   if (fragment.type === 'record') {
//     const { children } = fragment;
//     const result: Record<string, FragmentData> = {};
//     for (const [key, value] of Object.entries(children)) {
//       result[key] = extract(value);
//     }
//     return result;
//   }

//   return fragment.children.map(extract);
// }

// function extractDepsFromFragmentData(
//   fragmentData: FragmentData
// ): PackageDependency[] {
//   const res = BazelDepTarget.safeParse(fragmentData);
//   if (!res.success) {
//     return [];
//   }
//   return res.data;
// }
//

import { regEx } from '../../../../util/regex';
import { BazelDepRecord, BazelDepRecordToPackageDependency } from './bazel-dep';

const supportedRules = ['bazel_dep'];
export const supportedRulesRegex = regEx(`^${supportedRules.join('|')}$`);

export { BazelDepRecord, BazelDepRecordToPackageDependency };

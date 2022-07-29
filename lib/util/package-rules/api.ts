import { PackageNameMatcher } from './packageNames';
import { PackagePatternsMatcher } from './packagePatterns';
import { PackagePrefixesMatcher } from './packagePrefixes';
import type { MatcherApi } from './types';

const api = new Map<string, MatcherApi>();
export default api;

api.set(PackageNameMatcher.id, new PackageNameMatcher());
api.set(PackagePatternsMatcher.id, new PackagePatternsMatcher());
api.set(PackagePrefixesMatcher.id, new PackagePrefixesMatcher());

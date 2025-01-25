import is from "@sindresorhus/is";
import { GlobalConfig } from "../../../config/global";

export function getTtlOverride(namespace: string): number | undefined {
  const ttl: unknown = GlobalConfig.get('cacheTtlOverride', {})[namespace];
  if (is.number(ttl)) {
    return ttl;
  }
  return undefined;
}

export function resolveTtlValues(
  namespace: string,
  ttlMinutes: number,
): {
  softTtl: number;
  hardTtl: number;
} {
  const softTtl = getTtlOverride(namespace) ?? ttlMinutes;

  const cacheHardTtlMinutes = GlobalConfig.get(
    'cacheHardTtlMinutes',
    7 * 24 * 60,
  );
  const hardTtl = Math.max(softTtl, cacheHardTtlMinutes);

  return { softTtl, hardTtl };
}

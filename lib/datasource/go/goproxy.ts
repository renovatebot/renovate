import { Release } from '../types';
import { http } from './common';

export function encodeCase(input: string): string {
  return input.replace(/([A-Z])/g, (x) => `!${x.toLowerCase()}`);
}

export async function listVersions(
  baseUrl: string,
  lookupName: string
): Promise<string[]> {
  const url = `${baseUrl}/${encodeCase(lookupName)}/@v/list`;
  const { body } = await http.get(url);
  return body.split(/\s+/).filter(Boolean);
}

interface VersionInfo {
  Version: string;
  Time?: string;
}

export async function versionInfo(
  baseUrl: string,
  lookupName: string,
  version: string
): Promise<Release> {
  const url = `${baseUrl}/${encodeCase(lookupName)}/@v/${version}.info`;
  const res = await http.getJson<VersionInfo>(url);

  const result: Release = {
    version: res.body.Version,
  };

  if (res.body.Time) {
    result.releaseTimestamp = res.body.Time;
  }

  return result;
}

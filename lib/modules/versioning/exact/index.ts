import type { NewValueConfig, VersioningApi } from '../types.ts';

export const id = 'exact';
export const displayName = 'Exact';
export const urls: string[] = [];
export const supportsRanges = false;

class ExactVersioningApi implements VersioningApi {
  isValid(version: string): boolean {
    return version.length > 0;
  }

  isVersion(version: string | undefined | null): boolean {
    return !!version && version.length > 0;
  }

  isSingleVersion(version: string): boolean {
    return this.isValid(version);
  }

  isStable(_version: string): boolean {
    return true;
  }

  isCompatible(version: string, current?: string): boolean {
    return version === current;
  }

  getMajor(_version: string): number | null {
    return null;
  }

  getMinor(_version: string): number | null {
    return null;
  }

  getPatch(_version: string): number | null {
    return null;
  }

  equals(version: string, other: string): boolean {
    return version === other;
  }

  isGreaterThan(_version: string, _other: string): boolean {
    return false;
  }

  getSatisfyingVersion(versions: string[], range: string): string | null {
    return versions.find((v) => this.equals(v, range)) ?? null;
  }

  minSatisfyingVersion(versions: string[], range: string): string | null {
    return versions.find((v) => this.equals(v, range)) ?? null;
  }

  getNewValue({ currentValue }: NewValueConfig): string | null {
    return currentValue;
  }

  sortVersions(_version: string, _other: string): number {
    return 0;
  }

  matches(version: string, range: string): boolean {
    return version === range;
  }
}

export const api: VersioningApi = new ExactVersioningApi();

export default api;

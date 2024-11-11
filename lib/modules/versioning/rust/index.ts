import type { RangeStrategy } from '../../../types/versioning';
import { regEx } from '../../../util/regex';
import { type GenericVersion, GenericVersioningApi } from '../generic';
import type { NewValueConfig, VersioningApi } from '../types';

export const id = 'rust';
export const displayName = 'Rust';
export const urls = [
  'https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file',
];

export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'auto',
  'bump',
  'pin',
  'replace',
];

export class RustVersioningApi extends GenericVersioningApi {
  // Format described in https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file
  // Examples: 1.82.1, 1.82
  private static readonly versionRegex = regEx(
    '^(?<major>\\d+)\\.(?<minor>\\d+)(\\.(?<patch>\\d+))?$',
  );

  public constructor() {
    super();
  }

  _parse(version: string): GenericVersion | null {
    const groups = RustVersioningApi.versionRegex.exec(version)?.groups;
    if (!groups) {
      return null;
    }

    const { major, minor, patch } = groups;
    const release = [
      typeof major === 'undefined' ? 0 : Number.parseInt(major, 10),
      typeof minor === 'undefined' ? 0 : Number.parseInt(minor, 10),
    ];
    if (typeof patch !== 'undefined') {
      release.push(Number.parseInt(patch, 10));
    }

    return {
      release,
    };
  }

  override getNewValue({
    currentVersion,
    newVersion,
    rangeStrategy,
  }: NewValueConfig): string | null {
    
    return null;
  }
}

export const api: VersioningApi = new RustVersioningApi();

export default api;

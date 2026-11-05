import type { RangeStrategy } from '../../../types/versioning.ts';
import { regEx } from '../../../util/regex.ts';
import { GenericVersioningApi } from '../generic.ts';
import type {
  GenericVersion,
  NewValueConfig,
  VersioningApi,
} from '../types.ts';
import {
  isBelowRange,
  parseRange,
  parseRangeAlternatives,
  satisfiesRange,
} from './range.ts';
import type { ParsedVersion } from './types.ts';
import { updateRange } from './update.ts';
import { compareVersions, parseVersion } from './version.ts';

export const id = 'semver-extended';
export const displayName = 'Semver Extended';
export const urls = ['[Semantic Versioning](https://semver.org/)'];
export const supportsRanges = true;
export const supportedRangeStrategies: RangeStrategy[] = [
  'bump',
  'pin',
  'replace',
  'widen',
];

const prefixPattern = regEx(/^[vV]/);

const sectionIndexes = {
  major: 0,
  minor: 1,
  patch: 2,
} as const;

interface SemverExtendedVersion extends GenericVersion, ParsedVersion {}

class SemverExtendedVersioningApi extends GenericVersioningApi<SemverExtendedVersion> {
  protected _parse(version: string): SemverExtendedVersion | null {
    const parsed = parseVersion(version);
    if (!parsed) {
      return null;
    }
    return { ...parsed, release: parsed.releaseBig.map(Number) };
  }

  protected override _compare(version: string, other: string): number {
    const left = this._parse(version);
    const right = this._parse(other);
    if (!(left && right)) {
      return 1;
    }
    return compareVersions(left, right);
  }

  override isValid(input: string): boolean {
    return parseRange(input) !== null;
  }

  override isVersion(version: string): boolean {
    return this._parse(version) !== null;
  }

  override isCompatible(version: string): boolean {
    return this.isVersion(version);
  }

  override isSingleVersion(input: string): boolean {
    return this.isVersion(input);
  }

  override matches(version: string, range: string): boolean {
    const parsed = this._parse(version);
    const sets = parseRange(range);
    if (!(parsed && sets)) {
      return false;
    }
    return satisfiesRange(parsed, sets);
  }

  override isLessThanRange(version: string, range: string): boolean {
    const parsed = this._parse(version);
    const sets = parseRange(range);
    if (!(parsed && sets)) {
      return false;
    }
    return isBelowRange(parsed, sets);
  }

  override getSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    return this.sortMatching(versions, range).at(-1) ?? null;
  }

  override minSatisfyingVersion(
    versions: string[],
    range: string,
  ): string | null {
    return this.sortMatching(versions, range).at(0) ?? null;
  }

  override getNewValue(config: NewValueConfig): string | null {
    const { currentValue, rangeStrategy, newVersion } = config;
    if (rangeStrategy === 'pin' || this.isVersion(currentValue)) {
      return super.getNewValue(config);
    }
    const parsed = parseVersion(newVersion);
    const alternatives = parseRangeAlternatives(currentValue);
    if (!(parsed && alternatives)) {
      return null;
    }
    return updateRange(alternatives, rangeStrategy, {
      parsed,
      text: newVersion.replace(prefixPattern, ''),
    });
  }

  /**
   * Returns whether the major, minor or patch part of both versions is equal, compared as bigints.
   */
  override isSame(
    type: keyof typeof sectionIndexes,
    a: string,
    b: string,
  ): boolean {
    const parsedA = this._parse(a);
    const parsedB = this._parse(b);
    if (!(parsedA && parsedB)) {
      return false;
    }

    const sectionIndex = sectionIndexes[type];
    return (
      parsedA.releaseBig[sectionIndex] === parsedB.releaseBig[sectionIndex]
    );
  }

  /**
   * Returns whether an update from `current` to `version` may be breaking:
   * any update with a prerelease or an invalid version, any update from a
   * first part of zero, and any change of the first part.
   */
  isBreaking(current: string, version: string): boolean {
    if (!(this.isStable(current) && this.isStable(version))) {
      return true;
    }
    const currentMajor = this._parse(current)!.releaseBig[0];
    if (currentMajor === 0n) {
      return true;
    }
    return currentMajor !== this._parse(version)!.releaseBig[0];
  }

  /**
   * Returns the versions matching the range, sorted in ascending order.
   */
  private sortMatching(versions: string[], range: string): string[] {
    const sets = parseRange(range);
    if (!sets) {
      return [];
    }
    return versions
      .flatMap((version) => {
        const parsed = this._parse(version);
        return parsed && satisfiesRange(parsed, sets)
          ? [{ version, parsed }]
          : [];
      })
      .sort((a, b) => compareVersions(a.parsed, b.parsed))
      .map(({ version }) => version);
  }
}

export const api: VersioningApi = new SemverExtendedVersioningApi();

export default api;

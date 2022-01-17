import { regEx } from '../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../loose/generic';
import { VersioningApi } from '../types';

export const id = 'pvp';
export const displayName = 'PVP';
export const urls = ['https://pvp.haskell.org'];
export const supportsRanges = false;

/**
 * At least 3 components and no leading 0s
 */
const regex = regEx(/^(([0-9])|([1-9][0-9]*)\.){2,}([0-9])|([1-9][0-9]]*)$/);
class PvpVersioningApi extends GenericVersioningApi {
  /**
   *  https://pvp.haskell.org/#version-numbers
   */
  protected _parse(version: string): GenericVersion {
    const [a, b, c, ...rest] = version.split('.');
    const a_ = parseInt(a);
    const b_ = parseInt(b);
    const c_ = parseInt(c);
    console.log(c_);
    const additional = rest ?? [];

    if (isNaN(a) || isNaN(b_) || isNaN(c_)) {
      return null;
    }

    const additional_: number[] = [];
    for (const ele of additional) {
      const ele_ = parseInt(ele);
      if (isNaN(ele_)) {
        //throwInvalidVersionError(version);
        return null; // TODO exit loop
      } else {
        additional_.push(ele_);
      }
    }

    if (anyElementHasLeadingZero([a, b, c, ...additional].flat())) {
      //throwInvalidVersionError(version);
      return null;
    }

    return {
      release: [a_, b_, c_, ...additional_],
    };
  }

  // PVP has two major components A.B
  // To keep compatability with Renovate's versioning API we will treat it as a float
  override getMajor(version: string): number | null {
    const { release } = this._parse(version);
    return parseFloat(`${release[0]}.${release[1]}`);
  }

  override getMinor(version: string): number | null {
    const { release } = this._parse(version);
    return release[2];
  }

  override getPatch(version: string): number | null {
    const { release } = this._parse(version);
    return release[3];
  }

  /**
   * Compare similar to GenericVersioningApi._compare implementation
   * except 2.1.1.0 and 2.1.1 are not equivilant instead 2.1.1.0 > 2.1.1
   */
  override _compare(version: string, other: string): number {
    const left = this._parse(version);
    const right = this._parse(other);

    // istanbul ignore if
    if (!(left && right)) {
      return 1;
    }

    // support variable length compare
    const length = Math.max(left.release.length, right.release.length);
    for (let i = 0; i < length; i += 1) {
      // 2.1.0 > 2.1
      const part1 = left.release[i] ?? -1;
      const part2 = right.release[i] ?? -1;
      if (part1 !== part2) {
        return part1 - part2;
      }
    }

    return 0;
  }
}

const hasLeadingZero = (str: string): boolean =>
  str.length > 1 && str.startsWith('0');

const anyElementHasLeadingZero = (strings: string[]): boolean => {
  const bools = strings.map((str) => hasLeadingZero(str));
  return bools.includes(true);
};

const throwInvalidVersionError = (version: string): void => {
  throw new Error(
    `${version} is not a valid version. See https://pvp.haskell.org.`
  );
};

export const api: VersioningApi = new PvpVersioningApi();

export default api;

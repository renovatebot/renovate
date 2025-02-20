import { regEx } from '../../../util/regex';
import { GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'alpine';
export const displayName = 'Alpine Linux';
export const urls = [];
export const supportsRanges = false;

const pattern = regEx(
  /^(?<digits>[.0-9]*)(?<letter>[a-z])?(?<suffix>(?:_alpha|_beta|_pre|_rc|_cvs|_svn|_git|_hg|_p)(?<suffixNumber>[0-9]*))?(?:~(?<commitHash>[a-f0-9]+))?(?:-r(?<revisionNumber>[0-9]+))?$/,
);

// digit{.digit}...{letter}{_suf{#}}...{~hash}{-r#}
export interface AlpineVersion {
  release: number[];
  letter?: string;
  suffix?: string;
  suffixNumber?: number;
  commitHash?: string;
  revisionNumber?: number;
}

export class AlpineVersioningApi extends GenericVersioningApi<AlpineVersion> {
  protected _parse(version: string): AlpineVersion | null {
    const matches = pattern.exec(version)?.groups;
    if (!matches) {
      return null;
    }

    const { digits, letter, suffix, suffixNumber, commitHash, revisionNumber } =
      matches;

    return {
      release: digits
        ? digits.split('.').map((num) => Number.parseInt(num, 10))
        : [],
      letter: letter || undefined,
      suffix: suffix || undefined,
      suffixNumber: suffixNumber
        ? Number.parseInt(suffixNumber, 10)
        : undefined,
      commitHash: commitHash || undefined,
      revisionNumber: revisionNumber
        ? Number.parseInt(revisionNumber, 10)
        : undefined,
    };
  }

  protected override _compareOther(
    left: AlpineVersion,
    right: AlpineVersion,
  ): number {
    if ((left.letter ?? '') > (right.letter ?? '')) {
      return 1;
    } else if ((left.letter ?? '') < (right.letter ?? '')) {
      return -1;
    }

    if ((left.letter ?? '') > (right.letter ?? '')) {
      return 1;
    } else if ((left.letter ?? '') < (right.letter ?? '')) {
      return -1;
    }

    // TODO: Implement correct comparison of suffix
    if ((left.suffixNumber ?? 0) > (right.suffixNumber ?? 0)) {
      return 1;
    } else if ((left.suffixNumber ?? 0) < (right.suffixNumber ?? 0)) {
      return -1;
    }

    if ((left.commitHash ?? 0) > (right.commitHash ?? 0)) {
      return 1;
    } else if ((left.commitHash ?? 0) < (right.commitHash ?? 0)) {
      return -1;
    }

    if ((left.revisionNumber ?? 0) > (right.revisionNumber ?? 0)) {
      return 1;
    } else if ((left.revisionNumber ?? 0) < (right.revisionNumber ?? 0)) {
      return -1;
    }

    return 0;
  }
}

export const api: VersioningApi = new AlpineVersioningApi();

export default api;

import { regEx } from '../../../util/regex';
import { AlpineVersion, AlpineVersioningApi } from '../alpine';
import type { VersioningApi } from '../types';

export const id = 'chainguard';
export const displayName = 'Chainguard';
export const urls = [
  'https://edu.chainguard.dev/chainguard/chainguard-images/images-features/unique-tags/',
];
export const supportsRanges = false;

const datePattern = regEx(/^[0-9]{12}$/);
const variantPattern = regEx(/dev/);
const prefixPattern = regEx(/(?:latest|openjdk)/);

export interface ChainguardVersion extends AlpineVersion {
  prefix?: string;
  variant?: string;
  date?: string;
}

class ChainguardVersioningApi extends AlpineVersioningApi {
  protected override _parse(tag: string): ChainguardVersion | null {
    const parts = tag.split('-');
    const date = parts[parts.length - 1].match(datePattern)
      ? parts.pop()
      : undefined;
    const variant = parts[parts.length - 1].match(variantPattern)
      ? parts.pop()
      : undefined;
    const prefix = parts[0].match(prefixPattern) ? parts.shift() : undefined;

    const version = super._parse(parts.join('-'));
    if (!version) {
      return null;
    }
    return { ...version, prefix, variant, date };
  }

  protected override _compareOther(
    left: ChainguardVersion,
    right: ChainguardVersion,
  ): number {
    const cmpr = super._compareOther(left, right);
    if (cmpr !== 0) {
      return cmpr;
    }
    if ((left.date || 0) > (right.date || 0)) {
      return 1;
    } else if ((left.date || 0) < (right.date || 0)) {
      return -1;
    }
    return 0;
  }

  override isCompatible(version: string, current: string): boolean {
    const parsed1 = this._parse(version);
    const parsed2 = this._parse(current);
    return !!(parsed1 && parsed2 && parsed1.variant === parsed2.variant);
  }
}

export const api: VersioningApi = new ChainguardVersioningApi();

export default api;

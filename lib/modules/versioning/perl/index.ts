import { regEx } from '../../../util/regex';
import { GenericVersion, GenericVersioningApi } from '../generic';
import type { VersioningApi } from '../types';

export const id = 'perl';
export const displayName = 'Perl';
export const urls = ['https://metacpan.org/pod/version'];
export const supportsRanges = false;

// https://metacpan.org/pod/version#Decimal-Versions
const decimalVersionPattern = regEx(/^(\d+)\.(\d+(?:_\d+)?)$/);
// https://metacpan.org/pod/version#Dotted-Decimal-Versions
const dottedDecimalVersionPattern = regEx(/^v?(\d+(?:\.\d+)*(?:_\d+)?)$/);

class PerlVersioningApi extends GenericVersioningApi {
  protected _parse(version: string): GenericVersion | null {
    return (
      this._parseDecimalVersion(version) ??
      this._parseDottedDecimalVersion(version)
    );
  }

  private _parseDecimalVersion(version: string): GenericVersion | null {
    const matches = decimalVersionPattern.exec(version);
    if (!matches) {
      return null;
    }
    const [, intPart, decimalPart] = matches;
    const prerelease = decimalPart.includes('_') ? 'alpha' : '';

    const decimalComponents =
      decimalPart
        .replace(/_/g, '')
        .match(/.{1,3}/g)
        ?.map((value) => {
          let component = value;
          while (component.length < 3) {
            component += '0';
          }
          return Number.parseInt(component, 10);
        }) ?? /* istanbul ignore next */ [];
    const release = [Number.parseInt(intPart, 10), ...decimalComponents];
    return { release, prerelease };
  }

  private _parseDottedDecimalVersion(version: string): GenericVersion | null {
    const matches = dottedDecimalVersionPattern.exec(version);
    if (!matches) {
      return null;
    }
    const [, versionValue] = matches;
    const prerelease = versionValue.includes('_') ? 'alpha' : '';
    const release = versionValue.split(/[._]/).map(Number);
    return { release, prerelease };
  }
}

export const api: VersioningApi = new PerlVersioningApi();

export default api;

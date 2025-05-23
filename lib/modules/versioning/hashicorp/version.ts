import { regEx } from '../../../util/regex';

export const versionRegexpRaw = regEx(
  /v?([0-9]+(\.[0-9]+)*)(-([0-9]+[0-9A-Za-z\-~]*(\.[0-9A-Za-z\-~]+)*)|(-?([A-Za-z\-~]+[0-9A-Za-z\-~]*(\.[0-9A-Za-z\-~]+)*)))?(\+([0-9A-Za-z\-~]+(\.[0-9A-Za-z\-~]+)*))??/,
);

const versionRegexp = regEx(`^${versionRegexpRaw.source}$`);

export class Version {
  metadata: string;
  pre: string;
  segments: number[];
  si: number;
  original: string;
  prefix: string;

  constructor(v: string, length?: number) {
    const matches = v.match(versionRegexp);
    if (!matches) {
      throw new Error(`Maformed version: ${v}`);
    }

    const segmentsString = matches[1].split('.');
    this.segments = segmentsString.map((segment) => Number(segment));

    // if the version is not 3 segments, we need to pad it with 0s
    for (let i = this.segments.length; i < 3; i++) {
      this.segments.push(0);
    }

    this.pre = matches[7] ?? matches[4] ?? '';
    this.metadata = matches[10];
    this.si =
      length === undefined
        ? segmentsString.length
        : Math.min(length, segmentsString.length);
    this.original = v;
    this.prefix = this.original.startsWith('v') ? 'v' : '';
  }

  compare(other: Version): number {
    if (this.toString() === other.toString()) {
      return 0;
    }

    if (this.equalSegments(other)) {
      const preSelf = this.prerelease;
      const preOther = other.prerelease;
      if (preSelf === preOther) {
        return 0;
      }
      if (preSelf === '') {
        return 1;
      }
      if (preOther === '') {
        return -1;
      }

      return comparePrereleases(preSelf, preOther);
    }

    const thisLength = this.segments.length;
    const otherLength = other.segments.length;
    const biggestLength = Math.max(thisLength, otherLength);

    for (let i = 0; i < biggestLength; i++) {
      const thisSegment = this.segments[i] ?? 0;
      const otherSegment = other.segments[i] ?? 0;

      if (thisSegment === otherSegment) {
        continue;
      }

      if (thisSegment < otherSegment) {
        return -1;
      }

      return 1;
    }

    return 0;
  }

  equalSegments(other: Version): boolean {
    if (this.segments.length !== other.segments.length) {
      return false;
    }
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i] !== other.segments[i]) {
        return false;
      }
    }
    return true;
  }

  // This does not simply return the original input
  // As some slight variations are possible in the formatting
  // Here a normalized version is returned
  toString(): string {
    const segments = this.segments.map((segment) => String(segment));
    const pre = this.pre ? `-${this.pre}` : '';
    const metadata = this.metadata ? `+${this.metadata}` : '';
    const segmentSlice = this.pre ? segments : segments.slice(0, this.si);

    return `${this.prefix}${segmentSlice.join('.')}${pre}${metadata}`;
  }

  get prerelease(): string {
    return this.pre ?? '';
  }

  isEqual(other?: Version | null): boolean {
    if (!other) {
      return false;
    }

    return this.compare(other) === 0;
  }

  isGreaterThan(other?: Version | null): boolean {
    if (!other) {
      return false;
    }

    return this.compare(other) > 0;
  }

  isLessThan(other?: Version | null): boolean {
    if (!other) {
      return false;
    }

    return this.compare(other) < 0;
  }

  isGreaterThanOrEqual(other?: Version | null): boolean {
    if (!other) {
      return false;
    }

    return this.compare(other) >= 0;
  }

  isLessThanOrEqual(other?: Version | null): boolean {
    if (!other) {
      return false;
    }

    return this.compare(other) <= 0;
  }

  get major(): number {
    return this.segments[0];
  }

  get minor(): number | null {
    return this.segments[1] ?? null;
  }

  get patch(): number | null {
    return this.segments[2] ?? null;
  }
}

const comparePrereleases = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }

  const aParts = a.split('.');
  const bParts = b.split('.');
  const aLength = aParts.length;
  const bLength = bParts.length;
  const biggestLength = Math.max(aLength, bLength);

  for (let i = 0; i < biggestLength; i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';

    const comparePartValue = comparePart(aPart, bPart);
    if (comparePartValue !== 0) {
      return comparePartValue;
    }
  }

  return 0;
};

const comparePart = (a: string, b: string): number => {
  if (a === b) {
    return 0;
  }

  const aNumber = Number(a);
  const bNumber = Number(b);
  const aIsNumber = !isNaN(aNumber);
  const bIsNumber = !isNaN(bNumber);

  if (a === '') {
    return bIsNumber ? -1 : 1;
  }
  if (b === '') {
    return aIsNumber ? 1 : -1;
  }

  if (aIsNumber && !bIsNumber) {
    return -1;
  }
  if (!aIsNumber && bIsNumber) {
    return 1;
  }
  if (!aIsNumber && !bIsNumber && a > b) {
    return 1;
  }
  if (aNumber > bNumber) {
    return 1;
  }

  return -1;
};

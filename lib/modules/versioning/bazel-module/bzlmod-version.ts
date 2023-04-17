/**
 * A single value in a VersionPart.
 */
export class Identifier {
  asString: string;
  asNumber: number;
  isDigitsOnly: boolean;

  static digitsOnlyMatcher = /^[0-9]+$/;

  constructor(value: string) {
    this.asString = value;
    if (Identifier.digitsOnlyMatcher.test(value)) {
      this.isDigitsOnly = true;
      this.asNumber = parseInt(value);
    } else {
      this.isDigitsOnly = false;
      this.asNumber = 0;
    }
  }

  equals(other: Identifier): boolean {
    return this.asString === other.asString;
  }
}

/**
 * A collection of Identifier values that represent a portion of a Bazel module version.
 */
export class VersionPart extends Array<Identifier> {
  static create(...items: Array<Identifier | string>): VersionPart {
    const idents = items.map((item) => {
      if (typeof item === 'string') {
        return new Identifier(item);
      }
      return item;
    });
    const vp = new VersionPart();
    vp.push(...idents);
    return vp;
  }

  get asString(): string {
    return this.map((ident) => ident.asString).join('.');
  }

  // equals(other: VersionPart): boolean {
  //   if (this.length !== other.length) {
  //     return false;
  //   }
  //   for (let i = 0; i < this.length; i++) {
  //     const a = this[i];
  //     const b = other[i];
  //     if (!a.equals(b)) {
  //       return false;
  //     }
  //   }
  //   return true;
  // }
}

interface VersionRegexResult {
  release: string;
  prerelease: string | undefined;
  build: string | undefined;
}

/**
 * Represents a Bazel module version.
 */
export class BzlmodVersion {
  original: string;
  release: VersionPart;
  prerelease: VersionPart;
  build: VersionPart;

  // Supported version pattern
  static versionMatcher =
    /(?<release>[a-zA-Z0-9.]+)(?:-(?<prerelease>[a-zA-Z0-9.-]+))?(?:\+(?<build>[a-zA-Z0-9.-]+))?/;

  constructor(version: string) {
    this.original = version;
    const vparts: Partial<VersionRegexResult> | undefined =
      BzlmodVersion.versionMatcher.exec(version)?.groups;
    if (!vparts) {
      throw new Error(`Invalid Bazel module version: ${version}`);
    }
    if (!vparts.release) {
      throw new Error(`Missing release: ${version}`);
    }
    const rparts = vparts.release.split('.');
    this.release = VersionPart.create(...rparts);
    const pparts = vparts.prerelease ? vparts.prerelease.split('.') : [];
    this.prerelease = VersionPart.create(...pparts);
    // Do not parse the build value. Treat it as a single value.
    const bparts = vparts.build ? [vparts.build] : [];
    this.build = VersionPart.create(...bparts);
  }

  // Comparison

  // static defaultCompare(a: BzlmodVersion, b: BzlmodVersion): number {
  //   if (a.equals(b)) {
  //     return 0;
  //   }
  //   if (a.lessThan(b)) {
  //     return -1;
  //   }
  //   return 1;
  // }

  // equals(other: BzlmodVersion): boolean {
  //   if (!this.release.equals(other.release)) {
  //     return false;
  //   }
  //   if (!this.prerelease.equals(other.prerelease)) {
  //     return false;
  //   }
  //   if (!this.build.equals(other.build)) {
  //     return false;
  //   }
  //   return true;
  // }
}

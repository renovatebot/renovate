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

  // This logic mirrors the comparison logic in
  // https://cs.opensource.google/bazel/bazel/+/refs/heads/master:src/main/java/com/google/devtools/build/lib/bazel/bzlmod/Version.java
  lessThan(other: Identifier): boolean {
    // isDigitsOnly: true first
    if (this.isDigitsOnly !== other.isDigitsOnly) {
      return this.isDigitsOnly;
    }
    if (this.asNumber !== other.asNumber) {
      return this.asNumber < other.asNumber;
    }
    return this.asString < other.asString;
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

  get isEmpty(): boolean {
    return this.length === 0;
  }

  equals(other: VersionPart): boolean {
    if (this.length !== other.length) {
      return false;
    }
    for (let i = 0; i < this.length; i++) {
      const a = this[i];
      const b = other[i];
      if (!a.equals(b)) {
        return false;
      }
    }
    return true;
  }

  // This logic mirrors the comparison logic in
  // https://cs.opensource.google/bazel/bazel/+/refs/heads/master:src/main/java/com/google/devtools/build/lib/bazel/bzlmod/Version.java
  lessThan(other: VersionPart): boolean {
    if (this.equals(other)) {
      return false;
    }
    // Non-empty are first
    if (this.length === 0 && other.length !== 0) {
      return false;
    }
    if (other.length === 0 && this.length !== 0) {
      return true;
    }
    const shortestLen = this.length < other.length ? this.length : other.length;
    for (let i = 0; i < shortestLen; i++) {
      const a = this[i];
      const b = other[i];
      if (!a.equals(b)) {
        return a.lessThan(b);
      }
    }
    return false;
  }
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
  release: VersionPart;
  prerelease: VersionPart;
  build: VersionPart;

  // Supported version pattern
  static versionMatcher =
    /(?<release>[a-zA-Z0-9.]+)(?:-(?<prerelease>[a-zA-Z0-9.-]+))?(?:\+(?<build>[a-zA-Z0-9.-]+))?/;

  constructor(version: string) {
    if (version === '') {
      this.release = VersionPart.create();
      this.prerelease = VersionPart.create();
      this.build = VersionPart.create();
      return;
    }
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

  get isPrerelease(): boolean {
    return !this.prerelease.isEmpty;
  }

  // Comparison

  equals(other: BzlmodVersion): boolean {
    return (
      this.release.equals(other.release) &&
      this.prerelease.equals(other.prerelease) &&
      this.build.equals(other.build)
    );
  }

  // This logic mirrors the comparison logic in
  // https://cs.opensource.google/bazel/bazel/+/refs/heads/master:src/main/java/com/google/devtools/build/lib/bazel/bzlmod/Version.java
  lessThan(other: BzlmodVersion): boolean {
    if (this.release.lessThan(other.release)) {
      return true;
    }
    // Ensure that prerelease is listed before regular releases
    if (this.isPrerelease && !other.isPrerelease) {
      return true;
    }
    if (this.prerelease.lessThan(other.prerelease)) {
      return true;
    }
    // NOTE: We ignore the build value for precedence comparison per the Semver spec.
    // https://semver.org/#spec-item-10
    return false;
  }

  static defaultCompare(a: BzlmodVersion, b: BzlmodVersion): number {
    if (a.equals(b)) {
      return 0;
    }
    if (a.lessThan(b)) {
      return -1;
    }
    return 1;
  }
}

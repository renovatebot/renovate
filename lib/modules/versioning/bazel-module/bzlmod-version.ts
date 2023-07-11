/**
 * @fileoverview Contains classes that represent a Bazel module version.
 */

/**
 * Represents a single value in a VersionPart. For example, the version string
 * `1.2.3` has three identifiers: `1`, `2`, `3`.
 */
export class Identifier {
  /**
   * Returns the identifier as a string.
   */
  readonly asString: string;

  /**
   * If the identifier only contains digits, this is the numeric value.
   * Otherwise, it is `0`.
   */
  readonly asNumber: number;

  /**
   * Specifies whether the identifier only contains digits.
   */
  readonly isDigitsOnly: boolean;

  /**
   * Regular expression used to identify whether an identifier value only
   * contains digits.
   */
  static readonly digitsOnlyMatcher = /^[0-9]+$/;

  /**
   * @param value The value that is parsed for the Bazel module version parts.
   */
  constructor(value: string) {
    if (value === '') {
      throw new Error('Identifier value cannot be empty.');
    }
    this.asString = value;
    if (Identifier.digitsOnlyMatcher.test(value)) {
      this.isDigitsOnly = true;
      this.asNumber = parseInt(value);
    } else {
      this.isDigitsOnly = false;
      this.asNumber = 0;
    }
  }

  /**
   * Determines whether this identifier and another identifier are equal.
   */
  equals(other: Identifier): boolean {
    return this.asString === other.asString;
  }

  /**
   * Determines whether this identifier comes before the other identifier.
   */
  isLessThan(other: Identifier): boolean {
    // This logic mirrors the comparison logic in
    // https://cs.opensource.google/bazel/bazel/+/refs/heads/master:src/main/java/com/google/devtools/build/lib/bazel/bzlmod/Version.java
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
 * A collection of {@link Identifier} values that represent a portion of a
 * Bazel module version.
 */
export class VersionPart extends Array<Identifier> {
  /**
   * Creates a {@link VersionPart} populated with the provided identifiers.
   */
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

  /**
   * The string representation of the version part.
   */
  get asString(): string {
    return this.map((ident) => ident.asString).join('.');
  }

  /**
   * Specifies whether this contains any identifiers.
   */
  get isEmpty(): boolean {
    return this.length === 0;
  }

  /**
   * Returns the equivalent of the a Semver major value.
   */
  get major(): number {
    return this.length > 0 ? this[0].asNumber : 0;
  }

  /**
   * Returns the equivalent of the a Semver minor value.
   */
  get minor(): number {
    return this.length > 1 ? this[1].asNumber : 0;
  }

  /**
   * Returns the equivalent of the a Semver patch value.
   */
  get patch(): number {
    return this.length > 2 ? this[2].asNumber : 0;
  }

  /**
   * Determines whether this version part is equal to the other.
   */
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

  /**
   * Determines whether this version part comes before the other.
   */
  isLessThan(other: VersionPart): boolean {
    // This logic mirrors the comparison logic in
    // https://cs.opensource.google/bazel/bazel/+/refs/heads/master:src/main/java/com/google/devtools/build/lib/bazel/bzlmod/Version.java
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
        return a.isLessThan(b);
      }
    }
    return this.length < other.length;
  }
}

// Represents the capture groups produced by BzlmodVersion.versionMatcher.
interface VersionRegexResult {
  release: string;
  prerelease: string | undefined;
  build: string | undefined;
}

/**
 * Represents a version in the Bazel module system. The version format we support is
 * `RELEASE[-PRERELEASE][+BUILD]`, where `RELEASE`, `PRERELEASE`, and `BUILD` are
 * each a sequence of "identifiers" (defined as a non-empty sequence of ASCII alphanumerical
 * characters and hyphens) separated by dots. The `RELEASE` part may not contain hyphens.
 *
 * Otherwise, this format is identical to SemVer, especially in terms of the comparison algorithm
 * (https://semver.org/#spec-item-11). In other words, this format is intentionally looser than
 * SemVer; in particular:
 *
 * - the "release" part isn't limited to exactly 3 segments (major, minor, patch), but can be
 *   fewer or more;
 * - each segment in the "release" part can be identifiers instead of just numbers (so letters
 *   are also allowed -- although hyphens are not).
 *
 * Any valid SemVer version is a valid Bazel module version. Additionally, two SemVer versions
 * `a` and `b` compare `a < b` iff the same holds when they're compared as Bazel * module versions.
 *
 * The special "empty string" version can also be used, and compares higher than everything else.
 * It signifies that there is a NonRegistryOverride for a module.
 */
export class BzlmodVersion {
  readonly original: string;
  readonly release: VersionPart;
  readonly prerelease: VersionPart;
  readonly build: VersionPart;

  /**
   * The regular expression that identifies a valid Bazel module version.
   */
  static readonly versionMatcher =
    /^(?<release>[a-zA-Z0-9.]+)(?:-(?<prerelease>[a-zA-Z0-9.-]+))?(?:\+(?<build>[a-zA-Z0-9.-]+))?$/;

  /**
   * @param version The string that is parsed for the Bazel module version
   *     values.
   */
  constructor(version: string) {
    this.original = version;
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
    // The regex check above ensures that we will have a release group.
    const rparts = vparts.release!.split('.');
    this.release = VersionPart.create(...rparts);
    const pparts = vparts.prerelease ? vparts.prerelease.split('.') : [];
    this.prerelease = VersionPart.create(...pparts);
    // Do not parse the build value. Treat it as a single value.
    const bparts = vparts.build ? [vparts.build] : [];
    this.build = VersionPart.create(...bparts);
  }

  /**
   * Specifies whether this is a pre-release version.
   */
  get isPrerelease(): boolean {
    return !this.prerelease.isEmpty;
  }

  // Comparison

  /**
   * Determines whether this Bazel module version is equal to the other.
   *
   * @param other The other version for the comparison.
   * @param ignoreBuild? If specified, determines whether the build value is
   *     evaluated as part of the equality check. This is useful when
   *     determining precedence.
   */
  equals(other: BzlmodVersion, ignoreBuild?: boolean): boolean {
    if (ignoreBuild) {
      return (
        this.release.equals(other.release) &&
        this.prerelease.equals(other.prerelease)
      );
    }
    return (
      this.release.equals(other.release) &&
      this.prerelease.equals(other.prerelease) &&
      this.build.equals(other.build)
    );
  }

  /**
   * Determines whether this Bazel module version comes before the other.
   */
  isLessThan(other: BzlmodVersion): boolean {
    // This logic mirrors the comparison logic in
    // https://cs.opensource.google/bazel/bazel/+/refs/heads/master:src/main/java/com/google/devtools/build/lib/bazel/bzlmod/Version.java
    if (this.release.isLessThan(other.release)) {
      return true;
    }
    // Ensure that prerelease is listed before regular releases
    if (this.isPrerelease && !other.isPrerelease) {
      return true;
    }
    if (this.prerelease.isLessThan(other.prerelease)) {
      return true;
    }
    // NOTE: We ignore the build value for precedence comparison per the Semver spec.
    // https://semver.org/#spec-item-10
    return false;
  }

  /**
   * Determines whether this Bazel module version comes after the other.
   */
  isGreaterThan(other: BzlmodVersion): boolean {
    return BzlmodVersion.defaultCompare(this, other) === 1;
  }

  /**
   * Evaluates two Bazel module versions and returns a value specifying whether
   * a < b (-1), a == b (0), or a > b (1).
   */
  static defaultCompare(a: BzlmodVersion, b: BzlmodVersion): number {
    if (a.equals(b, true)) {
      return 0;
    }
    if (a.isLessThan(b)) {
      return -1;
    }
    return 1;
  }
}

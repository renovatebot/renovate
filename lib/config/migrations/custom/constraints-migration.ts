import { isPlainObject, isString } from '@sindresorhus/is';
import { regEx } from '../../../util/regex.ts';
import { AbstractMigration } from '../base/abstract-migration.ts';

const comparatorPattern = regEx(
  /(?<lead>^|[^<>=~^])(?<operator>==|=|\^|~>|~)\s*(?<prefix>[vV]?)(?<release>\d+(?:\.\d+)*)(?:\.[xX*](?:\.(?:\d+|[xX*]))*)?(?<suffix>[-+][0-9A-Za-z.+-]*)?/g,
);

/**
 * Returns `>=version <next`, where `next` is the release cut after `index` with that part raised by one.
 */
function toRange(
  version: string,
  prefix: string,
  parts: string[],
  index: number,
): string {
  const next = parts.slice(0, index + 1);
  next[index] = (BigInt(next[index]) + 1n).toString();
  return `>=${version} <${prefix}${next.join('.')}`;
}

/**
 * Rewrites one npm `=`, `==`, `^`, `~` or `~>` comparator to comparators or a bare
 * version with the same meaning.
 */
function migrateComparator(
  operator: string,
  prefix: string,
  release: string,
  suffix: string,
): string {
  const version = `${prefix}${release}${suffix}`;
  const parts = release.split('.');
  if (operator.startsWith('=')) {
    return version;
  }
  if (operator === '^') {
    if (parts.length === 1) {
      return version;
    }
    const nonZero = parts.findIndex((part) => BigInt(part) !== 0n);
    return toRange(
      version,
      prefix,
      parts,
      nonZero === -1 ? parts.length - 1 : nonZero,
    );
  }
  if (parts.length < 3) {
    return version;
  }
  return toRange(version, prefix, parts, 1);
}

export class ConstraintsMigration extends AbstractMigration {
  override readonly propertyName = 'constraints';

  override run(value: unknown): void {
    if (!isPlainObject(value)) {
      return;
    }
    const { erlang } = value;
    if (!isString(erlang)) {
      return;
    }
    this.rewrite({
      ...value,
      erlang: erlang.replace(comparatorPattern, (...args: unknown[]) => {
        const {
          lead,
          operator,
          prefix,
          release,
          suffix = '',
        } = args.at(-1) as Record<string, string | undefined>;
        return `${lead}${migrateComparator(operator!, prefix!, release!, suffix)}`;
      }),
    });
  }
}

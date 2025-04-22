import { escapeRegExp, regEx } from '../../../util/regex';
import { Version, versionRegexpRaw } from './version';

const equal = '=';
const notEqual = '!=';
const greaterThan = '>';
const lessThan = '<';
const greaterThanOrEqual = '>=';
const lessThanOrEqual = '<=';
const pessimistic = '~>';

export const ConstraintOperator = {
  Equal: equal,
  NotEqual: notEqual,
  GreaterThan: greaterThan,
  LessThan: lessThan,
  GreaterThanOrEqual: greaterThanOrEqual,
  LessThanOrEqual: lessThanOrEqual,
  Pessimistic: pessimistic,
} as const;

type ConstraintOperator =
  (typeof ConstraintOperator)[keyof typeof ConstraintOperator];

type constraintFunction = (v: Version, c?: Version | null) => boolean;

export class Constraint {
  f: constraintFunction;
  operator: ConstraintOperator;
  original_operator: string;
  private _check: Version | null;
  original: string;

  constructor(
    f: constraintFunction,
    operator: ConstraintOperator,
    original_operator: string,
    check?: Version | null,
    original?: string,
  ) {
    this.f = f;
    this.operator = operator;
    this.original_operator = original_operator;
    this._check = check ?? null;
    this.original = original ?? '';
  }

  get check(): Version | null {
    return this._check ?? null;
  }

  set check(v: Version) {
    this._check = v;
    this.original = this.toString();
  }

  toString(): string {
    let prefix = '';
    if (this.original_operator !== '') {
      prefix = `${this.original_operator} `;
    }
    return `${prefix}${this.check?.toString()}`;
  }
}

interface ConstraintOperation {
  op: ConstraintOperator;
  original?: string;
  f: constraintFunction;
}

const prereleaseCheck = (v: Version, c?: Version | null): boolean => {
  const vPre = v.prerelease;
  const cPre = c?.prerelease;

  if (cPre && vPre) {
    return v.equalSegments(c);
  }
  if (!cPre && vPre) {
    return false;
  }
  return true;
};

const constraintEqual: constraintFunction = (
  v: Version,
  c?: Version | null,
) => {
  return v.isEqual(c);
};

const constraintNotEqual: constraintFunction = (
  v: Version,
  c?: Version | null,
) => {
  return !v.isEqual(c);
};

const constraintGreaterThan: constraintFunction = (
  v: Version,
  c?: Version | null,
) => {
  return prereleaseCheck(v, c) && v.isGreaterThan(c);
};

const constraintLessThan: constraintFunction = (
  v: Version,
  c?: Version | null,
) => {
  return prereleaseCheck(v, c) && v.isLessThan(c);
};

const constraintGreaterThanOrEqual: constraintFunction = (
  v: Version,
  c?: Version | null,
) => {
  return prereleaseCheck(v, c) && v.isGreaterThanOrEqual(c);
};

const constraintLessThanOrEqual: constraintFunction = (
  v: Version,
  c?: Version | null,
) => {
  return prereleaseCheck(v, c) && v.isLessThanOrEqual(c);
};

const constraintPessimistic: constraintFunction = (
  v: Version,
  c?: Version | null,
) => {
  if (!prereleaseCheck(v, c) || (c?.prerelease !== '' && v.prerelease === '')) {
    return false;
  }

  if (v.isLessThan(c)) {
    return false;
  }

  const cs = c?.segments.length ?? 0;

  if (cs > v.segments.length) {
    return false;
  }

  for (let i = 0; i < (c?.si ?? 0) - 1; i++) {
    if (v.segments[i] !== c?.segments[i]) {
      return false;
    }
  }

  if ((c?.segments[cs - 1] ?? 0) > v.segments[cs - 1]) {
    return false;
  }

  return true;
};

const constraintOperators: Record<string, ConstraintOperation> = {
  '': {
    op: ConstraintOperator.Equal,
    original: '',
    f: constraintEqual,
  },
  '=': {
    op: ConstraintOperator.Equal,
    f: constraintEqual,
  },
  '!=': {
    op: ConstraintOperator.NotEqual,
    f: constraintNotEqual,
  },
  '>': {
    op: ConstraintOperator.GreaterThan,
    f: constraintGreaterThan,
  },
  '<': {
    op: ConstraintOperator.LessThan,
    f: constraintLessThan,
  },
  '>=': {
    op: ConstraintOperator.GreaterThanOrEqual,
    f: constraintGreaterThanOrEqual,
  },
  '<=': {
    op: ConstraintOperator.LessThanOrEqual,
    f: constraintLessThanOrEqual,
  },
  '~>': {
    op: ConstraintOperator.Pessimistic,
    f: constraintPessimistic,
  },
};

const constraintRegexp = (): RegExp => {
  const operatorsRexegPart = Object.keys(constraintOperators)
    .map((op) => escapeRegExp(op))
    .join('|');

  return regEx(
    `^\\s*(${operatorsRexegPart})\\s*(${versionRegexpRaw.source})\\s*$`,
  );
};

export class Constraints {
  private constraints: Constraint[] | null = null;

  constructor(v: string) {
    this.constraints = v
      .split(',')
      .map((single) => Constraints.parseConstraint(single));
  }

  private static parseConstraint(v: string): Constraint {
    const matches = constraintRegexp().exec(v);
    if (!matches) {
      throw new Error(`Malformed constraint: ${v}`);
    }

    const check = new Version(matches[2]);
    const operator = constraintOperators[matches[1]];

    return new Constraint(
      operator.f,
      operator.op,
      operator.original ?? matches[1],
      check,
      v,
    );
  }

  check(v: Version): boolean {
    if (!this.constraints) {
      return false;
    }
    for (const constraint of this.constraints) {
      if (!constraint.f(v, constraint.check)) {
        return false;
      }
    }
    return true;
  }

  isLessThan(i: number, j: number): boolean {
    if (!this.constraints) {
      return false;
    }

    const constraint = this.constraints[i];
    const check = this.constraints[j];

    if (constraint.operator < check.operator) {
      return true;
    }
    if (constraint.operator > check.operator) {
      return false;
    }

    return constraint.check!.isLessThan(check.check);
  }

  get length(): number {
    if (!this.constraints) {
      return 0;
    }
    return this.constraints.length;
  }

  get constraintsList(): Constraint[] {
    if (!this.constraints) {
      return [];
    }
    return this.constraints;
  }

  sort(): void {
    if (!this.constraints) {
      return;
    }
    this.constraints.sort((a, b) => {
      if (a.operator < b.operator) {
        return -1;
      }
      if (a.operator > b.operator) {
        return 1;
      }
      return a.check!.isLessThan(b.check) ? -1 : 1;
    });
  }

  toString(): string {
    if (!this.constraints) {
      return '';
    }
    return this.constraints
      .map((constraint) => `${constraint.original}`)
      .join(', ');
  }

  get maxConstraint(): Constraint | null {
    if (!this.constraints) {
      return null;
    }
    this.sort();
    const lastConstraint = this.constraints[this.constraints.length - 1];
    return lastConstraint.operator === ConstraintOperator.LessThan ||
      lastConstraint.operator === ConstraintOperator.LessThanOrEqual
      ? lastConstraint
      : null;
  }

  get minConstraint(): Constraint | null {
    if (!this.constraints) {
      return null;
    }
    this.sort();
    const firstConstraint = this.constraints[0];
    return firstConstraint.operator === ConstraintOperator.GreaterThan ||
      firstConstraint.operator === ConstraintOperator.GreaterThanOrEqual
      ? firstConstraint
      : null;
  }
}

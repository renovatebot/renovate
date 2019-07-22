const EQUAL = '=';
const NOT_EQUAL = '!=';

const GT = '>';
const LT = '<';

const GTE = '>=';
const LTE = '<=';
const PGTE = '~>';

const SINGLE = [EQUAL];
const ALL = [EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE];

const isValidOperator = (operator: string) => ALL.includes(operator);
const isSingleOperator = (operator: string) => SINGLE.includes(operator);

export {
  EQUAL,
  NOT_EQUAL,
  GT,
  LT,
  GTE,
  LTE,
  PGTE,
  isValidOperator,
  isSingleOperator,
};

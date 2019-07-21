const EQUAL = '=';
const NOT_EQUAL = '!=';

const GT = '>';
const LT = '<';

const GTE = '>=';
const LTE = '<=';
const PGTE = '~>';

const SINGLE = [EQUAL];
const ALL = [EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE];

const isValidOperator = operator => ALL.includes(operator);
const isSingleOperator = operator => SINGLE.includes(operator);

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

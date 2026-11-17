const EQUAL = '=';
const NOT_EQUAL = '!=';

const GT = '>';
const LT = '<';

const GTE = '>=';
const LTE = '<=';
const PGTE = '~>';

const SINGLE = [EQUAL];
const ALL = [EQUAL, NOT_EQUAL, GT, LT, GTE, LTE, PGTE];

function isValidOperator(operator: string): boolean {
  return ALL.includes(operator);
}
function isSingleOperator(operator: string): boolean {
  return SINGLE.includes(operator);
}

export {
  EQUAL,
  GT,
  GTE,
  LT,
  LTE,
  NOT_EQUAL,
  PGTE,
  isSingleOperator,
  isValidOperator,
};

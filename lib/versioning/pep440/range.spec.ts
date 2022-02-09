import { checkRangeAndRemoveUnnecessaryRangeLimit } from './range';

test.each`
  rangeInput           | expected
  ${'==4.1.*,>=3.2.2'} | ${'==4.1.*'}
  ${'==4.0.*,>=3.2.2'} | ${'==4.0.*'}
  ${'~=1.2.3,!=1.1.1'} | ${'~=1.2.3,!=1.1.1'}
  ${'==7.2.*'}         | ${'==7.2.*'}
  ${'==7.2.8'}         | ${'==7.2.8'}
  ${'==7.2.8,>=7.2.2'} | ${'==7.2.8'}
`('checkRange("rangeIn  put") === "$expected"', ({ rangeInput, expected }) => {
  const res = checkRangeAndRemoveUnnecessaryRangeLimit(rangeInput);
  expect(res).toEqual(expected);
});

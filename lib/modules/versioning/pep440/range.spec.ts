import { checkRangeAndRemoveUnnecessaryRangeLimit } from './range';

it.each`
  rangeInput           | newVersion | expected
  ${'==4.1.*,>=3.2.2'} | ${'4.1.1'} | ${'==4.1.*'}
  ${'==4.0.*,>=3.2.2'} | ${'4.0.0'} | ${'==4.0.*'}
  ${'==7.2.*'}         | ${'7.2.0'} | ${'==7.2.*'}
`(
  'checkRange("$rangeInput, "$newVersion"") === "$expected"',
  ({ rangeInput, newVersion, expected }) => {
    const res = checkRangeAndRemoveUnnecessaryRangeLimit(
      rangeInput,
      newVersion,
    );
    expect(res).toEqual(expected);
  },
);

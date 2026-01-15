import { InheritConfig } from './inherit';

describe('config/inherit', () => {
  it('all values in OPTIONS are sorted', () => {
    const defined = InheritConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });
});

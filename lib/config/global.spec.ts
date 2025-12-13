import { GlobalConfig } from './global';

describe('config/global', () => {
  it('all values in OPTIONS are sorted', () => {
    const defined = GlobalConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });
});

import { InheritConfig, NOT_PRESENT } from './inherit.ts';

describe('config/inherit', () => {
  it('all values in OPTIONS are sorted', () => {
    const defined = InheritConfig.OPTIONS;

    const sorted = [...defined].sort();

    expect(defined, 'OPTIONS should be sorted alphabetically').toStrictEqual(
      sorted,
    );
  });

  describe('InheritConfig.get()', () => {
    it('return NOT_PRESENT if key is not set', () => {
      expect(InheritConfig.get('configFileNames')).toEqual(NOT_PRESENT);
      expect(InheritConfig.get('configFileNames')).not.toEqual('not-present');
    });

    it('return value if key is set', () => {
      InheritConfig.set({
        configFileNames: ['inherited'],
      });
      expect(InheritConfig.get('configFileNames')).toEqual(['inherited']);
    });
  });
});

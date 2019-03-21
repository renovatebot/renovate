const {
  compare,
  parseRange,
  rangeToStr,
  autoExtendMavenRange,
} = require('../../lib/versioning/maven/compare');
const {
  isVersion,
  isStable,
  getMajor,
  getMinor,
  getPatch,
  matches,
} = require('../../lib/versioning/maven/index');

describe('versioning/maven/compare', () => {
  it('returns equality', () => {
    expect(compare('1.0.0', '1')).toEqual(0);
    expect(compare('1-a1', '1-alpha-1')).toEqual(0);
    expect(compare('1-b1', '1-beta-1')).toEqual(0);
    expect(compare('1.0.0', '1.ga')).toEqual(0);
    expect(compare('1-ga', '1.ga')).toEqual(0);
    expect(compare('1-ga-1', '1-1')).toEqual(0);
    expect(compare('1.final', '1.0')).toEqual(0);
    expect(compare('1', '1.0')).toEqual(0);
    expect(compare('1.', '1-')).toEqual(0);
    expect(compare('1.0.0-0.0.0', '1-final')).toEqual(0);
    expect(compare('1-1.foo-bar1baz-.1', '1-1.foo-bar-1-baz-0.1')).toEqual(0);
    expect(compare('1.0ALPHA1', '1.0-a1')).toEqual(0);
    expect(compare('1.0Alpha1', '1.0-a1')).toEqual(0);
    expect(compare('1.0AlphA1', '1.0-a1')).toEqual(0);
    expect(compare('1.0BETA1', '1.0-b1')).toEqual(0);
    expect(compare('1.0MILESTONE1', '1.0-m1')).toEqual(0);
    expect(compare('1.0RC1', '1.0-cr1')).toEqual(0);
    expect(compare('1.0GA', '1.0')).toEqual(0);
    expect(compare('1.0FINAL', '1.0')).toEqual(0);
    expect(compare('1.0-SNAPSHOT', '1-snapshot')).toEqual(0);
    expect(compare('1.0alpha1', '1.0-a1')).toEqual(0);
    expect(compare('1.0alpha-1', '1.0-a1')).toEqual(0);
    expect(compare('1.0beta1', '1.0-b1')).toEqual(0);
    expect(compare('1.0beta-1', '1.0-b1')).toEqual(0);
    expect(compare('1.0milestone1', '1.0-m1')).toEqual(0);
    expect(compare('1.0milestone-1', '1.0-m1')).toEqual(0);
    expect(compare('1.0rc1', '1.0-cr1')).toEqual(0);
    expect(compare('1.0rc-1', '1.0-cr1')).toEqual(0);
    expect(compare('1.0ga', '1.0')).toEqual(0);
    expect(compare('1-0.ga', '1.0')).toEqual(0);
    expect(compare('1.0-final', '1.0')).toEqual(0);
    expect(compare('1-0-ga', '1.0')).toEqual(0);
    expect(compare('1-0-final', '1-0')).toEqual(0);
    expect(compare('1-0', '1.0')).toEqual(0);
    expect(compare('v1.2.3', '1.2.3')).toEqual(0);
  });
  it('returns less than', () => {
    expect(compare('1', '1.1')).toEqual(-1);
    expect(compare('1', '2')).toEqual(-1);
    expect(compare('1-snapshot', '1')).toEqual(-1);
    expect(compare('1', '1-sp')).toEqual(-1);
    expect(compare('1-foo2', '1-foo10')).toEqual(-1);
    expect(compare('1-m1', '1-milestone-2')).toEqual(-1);
    expect(compare('1.foo', '1-foo')).toEqual(-1);
    expect(compare('1-foo', '1-1')).toEqual(-1);
    expect(compare('1-alpha.1', '1-beta.1')).toEqual(-1);
    expect(compare('1-1', '1.1')).toEqual(-1);
    expect(compare('1-ga', '1-ap')).toEqual(-1);
    expect(compare('1-ga.1', '1-sp.1')).toEqual(-1);
    expect(compare('1-sp-1', '1-ga-1')).toEqual(-1);
    expect(compare('1-cr1', '1')).toEqual(-1);
  });
  it('returns greater than', () => {
    expect(compare('1.1', '1')).toEqual(1);
    expect(compare('2', '1')).toEqual(1);
    expect(compare('1', '1-snapshot')).toEqual(1);
    expect(compare('1-sp', '1')).toEqual(1);
    expect(compare('1-foo10', '1-foo2')).toEqual(1);
    expect(compare('1-milestone-2', '1-m1')).toEqual(1);
    expect(compare('1-foo', '1.foo')).toEqual(1);
    expect(compare('1-1', '1-foo')).toEqual(1);
    expect(compare('1-beta.1', '1-alpha.1')).toEqual(1);
    expect(compare('1.1', '1-1')).toEqual(1);
    expect(compare('1-sp', '1-ga')).toEqual(1);
    expect(compare('1-sp.1', '1-ga.1')).toEqual(1);
    expect(compare('1-ga-1', '1-sp-1')).toEqual(1);
    expect(compare('1', '1-cr1')).toEqual(1);
  });

  const invalidRanges = [
    '1.2.3-SNAPSHOT', // versions should be handled separately
    '[]',
    '[,]',
    '(',
    '[',
    ',',
    '[1.0',
    '1.0]',
    '[1.0],',
    ',[1.0]',
    '(,1.1),(1.0,)',
    '(0,1.1),(1.0,2.0)',
    '(0,1.1),(,2.0)',
    '(,1.0],,[1.2,)',
    '(,1.0],[1.2,),',
    '[1.5,]',
    '[2.0,1.0)',
    '[1.2,1.3],1.4',
    '[1.2,,1.3]',
    '[1.3,1.2]',
    '[1,[2,3],4]',
    '[,1.0]',
  ];
  it('filters out incorrect ranges', () => {
    Object.keys(invalidRanges).forEach(rangeStr => {
      const range = parseRange(rangeStr);
      expect(range).toEqual(null);
      expect(rangeToStr(range)).toEqual(null);
    });
  });
  it('parses version ranges and translates them back to string', () => {
    const presetRanges = {
      ...invalidRanges.reduce((acc, str) => ({ ...acc, [str]: null }), {}),
      '[1.0]': [
        {
          leftType: 'INCLUDING_POINT',
          leftValue: '1.0',
          rightType: 'INCLUDING_POINT',
          rightValue: '1.0',
        },
      ],
      '(,1.0]': [
        {
          leftType: 'EXCLUDING_POINT',
          leftValue: null,
          rightType: 'INCLUDING_POINT',
          rightValue: '1.0',
        },
      ],
      '[1.2,1.3]': [
        {
          leftType: 'INCLUDING_POINT',
          leftValue: '1.2',
          rightType: 'INCLUDING_POINT',
          rightValue: '1.3',
        },
      ],
      '[1.0,2.0)': [
        {
          leftType: 'INCLUDING_POINT',
          leftValue: '1.0',
          rightType: 'EXCLUDING_POINT',
          rightValue: '2.0',
        },
      ],
      '[1.5,)': [
        {
          leftType: 'INCLUDING_POINT',
          leftValue: '1.5',
          rightType: 'EXCLUDING_POINT',
          rightValue: null,
        },
      ],
      '(,1.0],[1.2,)': [
        {
          leftType: 'EXCLUDING_POINT',
          leftValue: null,
          rightType: 'INCLUDING_POINT',
          rightValue: '1.0',
        },
        {
          leftType: 'INCLUDING_POINT',
          leftValue: '1.2',
          rightType: 'EXCLUDING_POINT',
          rightValue: null,
        },
      ],
      '(,1.1),(1.1,)': [
        {
          leftType: 'EXCLUDING_POINT',
          leftValue: null,
          rightType: 'EXCLUDING_POINT',
          rightValue: '1.1',
        },
        {
          leftType: 'EXCLUDING_POINT',
          leftValue: '1.1',
          rightType: 'EXCLUDING_POINT',
          rightValue: null,
        },
      ],
    };
    Object.keys(presetRanges).forEach(rangeStr => {
      const presetValue = presetRanges[rangeStr];
      const fullRange = parseRange(rangeStr);
      expect(presetValue).toEqual(fullRange);
      if (fullRange === null) {
        expect(presetValue).toEqual(null);
      } else {
        expect(rangeToStr(fullRange)).toEqual(rangeStr);
      }
    });
  });
  it('extends ranges with new versions', () => {
    const sample = [
      ['[1.2.3]', '1.2.3', '[1.2.3]'],
      ['[1.2.3]', '1.2.4', '[1.2.4]'],
      ['[1.0.0,1.2.3]', '1.2.4', '[1.0.0,1.2.4]'],
      ['[1.0.0,1.2.23]', '1.1.0', '[1.0.0,1.2.23]'],
      ['(,1.0]', '2.0', '(,2.0]'],
      ['(,1.0)', '2.0', '(,2.0)'],
      ['[1.0,1.2],[1.3,1.5)', '1.2.4', '[1.0,1.2.4],[1.3,1.5)'],
      ['[1.2.3,)', '1.2.4', '[1.2.4,)'],
      ['[1.2.3,]', '1.2.4', '[1.2.3,]'], // invalid range
    ];
    sample.forEach(([oldRepr, newValue, newRepr]) => {
      expect(autoExtendMavenRange(oldRepr, newValue)).toEqual(newRepr);
    });
  });
});

describe('versioning/maven/index', () => {
  it('validates version string', () => {
    expect(isVersion('')).toEqual(false);
    expect(isVersion('1.0.0')).toEqual(true);
    expect(isVersion('0')).toEqual(true);
    expect(isVersion('0.1-2-sp')).toEqual(true);
    expect(isVersion('1-final')).toEqual(true);
    expect(isVersion('v1.0.0')).toEqual(true);
    expect(isVersion('x1.0.0')).toEqual(true);
    expect(isVersion('2.1.1.RELEASE')).toEqual(true);
    expect(isVersion('Greenwich.SR1')).toEqual(true);
    expect(isVersion('.1')).toEqual(false);
    expect(isVersion('1.')).toEqual(false);
    expect(isVersion('-1')).toEqual(false);
    expect(isVersion('1-')).toEqual(false);
  });
  it('checks if version is stable', () => {
    expect(isStable('')).toEqual(null);
    expect(isStable('foobar')).toEqual(false);
    expect(isStable('1')).toEqual(true);
    expect(isStable('1.2')).toEqual(true);
    expect(isStable('1.2.3')).toEqual(true);
    expect(isStable('1.2.3.4')).toEqual(true);
    expect(isStable('v1.2.3.4')).toEqual(true);
    expect(isStable('1-alpha-1')).toEqual(false);
    expect(isStable('1-b1')).toEqual(false);
    expect(isStable('1.final')).toEqual(true);
    expect(isStable('1.0milestone1')).toEqual(false);
    expect(isStable('1-sp')).toEqual(true);
    expect(isStable('1-ga-1')).toEqual(true);
  });
  it('returns major version', () => {
    expect(getMajor('')).toEqual(null);
    expect(getMajor('1')).toEqual(1);
    expect(getMajor('1.2')).toEqual(1);
    expect(getMajor('1.2.3')).toEqual(1);
    expect(getMajor('v1.2.3')).toEqual(1);
    expect(getMajor('1rc42')).toEqual(1);
  });
  it('returns minor version', () => {
    expect(getMinor('')).toEqual(null);
    expect(getMinor('1')).toEqual(0);
    expect(getMinor('1.2')).toEqual(2);
    expect(getMinor('1.2.3')).toEqual(2);
    expect(getMinor('v1.2.3')).toEqual(2);
    expect(getMinor('1.2.3.4')).toEqual(2);
    expect(getMinor('1-rc42')).toEqual(0);
  });
  it('returns patch version', () => {
    expect(getPatch('')).toEqual(null);
    expect(getPatch('1')).toEqual(0);
    expect(getPatch('1.2')).toEqual(0);
    expect(getPatch('1.2.3')).toEqual(3);
    expect(getPatch('v1.2.3')).toEqual(3);
    expect(getPatch('1.2.3.4')).toEqual(3);
    expect(getPatch('1-rc10')).toEqual(0);
    expect(getPatch('1-rc42-1')).toEqual(0);
  });
  it('matches against maven ranges', () => {
    expect(matches('0', '[0,1]')).toEqual(true);
    expect(matches('1', '[0,1]')).toEqual(true);
    expect(matches('0', '(0,1)')).toEqual(false);
    expect(matches('1', '(0,1)')).toEqual(false);
    expect(matches('1', '(0,2)')).toEqual(true);
    expect(matches('1', '[0,2]')).toEqual(true);
    expect(matches('1', '(,1]')).toEqual(true);
    expect(matches('1', '(,1)')).toEqual(false);
    expect(matches('1', '[1,)')).toEqual(true);
    expect(matches('1', '(1,)')).toEqual(false);
    expect(matches('1', '(,1),(1,)')).toEqual(false);
    expect(matches('1', '(0,1),(1,2)')).toEqual(false);
  });
});

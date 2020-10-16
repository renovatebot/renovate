import { parse, parseFloatingRange, parseIntervalRange } from './parse';

describe('lib/versioning/nuget/parse', () => {
  describe('parse', () => {
    [
      {
        input: '9.0.3',
        output: { release: [9, 0, 3], suffix: '', isExact: false },
      },
      {
        input: '1.2019.3.22',
        output: { release: [1, 2019, 3, 22], suffix: '', isExact: false },
      },
      {
        input: '3.0.0-beta',
        output: { release: [3, 0, 0], suffix: '-beta', isExact: false },
      },
      {
        input: '2.0.2-pre2019',
        output: { release: [2, 0, 2], suffix: '-pre2019', isExact: false },
      },
      {
        input: '1.0.0+c30d7625',
        output: { release: [1, 0, 0], suffix: '', isExact: false },
      },
      {
        input: '2.3.4-beta+1990ef74',
        output: { release: [2, 3, 4], suffix: '-beta', isExact: false },
      },
      {
        input: '17.04',
        output: { release: [17, 4], suffix: '', isExact: false },
      },
      {
        input: '3.0.0.beta',
        output: null,
      },
      {
        input: '5.1.2-+',
        output: null,
      },
      {
        input: '[1.2.3]',
        output: { release: [1, 2, 3], suffix: '', isExact: true },
      },
      {
        input: '(1.2.3)',
        output: null,
      },
      {
        input: '9.X.0',
        output: null,
      },
    ].forEach(({ input, output }) =>
      it(`${input} - ${output ? 'valid' : 'invalid'}`, () =>
        expect(parse(input)).toEqual(output))
    );
  });

  describe('parseIntervalRange', () => {
    [
      {
        input: '(1.0,)',
        output: {
          leftBracket: '(',
          leftValue: '1.0',
          rightBracket: ')',
          rightValue: '',
        },
      },
      {
        input: '(,1.0]',
        output: {
          leftBracket: '(',
          leftValue: '',
          rightBracket: ']',
          rightValue: '1.0',
        },
      },
      {
        input: '(,1.0)',
        output: {
          leftBracket: '(',
          leftValue: '',
          rightBracket: ')',
          rightValue: '1.0',
        },
      },
      {
        input: '[,1.0)',
        output: {
          leftBracket: '[',
          leftValue: '',
          rightBracket: ')',
          rightValue: '1.0',
        },
      },
      {
        input: '(1.0,)',
        output: {
          leftBracket: '(',
          leftValue: '1.0',
          rightBracket: ')',
          rightValue: '',
        },
      },
      {
        input: '(1.0,]',
        output: {
          leftBracket: '(',
          leftValue: '1.0',
          rightBracket: ']',
          rightValue: '',
        },
      },
      {
        input: '(,)',
        output: null,
      },
      {
        input: '[1.0,2.0]',
        output: {
          leftBracket: '[',
          leftValue: '1.0',
          rightBracket: ']',
          rightValue: '2.0',
        },
      },
      {
        input: '(1.0,2.0)',
        output: {
          leftBracket: '(',
          leftValue: '1.0',
          rightBracket: ')',
          rightValue: '2.0',
        },
      },
      {
        input: '[1.0,2.0)',
        output: {
          leftBracket: '[',
          leftValue: '1.0',
          rightBracket: ')',
          rightValue: '2.0',
        },
      },
      {
        input: '[1,0]',
        output: null,
      },
      {
        input: '[1,0)',
        output: null,
      },
      {
        input: '(1,0]',
        output: null,
      },
      {
        input: '(1,0)',
        output: null,
      },
      {
        input: '(1-a,1-b)',
        output: {
          leftBracket: '(',
          leftValue: '1-a',
          rightBracket: ')',
          rightValue: '1-b',
        },
      },
      {
        input: '(1-b,1-a)',
        output: null,
      },
      {
        input: '[1-b,1-a]',
        output: null,
      },
    ].forEach(({ input, output }) =>
      it(`${input} - ${output ? 'valid' : 'invalid'}`, () =>
        expect(parseIntervalRange(input)).toEqual(output))
    );
  });

  describe('parseFloatingRange', () => {
    [
      { input: '1.2.3-*', output: { release: [1, 2, 3], suffix: '*' } },
      { input: '1.2.*', output: { release: [1, 2, '*'], suffix: '' } },
      { input: '1.*', output: { release: [1, '*'], suffix: '' } },
      { input: '*', output: { release: ['*'], suffix: '' } },
      { input: '*.2.3', output: null },
      { input: '1.X.*', output: null },
    ].forEach(({ input, output }) =>
      it(`${input} - ${output ? 'valid' : 'invalid'}`, () =>
        expect(parseFloatingRange(input)).toEqual(output))
    );
  });
});

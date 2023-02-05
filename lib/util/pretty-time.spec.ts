import { toMs } from './pretty-time';

describe('util/pretty-time', () => {
  test.each`
    input                | expected
    ${'1h'}              | ${1 * 60 * 60 * 1000}
    ${' 1 h '}           | ${1 * 60 * 60 * 1000}
    ${'1 h'}             | ${1 * 60 * 60 * 1000}
    ${'1 hour'}          | ${1 * 60 * 60 * 1000}
    ${'1hour'}           | ${1 * 60 * 60 * 1000}
    ${'1h 1m'}           | ${1 * 60 * 60 * 1000 + 1 * 60 * 1000}
    ${'1hour 1minute'}   | ${1 * 60 * 60 * 1000 + 1 * 60 * 1000}
    ${'1 hour 1 minute'} | ${1 * 60 * 60 * 1000 + 1 * 60 * 1000}
    ${'1h 1m 1s'}        | ${1 * 60 * 60 * 1000 + 1 * 60 * 1000 + 1000}
    ${'1h 1 m 1s'}       | ${1 * 60 * 60 * 1000 + 1 * 60 * 1000 + 1000}
    ${'1hour 1 min 1s'}  | ${1 * 60 * 60 * 1000 + 1 * 60 * 1000 + 1000}
    ${'1h 1m 1s 1ms'}    | ${1 * 60 * 60 * 1000 + 1 * 60 * 1000 + 1000 + 1}
    ${'3 days'}          | ${3 * 24 * 60 * 60 * 1000}
    ${'0'.repeat(100)}   | ${0}
    ${'0'.repeat(101)}   | ${null}
    ${'1 whatever'}      | ${null}
    ${'whatever'}        | ${null}
    ${''}                | ${null}
    ${' '}               | ${null}
    ${'  \t\n   '}       | ${null}
    ${'minute'}          | ${null}
    ${'m'}               | ${null}
    ${'hour'}            | ${null}
    ${'h'}               | ${null}
  `(`toMs('$input') === $expected`, ({ input, expected }) => {
    expect(toMs(input)).toBe(expected);
  });

  it('returns null for error', () => {
    expect(toMs(null as never)).toBeNull();
  });
});

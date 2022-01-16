import { range } from './range';

describe('util/range', () => {
  test.each`
    start | end  | expected
    ${0}  | ${0} | ${[0]}
    ${0}  | ${1} | ${[0, 1]}
    ${0}  | ${2} | ${[0, 1, 2]}
    ${0}  | ${3} | ${[0, 1, 2, 3]}
    ${1}  | ${0} | ${[]}
    ${1}  | ${1} | ${[1]}
    ${2}  | ${1} | ${[]}
    ${1}  | ${2} | ${[1, 2]}
    ${2}  | ${2} | ${[2]}
    ${3}  | ${2} | ${[]}
    ${0}  | ${3} | ${[0, 1, 2, 3]}
    ${1}  | ${3} | ${[1, 2, 3]}
    ${2}  | ${3} | ${[2, 3]}
    ${3}  | ${3} | ${[3]}
    ${4}  | ${3} | ${[]}
    ${-2} | ${2} | ${[-2, -1, 0, 1, 2]}
  `('range($start, $end)', ({ start, end, expected }) => {
    const res = range(start, end);
    expect([...res]).toEqual(expected);
  });
});

import { codeBlock } from 'common-tags';
import { parse as graphqlParse } from 'graphql';
import { DateTime } from 'luxon';
import { isDateExpired, prepareQuery } from './util';

const isoTs = (t: string) => DateTime.fromJSDate(new Date(t)).toISO()!;

describe('util/github/graphql/util', () => {
  describe('prepareQuery', () => {
    it('returns valid query for valid payload query', () => {
      const payloadQuery = codeBlock`
        items {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            version
            releaseTimestamp
            foo
          }
        }
      `;
      expect(() => graphqlParse(`query { ${payloadQuery} }`)).not.toThrow();
      expect(() => graphqlParse(prepareQuery(payloadQuery))).not.toThrow();
    });

    it('returns invalid query for invalid payload query', () => {
      const payloadQuery = '!@#';
      expect(() => graphqlParse(`query { ${payloadQuery} }`)).toThrow();
      expect(() => graphqlParse(prepareQuery(payloadQuery))).toThrow();
    });
  });

  it.each`
    currentTime           | initialTimestamp      | duration        | expected
    ${'2022-11-25 15:58'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${false}
    ${'2022-11-25 15:59'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${false}
    ${'2022-11-25 16:00'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${true}
    ${'2022-11-25 16:01'} | ${'2022-11-25 15:00'} | ${{ hours: 1 }} | ${true}
    ${'2022-11-25 14:58'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${false}
    ${'2022-11-25 14:59'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${false}
    ${'2022-11-25 15:00'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${true}
    ${'2022-11-25 15:01'} | ${'2022-11-24 15:00'} | ${{ days: 1 }}  | ${true}
  `(
    'isDateExpired($currentTime, $initialTimestamp, $duration) === $expected',
    ({ currentTime, initialTimestamp, duration, expected }) => {
      expect(
        isDateExpired(
          DateTime.fromISO(isoTs(currentTime)),
          isoTs(initialTimestamp),
          duration,
        ),
      ).toBe(expected);
    },
  );
});

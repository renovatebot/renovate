import { codeBlock } from 'common-tags';
import { parse as graphqlParse } from 'graphql';
import { DateTime } from 'luxon';
import { isDateExpired, prepareQuery } from './util.ts';

function isoTs(t: string) {
  return DateTime.fromJSDate(new Date(t)).toISO()!;
}

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
      expect(() => graphqlParse(`query { ${payloadQuery} }`)).toThrow(
        'Syntax Error: Expected Name, found "!".',
      );
      expect(() => graphqlParse(prepareQuery(payloadQuery))).toThrow(
        'Syntax Error: Expected Name, found "!".',
      );
    });

    it('does not declare $query by default', () => {
      const payloadQuery = codeBlock`
        items {
          nodes {
            version
            releaseTimestamp
          }
        }
      `;
      const result = prepareQuery(payloadQuery);
      expect(result).not.toContain('$query');
      expect(() => graphqlParse(result)).not.toThrow();
    });

    it('declares $query when withRefQuery is set', () => {
      const payloadQuery = codeBlock`
        refs(query: $query) {
          nodes {
            version
            releaseTimestamp
          }
        }
      `;
      const result = prepareQuery(payloadQuery, { withRefQuery: true });
      expect(result).toContain('$query: String');
      expect(() => graphqlParse(result)).not.toThrow();
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

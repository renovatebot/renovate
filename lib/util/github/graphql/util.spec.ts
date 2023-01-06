import { codeBlock } from 'common-tags';
import { parse as graphqlParse } from 'graphql';
import { prepareQuery } from './util';

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
});

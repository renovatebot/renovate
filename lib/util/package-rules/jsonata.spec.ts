import { JsonataMatcher } from './jsonata';

describe('JsonataMatcher', () => {
  const matcher = new JsonataMatcher();

  it('should return true for a matching JSONata expression', () => {
    const result = matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: '$.depName = "lodash"' }
    );
    expect(result).toBeTrue();
  });

  it('should return false for a non-matching JSONata expression', () => {
    const result = matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: '$.depName = "react"' }
    );
    expect(result).toBeFalse();
  });

  it('should return false for an invalid JSONata expression', () => {
    const result = matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: '$.depName = ' }
    );
    expect(result).toBeFalse();
  });

  it('should return null if matchJsonata is not defined', () => {
    const result = matcher.matches(
      { depName: 'lodash' },
      {}
    );
    expect(result).toBeNull();
  });

  it('should return true for a complex JSONata expression', () => {
    const result = matcher.matches(
      { depName: 'lodash', version: '4.17.21' },
      { matchJsonata: '$.depName = "lodash" and $.version = "4.17.21"' }
    );
    expect(result).toBeTrue();
  });

  it('should return false for a complex JSONata expression with non-matching version', () => {
    const result = matcher.matches(
      { depName: 'lodash', version: '4.17.20' },
      { matchJsonata: '$.depName = "lodash" and $.version = "4.17.21"' }
    );
    expect(result).toBeFalse();
  });

  it('should return true for a JSONata expression with nested properties', () => {
    const result = matcher.matches(
      { dep: { name: 'lodash', version: '4.17.21' } },
      { matchJsonata: '$.dep.name = "lodash" and $.dep.version = "4.17.21"' }
    );
    expect(result).toBeTrue();
  });

  it('should return false for a JSONata expression with nested properties and non-matching version', () => {
    const result = matcher.matches(
      { dep: { name: 'lodash', version: '4.17.20' } },
      { matchJsonata: '$.dep.name = "lodash" and $.dep.version = "4.17.21"' }
    );
    expect(result).toBeFalse();
  });
});

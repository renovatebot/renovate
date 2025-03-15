import { JsonataMatcher } from './jsonata';

describe('util/package-rules/jsonata', () => {
  const matcher = new JsonataMatcher();

  it('should return true for a matching JSONata expression', async () => {
    const result = await matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: ['depName = "lodash"'] },
    );
    expect(result).toBeTrue();
  });

  it('should return false for a non-matching JSONata expression', async () => {
    const result = await matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: ['depName = "react"'] },
    );
    expect(result).toBeFalse();
  });

  it('should return false for an invalid JSONata expression', async () => {
    const result = await matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: ['depName = '] },
    );
    expect(result).toBeFalse();
  });

  it('should return null if matchJsonata is not defined', async () => {
    const result = await matcher.matches({ depName: 'lodash' }, {});
    expect(result).toBeNull();
  });

  it('should return true for a complex JSONata expression', async () => {
    const result = await matcher.matches(
      { depName: 'lodash', version: '4.17.21' },
      { matchJsonata: ['depName = "lodash" and version = "4.17.21"'] },
    );
    expect(result).toBeTrue();
  });

  it('should return false for a complex JSONata expression with non-matching version', async () => {
    const result = await matcher.matches(
      { depName: 'lodash', version: '4.17.20' },
      { matchJsonata: ['depName = "lodash" and version = "4.17.21"'] },
    );
    expect(result).toBeFalse();
  });

  it('should return true for a JSONata expression with nested properties', async () => {
    const result = await matcher.matches(
      { dep: { name: 'lodash', version: '4.17.21' } },
      { matchJsonata: ['dep.name = "lodash" and dep.version = "4.17.21"'] },
    );
    expect(result).toBeTrue();
  });

  it('should return false for a JSONata expression with nested properties and non-matching version', async () => {
    const result = await matcher.matches(
      { dep: { name: 'lodash', version: '4.17.20' } },
      { matchJsonata: ['dep.name = "lodash" and dep.version = "4.17.21"'] },
    );
    expect(result).toBeFalse();
  });

  it('should return true if any JSONata expression matches', async () => {
    const result = await matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: ['depName = "react"', 'depName = "lodash"'] },
    );
    expect(result).toBeTrue();
  });

  it('should catch evaluate errors', async () => {
    const result = await matcher.matches(
      { depName: 'lodash' },
      { matchJsonata: ['$notafunction()'] },
    );
    expect(result).toBeFalse();
  });
});

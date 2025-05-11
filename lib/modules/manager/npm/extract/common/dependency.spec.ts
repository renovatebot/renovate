import { getExtractedConstraints } from './dependency';

describe('modules/manager/npm/extract/common/dependency', () => {
  it('prioritizes volta pins', () => {
    const deps = [
      {
        depName: 'npm',
        depType: 'volta',
        currentValue: '1.0.0',
      },
      {
        depName: 'npm',
        depType: 'packageManager',
        currentValue: '1.1.0',
      },
      {
        depName: 'npm',
        depType: 'engines',
        currentValue: '1.2.0',
      },
    ];
    const res = getExtractedConstraints(deps);
    expect(res).toEqual({
      npm: '1.0.0',
    });
  });

  it('prioritizes packageManager version when volta pins not present', () => {
    const deps = [
      {
        depName: 'npm',
        depType: 'packageManager',
        currentValue: '1.1.0',
      },
      {
        depName: 'npm',
        depType: 'engines',
        currentValue: '1.2.0',
      },
    ];
    const res = getExtractedConstraints(deps);
    expect(res).toEqual({
      npm: '1.1.0',
    });
  });

  it('uses npm version from engines', () => {
    const deps = [
      {
        depName: 'npm',
        depType: 'engines',
        currentValue: '1.2.0',
      },
    ];
    const res = getExtractedConstraints(deps);
    expect(res).toEqual({
      npm: '1.2.0',
    });
  });
});

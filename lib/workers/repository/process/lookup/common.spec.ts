import { mergeConfigConstraints } from './common';
import type { LookupUpdateConfig } from './types';

describe('workers/repository/process/lookup/common', () => {
  it('overrides extracted config with user config', () => {
    const config: LookupUpdateConfig = {
      datasource: '',
      depName: '',
      versioning: '',
      rangeStrategy: 'pin',
    };
    config.constraints = {
      constraint1: 'configValue1',
      constraint2: 'configValue2',
      constraint3: 'configValue3',
    };
    config.extractedConstraints = {
      constraint3: 'extractedValue3',
      constraint4: 'exractedValue4',
    };
    expect(mergeConfigConstraints(config)).toMatchObject({
      datasource: '',
      depName: '',
      versioning: '',
      rangeStrategy: 'pin',
      constraints: {
        constraint1: 'configValue1',
        constraint2: 'configValue2',
        constraint3: 'configValue3',
        constraint4: 'exractedValue4',
      },
    });
  });

  it('sets config with extracted config', () => {
    const config: LookupUpdateConfig = {
      datasource: '',
      depName: '',
      versioning: '',
      rangeStrategy: 'pin',
    };
    config.extractedConstraints = {
      constraint3: 'extractedValue3',
      constraint4: 'exractedValue4',
    };
    expect(mergeConfigConstraints(config)).toMatchObject({
      datasource: '',
      depName: '',
      versioning: '',
      rangeStrategy: 'pin',
      constraints: {
        constraint3: 'extractedValue3',
        constraint4: 'exractedValue4',
      },
    });
  });
});

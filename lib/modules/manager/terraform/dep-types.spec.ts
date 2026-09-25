import { describe, expect, it } from 'vitest';
import { knownDepTypes } from './dep-types.ts';
import {
  generic_image_datasource,
  generic_image_resource,
} from './extractors/resources/utils.ts';

describe('modules/manager/terraform/dep-types', () => {
  it('registers every extractor depType in knownDepTypes', () => {
    const known = knownDepTypes.map((meta) => meta.depType);
    for (const def of [
      ...generic_image_resource,
      ...generic_image_datasource,
    ]) {
      expect(known).toContain(def.type);
    }
  });
});

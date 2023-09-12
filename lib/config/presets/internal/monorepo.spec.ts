import { presets } from './monorepo';

const todo = new Set([
  'arcus.background-jobs',
  'arcus.event-grid',
  'arcus.messaging',
  'arcus.observability',
  'arcus.security',
  'arcus.webapi',
  'aspnet aspnetwebstack',
  'aspnet extensions',
  'azure azure-libraries-for-net',
  'azure azure-sdk-for-net',
  'azure azure-storage-net',
  'Hangfire',
  'system.io.abstractions',
  'vaadinWebComponents',
]);

describe('config/presets/internal/monorepo', () => {
  it('presets should have right name', () => {
    for (const name of Object.keys(presets).filter((name) => !todo.has(name))) {
      expect(name).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

import { LanguageToCategoryMigration } from './language-to-category-migration';

describe('config/migrations/custom/language-to-category-migration', () => {
  it('should migrate single docker language tag', () => {
    expect(LanguageToCategoryMigration).toMigrate(
      {
        packageRules: [
          {
            matchLanguages: ['docker'],
            addLabels: ['docker'],
          },
        ],
      },
      {
        packageRules: [
          {
            matchManagers: [
              'ansible',
              'dockerfile',
              'docker-compose',
              'droneci',
              'kubernetes',
              'woodpecker',
            ],
            addLabels: ['docker'],
          },
        ],
      }
    );
  });

  it('should migrate mixed docker language tag to separate rules', () => {
    expect(LanguageToCategoryMigration).toMigrate(
      {
        packageRules: [
          {
            addLabels: ['docker'],
            matchLanguages: ['docker', 'python'],
          },
        ],
      },
      {
        packageRules: [
          {
            addLabels: ['docker'],
            matchCategories: ['python'],
          },
          {
            addLabels: ['docker'],
            matchManagers: [
              'ansible',
              'dockerfile',
              'docker-compose',
              'droneci',
              'kubernetes',
              'woodpecker',
            ],
          },
        ],
      }
    );
  });

  it('should migrate single match rule', () => {
    expect(LanguageToCategoryMigration).toMigrate(
      {
        packageRules: [
          {
            matchLanguages: ['python'],
            addLabels: ['py'],
          },
        ],
      },
      {
        packageRules: [
          {
            matchCategories: ['python'],
            addLabels: ['py'],
          },
        ],
      }
    );
  });
});

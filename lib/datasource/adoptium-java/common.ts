// Api page size limit 50
export const pageSize = 50;

export const defaultRegistryUrl = 'https://api.adoptium.net/';

export const datasource = 'adoptium-java';

export function getImageType(lookupName: string): string {
  switch (lookupName) {
    case 'java-jre':
      return 'jre';
    default:
      return 'jdk';
  }
}

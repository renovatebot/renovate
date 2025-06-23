// Api page size limit 50
export const pageSize = 50;

export const defaultRegistryUrl = 'https://api.adoptium.net/';

export const datasource = 'java-version';

export function getImageType(packageName: string): string {
  switch (packageName) {
    case 'java-jre':
      return 'jre';
    default:
      return 'jdk';
  }
}

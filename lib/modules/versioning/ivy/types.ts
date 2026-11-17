export interface Revision {
  type: 'REV_TYPE_LATEST' | 'REV_TYPE_RANGE' | 'REV_TYPE_SUBREVISION';

  value: string;
}

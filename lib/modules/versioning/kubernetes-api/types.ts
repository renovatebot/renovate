import type { GenericVersion } from '../generic';

export interface KubernetesApiVersion extends GenericVersion {
  /**
   * https://kubernetes.io/docs/reference/using-api/#api-groups
   */
  apiGroup?: string;
}

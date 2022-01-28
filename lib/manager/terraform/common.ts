// FIXME #12556
/* eslint-disable @typescript-eslint/naming-convention */

// eslint-disable-next-line typescript-enum/no-enum
export enum TerraformDependencyTypes {
  unknown = 'unknown',
  module = 'module',
  provider = 'provider',
  required_providers = 'required_providers',
  resource = 'resource',
  terraform_version = 'terraform_version',
}

// eslint-disable-next-line typescript-enum/no-enum
export enum TerraformResourceTypes {
  unknown = 'unknown',
  /**
   * https://www.terraform.io/docs/providers/docker/r/container.html
   */
  docker_container = 'docker_container',
  /**
   * https://www.terraform.io/docs/providers/docker/r/image.html
   */
  docker_image = 'docker_image',
  /**
   * https://www.terraform.io/docs/providers/docker/r/service.html
   */
  docker_service = 'docker_service',
  /**
   * https://www.terraform.io/docs/providers/helm/r/release.html
   */
  helm_release = 'helm_release',
}

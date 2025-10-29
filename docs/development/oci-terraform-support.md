# OCI Protocol Support for Terraform Modules and Providers

## Overview

This implementation adds support for the OCI (Open Container Initiative) protocol for Terraform modules and providers. Terraform supports pulling modules and providers from OCI-compatible registries using the `oci://` protocol prefix.

## Changes Made

### 1. Module Extraction (`lib/modules/manager/terraform/extractors/others/modules.ts`)

**Added:**

- `ociRefMatchRegex`: New regex pattern to detect OCI protocol sources
  - Pattern: `/^oci:\/\/(?<registry>[^/:]+)\/(?<repository>[^:]+?)(?::(?<tag>.+))?$/`
  - Captures the registry hostname, repository path, and optional tag/version
  - Supports both formats:
    - `oci://registry/repo` (version in separate field)
    - `oci://registry/repo:tag` (version in URL)

**Modified:**

- Imported `DockerDatasource` for handling OCI registry requests
- Updated `analyseTerraformModule()` method to detect and handle OCI sources
  - OCI sources are now configured to use the Docker datasource
  - Registry URLs are extracted and set appropriately
  - Package names follow the format: `registry/repository`
  - **Version handling**: If a tag is present in the source URL, it takes precedence over the separate `version` field

**Example Detection:**

```hcl
# Version in separate field
module "vpc" {
  source  = "oci://registry.example.com/terraform-modules/vpc"
  version = "1.2.3"
}

# Version embedded in source URL
module "storage" {
  source = "oci://docker.io/terraform-modules/storage:3.1.0"
}

# Digest in source URL
module "database" {
  source = "oci://registry.example.com/modules/db:sha256:abc123"
}
```

### 2. Provider Extraction (`lib/modules/manager/terraform/base.ts`)

**Added:**

- `ociRefMatchRegex` property to `TerraformProviderExtractor` class

**Modified:**

- Imported `DockerDatasource` for handling OCI provider sources
- Updated `analyzeTerraformProvider()` method to check for OCI protocol before standard parsing
  - OCI providers delegate to Docker datasource
  - Registry URLs extracted from the OCI source URL
  - Maintains compatibility with existing provider source formats

**Example Detection:**

```hcl
terraform {
  required_providers {
    custom = {
      source  = "oci://registry.example.com/providers/custom"
      version = "1.0.0"
    }
  }
}
```

### 3. Test Coverage

**Test Fixture (`lib/modules/manager/terraform/__fixtures__/oci.tf`):**

- Created comprehensive test file demonstrating OCI usage
- Includes both module and provider examples
- Uses various OCI registries (ghcr.io, docker.io, custom registries)

**Unit Tests (`lib/modules/manager/terraform/extractors/others/modules.spec.ts`):**

- Added `ociRefMatchRegex` test suite
- Tests various OCI URL formats:
  - Simple registry: `oci://registry.example.com/namespace/module`
  - GitHub Container Registry: `oci://ghcr.io/org/repo/module`
  - Docker Hub: `oci://docker.io/user/module`

**Integration Tests (`lib/modules/manager/terraform/extract.spec.ts`):**

- Added comprehensive test case for OCI module and provider extraction
- Validates correct datasource assignment (docker vs terraform-module/provider)
- Verifies registry URL extraction
- Tests mixed configuration (OCI + traditional sources)

## How It Works

### OCI Module Sources

1. **Detection**: The module extractor checks if the source starts with `oci://`
2. **Parsing**: Extracts registry hostname, repository path, and optional tag/version
3. **Datasource Assignment**: Uses Docker datasource instead of Terraform Module datasource
4. **Registry Configuration**: Sets `registryUrls` to the HTTPS version of the OCI registry
5. **Version Handling**:
   - If tag is in the source URL (`oci://registry/repo:1.2.3`), it becomes `currentValue`
   - If tag is NOT in the URL, the separate `version` field is used
   - Supports both semver tags and digest references

### OCI Provider Sources

1. **Detection**: Provider extractor checks for `oci://` prefix before standard source parsing
2. **Parsing**: Same pattern as modules - extracts registry, repository, and optional tag
3. **Datasource Assignment**: Uses Docker datasource for version lookups
4. **Version Handling**: Same as modules - tag in URL takes precedence over `version` field

## Datasource Delegation

When OCI protocol is detected:

- **Datasource**: `docker` (instead of `terraform-module` or `terraform-provider`)
- **Registry URLs**: Extracted from the OCI URL and converted to HTTPS
- **Package Name**: Full path including registry hostname
- **Version Resolution**: Handled by Docker datasource using OCI registry APIs

## Benefits

1. **Registry Flexibility**: Users can host Terraform modules/providers in any OCI-compatible registry
2. **Unified Tooling**: Leverage existing container registry infrastructure
3. **Access Control**: Use existing registry authentication and authorization
4. **Reuse Docker Datasource**: No need to implement OCI-specific logic; Docker datasource handles it

## Supported Registries

Any OCI-compatible container registry, including:

- GitHub Container Registry (ghcr.io)
- Docker Hub (docker.io)
- Google Container Registry (gcr.io)
- Amazon Elastic Container Registry (ECR)
- Azure Container Registry (azurecr.io)
- Private/self-hosted registries
- Harbor, Quay, Artifactory, etc.

## Example Configurations

### Module from GitHub Container Registry

```hcl
module "networking" {
  source  = "oci://ghcr.io/myorg/terraform-modules/networking"
  version = "2.0.0"
}
```

### Provider from Private Registry

```hcl
terraform {
  required_providers {
    internal = {
      source  = "oci://registry.company.com/providers/internal"
      version = "1.5.0"
    }
  }
}
```

### Mixed Configuration

```hcl
# OCI module
module "vpc" {
  source  = "oci://registry.example.com/modules/vpc"
  version = "1.0.0"
}

# Traditional module
module "consul" {
  source  = "hashicorp/consul/aws"
  version = "0.1.0"
}

terraform {
  required_providers {
    # OCI provider
    custom = {
      source  = "oci://ghcr.io/company/providers/custom"
      version = "2.0.0"
    }

    # Traditional provider
    aws = {
      source  = "hashicorp/aws"
      version = "5.0.0"
    }
  }
}
```

## Implementation Notes

### Regex Pattern Design

The OCI regex pattern is intentionally simple:

- Matches `oci://` prefix exactly
- Captures registry as the first path segment (hostname)
- Captures everything after as repository path
- Doesn't validate specific URL components (delegated to Docker datasource)

### Datasource Choice

Using Docker datasource for OCI sources:

- OCI is the standard for container registries
- Docker datasource already implements OCI registry protocol
- Reduces code duplication
- Terraform OCI modules/providers use the same registry APIs as container images

### Compatibility

- Fully backward compatible with existing Terraform configurations
- OCI support is additive - no changes to existing functionality
- Falls back to standard parsing if OCI pattern doesn't match

## Testing

Run the tests with:

```bash
npm test -- terraform
```

Specific test files:

```bash
npm test -- lib/modules/manager/terraform/extractors/others/modules.spec.ts
npm test -- lib/modules/manager/terraform/extract.spec.ts
```

## References

- [Terraform Module Sources](https://developer.hashicorp.com/terraform/language/modules/sources)
- [OCI Registry Specification](https://github.com/opencontainers/distribution-spec)
- [Terraform Registry Protocol](https://developer.hashicorp.com/terraform/internals/module-registry-protocol)

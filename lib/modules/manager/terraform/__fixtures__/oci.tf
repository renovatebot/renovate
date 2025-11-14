module "vpc_oci" {
  source  = "oci://registry.example.com/terraform-modules/vpc"
  version = "1.2.3"
}

module "networking_oci" {
  source  = "oci://ghcr.io/myorg/terraform-modules/networking"
  version = "2.0.0"
}

module "storage_oci_tagged" {
  source = "oci://docker.io/terraform-modules/storage:3.1.0"
}

module "database_oci_digest" {
  source = "oci://registry.example.com/terraform-modules/database:sha256:abc123"
}

module "traditional" {
  source  = "hashicorp/consul/aws"
  version = "0.1.0"
}

terraform {
  required_providers {
    custom_oci = {
      source  = "oci://registry.example.com/providers/custom"
      version = "1.0.0"
    }

    another_oci = {
      source  = "oci://ghcr.io/mycompany/providers/mycloud"
      version = "2.5.0"
    }

    tagged_oci = {
      source = "oci://registry.example.com/providers/tagged:4.2.0"
    }

    aws = {
      source  = "hashicorp/aws"
      version = "4.0.0"
    }
  }
}

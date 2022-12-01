# test exact without operator, equal with `=`
provider "azurerm" {
  version = "1.36.1"
}

provider "gitlab" {
  alias   = "main"
  version = "=2.4"
}

provider "gitlab1" {
  token = "${var.gitlab_token}"
  version = "=1.3"
}

provider "helm" {
  kubernetes {
    host     = "https://104.196.242.174"
    username = "ClusterMaster"
    password = "MindTheGap"

    client_certificate     = file("~/.kube/client-cert.pem")
    client_key             = file("~/.kube/client-key.pem")
    cluster_ca_certificate = file("~/.kube/cluster-ca-cert.pem")
  }
}

provider "newrelic" {
  version = "V1.9"

  api_key = "${var.newrelic_api_key}"
}

terraform {
  required_providers {
    aws = ">= 2.7.0"
  }
}

terraform {
  required_providers {
    azurerm = ">= 2.0.0"
  }
}

terraform {
  required_providers {
    docker = {
      source  = "terraform-providers/docker"
      version = "2.7.2"
    }
    aws = {
      source  = "aws"
      version = "2.7.0"
    }
    // falls back block name for source
    azurerm = {
      version = "=2.27.0"
    }
    invalid = {
      source  = "//hashicorp/helm"
      version = "1.2.4"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "1.2.4"
    }
    kubernetes = {
      source  = "terraform.example.com/hashicorp/kubernetes"
      version = ">= 1.0"
    }
    oci = {
      source  = "terraform-company_special.example.com/oracle/oci"
      version = ">= 4.0"
    }
  }
  required_version = ">= 0.13"
}

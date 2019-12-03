# test exact without operator, equal with `=`
provider "azurerm" {
  version = "1.36.1"
}

provider "gitlab" {
  alias = "main"
  version = "=2.4"
}

provider "gitlab" {
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

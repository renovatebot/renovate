# legit use cases
## complete example
resource "helm_release" "example" {
  name       = "my-redis-release"
  repository = "https://kubernetes-charts.storage.googleapis.com"
  chart      = "redis"
  version    = "1.0.1"
}

## example without version, this will default to latest in Terraform
resource "helm_release" "example" {
  name       = "my-redis-release"
  repository = "https://kubernetes-charts.storage.googleapis.com"
  chart      = "redis"
}

## local chart
resource "helm_release" "local" {
  name       = "my-local-chart"
  chart      = "./charts/example"
}

## malformed examples
resource "helm_release" "example" {
  name       = "my-redis-release"
  repository = "https://kubernetes-charts.storage.googleapis.com"
  version    = "4.0.1"
}

resource "helm_release" "example" {
  repository = "https://kubernetes-charts.storage.googleapis.com"
  chart      = "redis"
  version    = "5.0.1"
}

resource "helm_release" "example" {
  name       = "my-redis-release"
  chart      = "redis"
  version    = "6.0.1"
}

# legit use cases
## complete example
resource "helm_release" "redis" {
  name       = "my-redis-release"
  repository = "https://charts.helm.sh/stable"
  chart      = "redis"
  version    = "1.0.1"
}

## example without version, this will default to latest in Terraform
resource "helm_release" "redis_without_version" {
  name       = "my-redis-release"
  repository = "https://charts.helm.sh/stable"
  chart      = "redis"
}

## local chart
resource "helm_release" "local" {
  name       = "my-local-chart"
  chart      = "./charts/example"
}

## malformed examples
resource "helm_release" "invalid_1" {
  name       = "my-redis-release"
  repository = "https://charts.helm.sh/stable"
  version    = "4.0.1"
}

resource "helm_release" "invalid_2" {
  repository = "https://charts.helm.sh/stable"
  chart      = "redis"
  version    = "5.0.1"
}

resource "helm_release" "invalid_3" {
  name       = "my-redis-release"
  chart      = "redis"
  version    = "6.0.1"
}

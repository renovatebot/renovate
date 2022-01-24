# docker_image resources
# https://www.terraform.io/docs/providers/docker/r/image.html
resource "docker_image" "nginx" {
  name = "nginx:1.7.8"
}

resource "docker_image" "invalid" {
}

resource "docker_image" "ignore_variable" {
  name          = "${data.docker_registry_image.ubuntu.name}"
  pull_triggers = ["${data.docker_registry_image.ubuntu.sha256_digest}"]
}


# docker_container resources
# https://www.terraform.io/docs/providers/docker/r/container.html
resource "docker_container" "foo" {
  name  = "foo"
  image = "nginx:1.7.8"
}

resource "docker_container" "invalid" {
  name = "foo"
}


# docker_service resources
# https://www.terraform.io/docs/providers/docker/r/service.html
resource "docker_service" "foo" {
  name = "foo-service"

  task_spec {
    container_spec {
      image = "repo.mycompany.com:8080/foo-service:v1"
    }
  }

  endpoint_spec {
    ports {
      target_port = "8080"
    }
  }
}

resource "docker_service" "invalid" {
}

# unsupported resources
resource "not_supported_resource" "foo" {
  name  = "foo"
  image = "nginx:1.7.8"
  dummy = "true"
}

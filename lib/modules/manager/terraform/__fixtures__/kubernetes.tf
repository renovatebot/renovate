resource "kubernetes_cron_job_v1" "demo" {
  metadata {}
  spec {
    job_template {
      metadata {}
      spec {
        template {
          metadata {}
          spec {
            container {
              name    = "kaniko"
              image   = "gcr.io/kaniko-project/executor:v1.7.0@sha256:8504bde9a9a8c9c4e9a4fe659703d265697a36ff13607b7669a4caa4407baa52"
            }
            container {
              name    = "node"
              image   = "node:14"
            }
          }
        }
      }
    }
    schedule = ""
  }
}

resource "kubernetes_cron_job" "demo" {
  metadata {}
  spec {
    job_template {
      metadata {}
      spec {
        template {
          metadata {}
          spec {
            container {
              name    = "kaniko"
              image   = "gcr.io/kaniko-project/executor:v1.8.0@sha256:8504bde9a9a8c9c4e9a4fe659703d265697a36ff13607b7669a4caa4407baa52"
            }
          }
        }
      }
    }
    schedule = ""
  }
}

resource "kubernetes_daemon_set_v1" "example" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          image = "nginx:1.21.1"
          name  = "example1"
        }
      }
    }
  }
}

resource "kubernetes_daemonset" "example" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          image = "nginx:1.21.2"
          name  = "example2"
        }
      }
    }
  }
}

resource "kubernetes_deployment" "example" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          image = "nginx:1.21.3"
          name  = "example3"
        }
      }
    }
  }
}

resource "kubernetes_deployment_v1" "example" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          image = "nginx:1.21.4"
          name  = "example4"
        }
      }
    }
  }
}

resource "kubernetes_job" "demo" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          name    = "example5"
          image   = "nginx:1.21.5"
        }
      }
    }
  }
}

resource "kubernetes_job" "demo_invalid" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          name    = "example5-invalid"
        }
      }
    }
    image   = "nginx:1.21.6"
  }
}

resource "kubernetes_job_invalid" "demo_invalid2" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          name    = "example5"
          image   = "nginx:1.21.6"
        }
      }
    }
  }
}

resource "kubernetes_job_v1" "demo" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        container {
          name    = "example6"
          image   = "nginx:1.21.6"
        }
      }
    }
  }
}

resource "kubernetes_pod" "test" {
  metadata {}
  spec {
    container {
      image = "nginx:1.21.7"
      name  = "example7"
    }
  }
}

resource "kubernetes_pod_v1" "test" {
  metadata {}
  spec {
    container {
      image = "nginx:1.21.8"
      name  = "example8"
    }
  }
}

resource "kubernetes_replication_controller" "example" {
  metadata {}
  spec {
    selector = {}
    template {
      metadata {}
      spec {
        container {
          image = "nginx:1.21.9"
          name  = "example9"
        }
      }
    }
  }
}

resource "kubernetes_replication_controller_v1" "example" {
  metadata {}
  spec {
    selector = {}
    template {
      metadata {}
      spec {
        container {
          image = "nginx:1.21.10"
          name  = "example10"
        }
      }
    }
  }
}

resource "kubernetes_stateful_set" "prometheus" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        init_container {
          name              = "example11"
          image             = "nginx:1.21.11"
        }
        container {
          name              = "prometheus-server1"
          image             = "prom/prometheus:v2.2.1"
        }
      }
    }
    service_name = ""
    selector {}
  }
}

resource "kubernetes_stateful_set_v1" "prometheus" {
  metadata {}
  spec {
    template {
      metadata {}
      spec {
        init_container {
          name              = "example12"
          image             = "nginx:1.21.12"
        }

        container {
          name              = "prometheus-server2"
          image             = "prom/prometheus:v2.2.2"
        }
      }
    }
    service_name = ""
    selector {}
  }
}

terraform {
  required_providers {
    aws = {
      source  = "aws"
      version = "~> 3.0"
    }
    azurerm = {
      version = "~> 2.50.0"
    }
  }
}

variable "name" {
  description = "Name to be used on all resources as prefix"
  type        = string
}

variable "subnet_ids" {
  default     = []
  description = "A list of VPC Subnet IDs to create lambda in"
  type        = list(string)
}

variable "tags" {
  default     = {}
  description = "A map of tags to add to all resources"
  type        = map(string)
}

variable "vpc_security_group_ids" {
  description = "A list of security group IDs to associate with"
  type        = list(string)
  default     = null
}

variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

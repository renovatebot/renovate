raise "Ruby versions < 2.5.3 are unsupported!" if RUBY_VERSION < "2.5.3"
raise "Ruby versions >= 2.7.0 are unsupported!" if RUBY_VERSION >= "2.7.0"

source 'https://rubygems.org'

plugin "bundler-inject", "~> 1.1"
require File.join(Bundler::Plugin.index.load_paths("bundler-inject")[0], "bundler-inject") rescue nil

#
# VMDB specific gems
#

gem "manageiq-gems-pending", ">0", :require => 'manageiq-gems-pending', :git => "https://github.com/ManageIQ/manageiq-gems-pending.git", :branch => "master"

# Modified gems for gems-pending.  Setting sources here since they are git references
gem "handsoap", "~>0.2.5", :require => false, :git => "https://github.com/ManageIQ/handsoap.git", :tag => "v0.2.5-5"

# when using this Gemfile inside a providers Gemfile, the dependency for the provider is already declared
def manageiq_plugin(plugin_name)
  unless dependencies.detect { |d| d.name == plugin_name }
    gem plugin_name, :git => "https://github.com/ManageIQ/#{plugin_name}", :branch => "master"
  end
end

manageiq_plugin "manageiq-schema"

# Unmodified gems
gem "activerecord-virtual_attributes", "~>1.5.0"
gem "activerecord-session_store",     "~>1.1"
gem "acts_as_tree",                   "~>2.7" # acts_as_tree needs to be required so that it loads before ancestry
gem "ancestry",                       "~>3.0.7",       :require => false
gem "aws-sdk-s3",                     "~>1.0",         :require => false # For FileDepotS3
gem "bcrypt",                         "~> 3.1.10",     :require => false
gem "bundler",                        ">=1.15",        :require => false
gem "byebug",                                          :require => false
gem "color",                          "~>1.8"
gem "config",                         "~>2.0",         :require => false
gem "dalli",                          "=2.7.6",        :require => false
gem "default_value_for",              "~>3.3"
gem "docker-api",                     "~>1.33.6",      :require => false
gem "elif",                           "=0.1.0",        :require => false
gem "fast_gettext",                   "~>2.0.1"
gem "gettext_i18n_rails",             "~>1.7.2"
gem "gettext_i18n_rails_js",          "~>1.3.0"
gem "hamlit",                         "~>2.8.5"
gem "highline",                       "~>1.6.21",      :require => false
gem "inifile",                        "~>3.0",         :require => false
gem "inventory_refresh",              "~>0.2.0",       :require => false
gem "kubeclient",                     "~>4.0",         :require => false # For scaling pods at runtime
gem "linux_admin",                    "~>1.2.4",       :require => false
gem "log_decorator",                  "~>0.1",         :require => false
gem "manageiq-api-client",            "~>0.3.3",       :require => false
gem "manageiq-loggers",               "~>0.3.0",       :require => false
gem "manageiq-messaging",             "~>0.1.4",       :require => false
gem "manageiq-password",              "~>0.3",         :require => false
gem "manageiq-postgres_ha_admin",     "~>3.1",         :require => false
gem "memoist",                        "~>0.15.0",      :require => false
gem "mime-types",                     "~>3.0",         :path => File.expand_path("mime-types-redirector", __dir__)
gem "money",                          "~>6.13.5",      :require => false
gem "more_core_extensions",           "~>3.7"
gem "net-ldap",                       "~>0.16.1",      :require => false
gem "net-ping",                       "~>1.7.4",       :require => false
gem "openscap",                       "~>0.4.8",       :require => false
gem "optimist",                       "~>3.0",         :require => false
gem "pg",                                              :require => false
gem "pg-dsn_parser",                  "~>0.1.0",       :require => false
gem "query_relation",                 "~>0.1.0",       :require => false
gem "rails",                          "~>5.1.7"
gem "rails-i18n",                     "~>5.x"
gem "rake",                           ">=11.0",        :require => false
gem "rest-client",                    "~>2.0.0",       :require => false
gem "ripper_ruby_parser",             "~>1.5.1",       :require => false
gem "ruby-progressbar",               "~>1.7.0",       :require => false
gem "rubyzip",                        "~>1.3.0",       :require => false
gem "snmp",                           "~>1.2.0",       :require => false
gem "sprockets",                      "~>3.0",         :require => false
gem "sqlite3",                        "~>1.3.0",       :require => false
gem "sys-filesystem",                 "~>1.3.1"
gem "terminal",                                        :require => false

# Modified gems (forked on Github)
gem "rugged",                         "=0.28.2", :require => false,   :git => "https://github.com/ManageIQ/rugged.git", :tag => "v0.28.2-1", :submodules => true
gem "ruport",                         "=1.7.0",                       :git => "https://github.com/ManageIQ/ruport.git", :tag => "v1.7.0-3"

# In 1.9.3: Time.parse uses british version dd/mm/yyyy instead of american version mm/dd/yyyy
# american_date fixes this to be compatible with 1.8.7 until all callers can be converted to the 1.9.3 format prior to parsing.
# See miq_expression_spec Date/Time Support examples.
# https://github.com/jeremyevans/ruby-american_date
gem "american_date"

# Make sure to tag your new bundler group with the manageiq_default group in addition to your specific bundler group name.
# This default is used to automatically require all of our gems in processes that don't specify which bundler groups they want.
#
### providers
group :amazon, :manageiq_default do
  manageiq_plugin "manageiq-providers-amazon"
  gem "amazon_ssa_support",                          :require => false, :git => "https://github.com/ManageIQ/amazon_ssa_support.git", :branch => "master" # Temporary dependency to be moved to manageiq-providers-amazon when officially release
end

group :ansible_tower, :manageiq_default do
  manageiq_plugin "manageiq-providers-ansible_tower"
end

group :azure, :manageiq_default do
  manageiq_plugin "manageiq-providers-azure"
end

group :azure_stack, :manageiq_default do
  manageiq_plugin "manageiq-providers-azure_stack"
end

group :foreman, :manageiq_default do
  manageiq_plugin "manageiq-providers-foreman"
  gem "foreman_api_client",             ">=0.1.0",   :require => false, :git => "https://github.com/ManageIQ/foreman_api_client.git", :branch => "master"
end

group :google, :manageiq_default do
  manageiq_plugin "manageiq-providers-google"
end

group :kubernetes, :openshift, :manageiq_default do
  manageiq_plugin "manageiq-providers-kubernetes"
end

group :kubevirt, :manageiq_default do
  manageiq_plugin "manageiq-providers-kubevirt"
end

group :lenovo, :manageiq_default do
  manageiq_plugin "manageiq-providers-lenovo"
end

group :nuage, :manageiq_default do
  manageiq_plugin "manageiq-providers-nuage"
end

group :redfish, :manageiq_default do
  manageiq_plugin "manageiq-providers-redfish"
end

group :qpid_proton, :optional => true do
  gem "qpid_proton",                    "~>0.26.0",      :require => false
end

group :systemd, :optional => true do
  gem "dbus-systemd",    "~>1.1.0", :require => false
  gem "systemd-journal", "~>1.4.0", :require => false
end

group :openshift, :manageiq_default do
  manageiq_plugin "manageiq-providers-openshift"
end

group :openstack, :manageiq_default do
  manageiq_plugin "manageiq-providers-openstack"
end

group :ovirt, :manageiq_default do
  manageiq_plugin "manageiq-providers-ovirt"
  gem "ovirt_metrics",                  "~>3.0.1",       :require => false
end

group :scvmm, :manageiq_default do
  manageiq_plugin "manageiq-providers-scvmm"
end

group :vmware, :manageiq_default do
  manageiq_plugin "manageiq-providers-vmware"
  gem "vmware_web_service",             "~>0.4.0"
end

### shared dependencies
group :google, :openshift, :manageiq_default do
  gem "sshkey",                         "~>1.8.0",       :require => false
end

### end of provider bundler groups

group :automate, :seed, :manageiq_default do
  manageiq_plugin "manageiq-automation_engine"
end

group :replication, :manageiq_default do
  gem "pg-logical_replication", "~>1.0", :require => false
end

group :rest_api, :manageiq_default do
  manageiq_plugin "manageiq-api"
end

group :graphql_api do
  # Note, you still need to mount the engine in the UI / rest api processes:
  # mount ManageIQ::GraphQL::Engine, :at => '/graphql'
  manageiq_plugin "manageiq-graphql"
end

group :scheduler, :manageiq_default do
  gem "rufus-scheduler"
end
# rufus has et-orbi dependency, v1.2.2 has patch for ConvertTimeToEoTime that we need
gem "et-orbi",                          ">= 1.2.2"

group :seed, :manageiq_default do
  manageiq_plugin "manageiq-content"
end

group :smartstate, :manageiq_default do
  gem "manageiq-smartstate",            "~>0.3.1",       :require => false
end

group :consumption, :manageiq_default do
  manageiq_plugin "manageiq-consumption"
end

group :ui_dependencies do # Added to Bundler.require in config/application.rb
  manageiq_plugin "manageiq-decorators"
  manageiq_plugin "manageiq-ui-classic"
  # Modified gems (forked on Github)
  gem "jquery-rjs",                   "=0.1.1",                       :git => "https://github.com/ManageIQ/jquery-rjs.git", :tag => "v0.1.1-1"
end

group :v2v, :ui_dependencies do
  manageiq_plugin "manageiq-v2v"
end

group :web_server, :manageiq_default do
  gem "puma",                           "~>4.2"
  gem "responders",                     "~>2.0"
  gem "ruby-dbus" # For external auth
  gem "secure_headers",                 "~>3.0.0"
end

group :web_socket, :manageiq_default do
  gem "surro-gate",                     "~>1.0.5", :require => false
  gem "websocket-driver",               "~>0.6.3", :require => false
end

### Start of gems excluded from the appliances.
# The gems listed below do not need to be packaged until we find it necessary or useful.
# Only add gems here that we do not need on an appliance.
#
unless ENV["APPLIANCE"]
  group :development do
    gem "foreman"
    gem "PoParser"
    gem "rubocop-performance", "~>1.3",    :require => false
    # ruby_parser is required for i18n string extraction
    gem "ruby_parser",                     :require => false
    gem "yard"
  end

  group :test do
    gem "brakeman",         "~>3.3",    :require => false
    gem "capybara",         "~>2.5.0",  :require => false
    gem "coveralls",                    :require => false
    gem "factory_bot",      "~>5.1",    :require => false

    # TODO: faker is used for url generation in git repository factory and the lenovo
    # provider, via a xclarity_client dependency
    gem "faker",            "~>1.8",    :require => false
    gem "timecop",          "~>0.9",    :require => false
    gem "vcr",              "~>5.0",    :require => false
    gem "webmock",          "~>3.7",    :require => false
  end

  group :development, :test do
    gem "parallel_tests"
    gem "rspec-rails", "~>3.9.0"
  end
end

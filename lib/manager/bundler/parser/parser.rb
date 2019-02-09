require 'bundler'

require_relative 'lib/dsl'
require_relative 'lib/gemfile'
require_relative 'lib/dependency'

require_relative 'lib/gemfile/runner'
require_relative 'lib/gemfile/result'

require_relative 'lib/lockfile/runner'
require_relative 'lib/lockfile/result'

module Parser
end

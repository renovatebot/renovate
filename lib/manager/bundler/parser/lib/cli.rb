require 'json'

require_relative '../parser'

module Parser
  class CLI
    def initialize(argv)
      @options = parse_argv(argv)
    end

    def run
      result = {}

      result.merge!(gemfile_data) if parse_gemfile?
      result.merge!(lockfile_data) if parse_lockfile?

      puts JSON.pretty_generate(result)
    end

    private

    attr_reader :options

    def parse_gemfile?
      options.key?(:gemfile)
    end

    def parse_lockfile?
      options.key?(:lockfile)
    end

    def gemfile_data
      ENV['BUNDLE_GEMFILE'] ||= options.fetch(:gemfile)

      runner = Gemfile::Runner.new(gemfile: gemfile)
      result = runner.call

      result.to_h
    end

    def lockfile_data
      ENV['BUNDLE_GEMFILE'] ||= options.fetch(:lockfile).gsub('.lock').to_s

      runner = Lockfile::Runner.new(lockfile: lockfile)
      result = runner.call

      result.to_h
    end

    def gemfile
      @gemfile ||= File.expand_path(options[:gemfile])
    end

    def lockfile
      @lockfile ||= File.expand_path(options[:lockfile])
    end

    def parse_argv(argv)
      argv.each_with_object({}) do |arg, accumulator|
        name, value = arg.split('=')
        next if name.nil? || value.nil?

        accumulator[name.gsub('--', '').to_sym] = value
      end
    end
  end
end

(def clj-stacktrace-version "0.2.4")
;; This is an annotated reference of the options that may be set in a
;; project.clj file. It is fairly contrived in order to cover lots of
;; different options; it shouldn't be considered a representative
;; configuration. For a more detailed explanation of some of the terms
;; run `lein help tutorial`.

;; These options apply to Leiningen 2.x. See the 1.x branch for older versions:
;; https://github.com/technomancy/leiningen/blob/1.x/sample.project.clj

;; The project is named "sample", and its group-id is "org.example".
(defproject org.example/sample "1.0.0-SNAPSHOT" ; version "1.0.0-SNAPSHOT"
  ;; Beyond this point you may prepend a form with unquote, or ~, to eval it.

;;; Project Metadata
  ;; The description text is searchable from repositories like Clojars.
  :description "A sample project"
  :url "http://example.org/sample-clojure-project"
  ;; The mailing list of the project. If the project has multiple mailing
  ;; lists, use the :mailing-lists key (bound to a seq of mailing list
  ;; descriptions as below).
  :mailing-list {:name "sample mailing list"
                 :archive "http://example.org/sample-mailing-list-archives"
                 :other-archives ["http://example.org/sample-list-archive2"
                                  "http://example.org/sample-list-archive3"]
                 :post "list@example.org"
                 :subscribe "list-subscribe@example.org"
                 :unsubscribe "list-unsubscribe@example.org"}
  ;; The project's license. :distribution should be :repo or :manual;
  ;; :repo means it is OK for public repositories to host this project's
  ;; artifacts. A seq of :licenses is also supported.
  :license {:name "Eclipse Public License - v 1.0"
            :url "http://www.eclipse.org/legal/epl-v10.html"
            :distribution :repo
            :comments "same as Clojure"}
  ;; Warns users of earlier versions of Leiningen. Set this if your project
  ;; relies on features only found in newer Leiningen versions.
  :min-lein-version "2.0.0"

  ;; You can require a specific version of Leiningen. In case of mismatch
  ;; execution will abort. When versions are compared, suffixes such as
  ;; "-SNAPSHOT" are dropped.
  ;; :exact-lein-version "2.8.2"

;;; Dependencies, Plugins, and Repositories
  ;; Dependencies are listed as [group-id/name version]; in addition
  ;; to keywords supported by Pomegranate, you can use :native-prefix
  ;; to specify a prefix. This prefix is used to extract natives in
  ;; jars that don't adhere to the default "<os>/<arch>/" layout that
  ;; Leiningen expects.
  ;; You can also strings like ["group-id/name" version] for instances
  ;; where the dependency name isn't a valid symbol literal.
  :dependencies [[org.clojure/clojure,"1.3.0"]
                 #_[org.clojure/clojure "9.9.9"]
                 [org.jclouds/jclouds "1.0" :classifier "jdk15"]
                 [net.sf.ehcache/ehcache "2.3.1" :extension "pom"]
                 [log4j "1.2.15" :exclusions [[javax.mail/mail :extension "jar"]
                                              [javax.jms/jms :classifier "*"]
                                              com.sun.jdmk/jmxtools
                                              com.sun.jmx/jmxri]]
                 ["net.3scale/3scale-api" "3.0.2"]
                 [org.lwjgl.lwjgl/lwjgl "2.8.5"]
                 #_[org.lwjgl.lwjgl/lwjgl "0.0.0"]
                 [org.lwjgl.lwjgl/lwjgl-platform "2.8.5"
                  :classifier "natives-osx"
                  ;; LWJGL stores natives in the root of the jar; this
                  ;; :native-prefix will extract them.
                  :native-prefix ""]]
  ;; "Managed Dependencies" are a concept borrowed from maven pom files; see
  ;;  https://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html#Dependency_Management
  ;; Managed dependencies allow you to specify a desired version number for a dependency
  ;;  *if* the dependency exists (often transitively), but a managed dependency
  ;;  will not actually cause the described artifact to be a dependency on its own.
  ;; This feature is most useful in combination with some other mechanism for
  ;;  defining a "parent project"; e.g. you can have a "parent project" that specifies
  ;;  managed dependencies for common libraries that you use frequently in your other
  ;;  projects, and then the downstream/child projects can specify a normal dependency on
  ;;  those libraries *without specifying a version number*, and thus will inherit
  ;;  the version number from the parent.  This provides a simpler means of keeping
  ;;  common dependency versions in sync across a large number of clojure libraries.
  ;; For more info see ./doc/MANAGED_DEPS.md and https://github.com/achin/lein-parent
  :managed-dependencies [[clj-time "0.12.0"]
                         [me.raynes/fs "1.4.6"]]

  ;; What to do in the case of version conflicts. Defaults to :ranges, which
  ;; warns when version ranges are present anywhere in the dependency tree,
  ;; but can be set to true to warn for both ranges and overrides, or :abort
  ;; to exit in the case of ranges or overrides. Setting this to :warn or
  ;; :abort will also warn you when plugins or their dependencies
  ;; conflict with libraries used by Leiningen itself.
  :pedantic? :abort
  ;; Global exclusions are applied across the board, as an alternative
  ;; to duplication for multiple dependencies with the same excluded libraries.
  :exclusions [org.apache.poi/poi
               org.apache.poi/poi-ooxml]
  ;; Plugins are code that runs in Leiningen itself and usually
  ;; provide new tasks or hooks.
  :plugins [[lein-pprint "1.1.1"]
            [lein-assoc "0.1.0"]
            [s3-wagon-private "1.1.1"]
            [lein-foo "0.0.1" :hooks false]
            [lein-bar "0.0.1" :middleware false]]
  ;; These repositories will be searched for :dependencies and
  ;; :plugins and will also be available to deploy to.
  ;; Add ^:replace (:repositories ^:replace [...]) to only use repositories you
  ;; list below.
  :repositories [["java.net" "https://download.java.net/maven/2"]
                 ["sonatype" {:url "https://oss.sonatype.org/content/repositories/releases"
                              ;; If a repository contains releases only setting
                              ;; :snapshots to false will speed up dependencies.
                              :snapshots false
                              ;; Disable signing releases deployed to this repo.
                              ;; (Not recommended.)
                              :sign-releases false
                              ;; You can also set the policies for how to handle
                              ;; :checksum failures to :fail, :warn, or :ignore.
                              :checksum :fail
                              ;; How often should this repository be checked for
                              ;; snapshot updates? (:daily, :always, or :never)
                              :update :always
                              ;; You can also apply them to releases only:
                              :releases {:checksum :fail :update :always}}]
                 ;; Repositories named "snapshots" and "releases" automatically
                 ;; have their :snapshots and :releases disabled as appropriate.
                 ;; Credentials for repositories should *not* be stored
                 ;; in project.clj but in ~/.lein/credentials.clj.gpg instead,
                 ;; see `lein help deploying` under "Authentication".
                 ["snapshots" "https://blueant.com/archiva/snapshots"]
                 ["releases" {:url "https://blueant.com/archiva/internal"
                              ;; Using :env as a value here will cause an
                              ;; environment variable to be used based on
                              ;; the key; in this case LEIN_PASSWORD.
                              :username "milgrim" :password :env}]]
  ;; These repositories will be included with :repositories when loading plugins.
  ;; This would normally be set in a profile for non-public repositories.
  ;; All the options are the same as in the :repositories map.
  :plugin-repositories [["internal-plugin-repo" "http://example.org/repo"]]
  ;; Fetch dependencies from mirrors. Mirrors override repositories when the key
  ;; in the :mirrors map matches either the name or URL of a specified
  ;; repository. All settings supported in :repositories may be set here too.
  ;; The :name should match the name of the mirrored repository.
  :mirrors {"central" {:name "central"
                       :url "http://mirrors.ibiblio.org/pub/mirrors/maven2"}
            #"clojars" {:name "Internal nexus"
                        :url "http://mvn.local/nexus/releases"
                        :repo-manager true}}
  ;; Override location of the local maven repository. Relative to project root.
  :local-repo "local-m2"
  ;; You can set :update and :checksum policies here to have them
  ;; apply for all :repositories. Usually you will not set :update
  ;; directly but apply the "update" profile instead.
  :update :always
  :checksum :fail
  ;; Prevent Leiningen from checking the network for dependencies.
  ;; This wouldn't normally be set in project.clj; it would come from a profile.
  :offline? true
  ;; the deploy task will give preference to repositories specified in
  ;; :deploy-repositories, and repos listed there will not be used for
  ;; dependency resolution.
  :deploy-repositories [["releases" {:url "http://blueant.com/archiva/internal/releases"
                                     ;; Select a GPG private key to use for
                                     ;; signing. (See "How to specify a user
                                     ;; ID" in GPG's manual.) GPG will
                                     ;; otherwise pick the first private key
                                     ;; it finds in your keyring.
                                     ;; Currently only works in :deploy-repositories
                                     ;; or as a top-level (global) setting.
                                     :signing {:gpg-key "0xAB123456"}}]
                        ["snapshots" "http://blueant.com/archiva/internal/snapshots"]]
  ;; Defaults for signing options. Defers to per-repository settings.
  :signing {:gpg-key "root@eruditorum.org"}
  ;; If you configure a custom repository with a self-signed SSL
  ;; certificate, you will need to add it here. Paths should either
  ;; be on Leiningen's classpath or relative to the project root.
  :certificates ["blueant.pem"]

;;; Profiles
  ;; Each active profile gets merged into the project map. The :dev
  ;; and :user profiles are active by default, but the latter should be
  ;; looked up in ~/.lein/profiles.clj rather than set in project.clj.
  ;; Use the with-profiles higher-order task to run a task with a
  ;; different set of active profiles.
  ;; See `lein help profiles` for a detailed explanation.
  :profiles {:debug {:debug true
                     :injections [(prn (into {} (System/getProperties)))]}
             :1.4 {:dependencies [[org.clojure/clojure "1.4.0"]]}
             :1.5 {:dependencies [[org.clojure/clojure "1.5.0"]]}
             ;; activated by default
             :dev {:resource-paths ["dummy-data"]
                   :dependencies [[clj-stacktrace ~clj-stacktrace-version]]}
             ;; activated automatically during uberjar
             :uberjar {:aot :all}
             ;; activated automatically in repl task
             :repl {:plugins [[cider/cider-nrepl "0.7.1"]]}}
  ;; Load these namespaces from within Leiningen to pick up hooks from them.
  :hooks [leiningen.hooks.difftest]
  ;; Apply these middleware functions from plugins to your project
  ;; when it loads. Both hooks and middleware can be loaded implicitly
  ;; or by being listed here.
  :middleware [lein-xml.plugin/middleware]
  ;; These settings disable the implicit loading of middleware and
  ;; hooks, respectively. You can disable both with :implicits false.
  :implicit-middleware false
  :implicit-hooks false

;;; Entry Point
  ;; The -main function in this namespace will be run at launch
  ;; (either via `lein run` or from an uberjar). It should be variadic:
  ;;
  ;; (ns my.service.runner
  ;;   (:gen-class))
  ;;
  ;; (defn -main
  ;;   "Application entry point"
  ;;   [& args]
  ;;   (comment Do app initialization here))
  ;;
  ;; This will be AOT compiled by default; to disable this, attach ^:skip-aot
  ;; metadata to the namespace symbol. ^:skip-aot will not disable AOT
  ;; compilation of :main when :aot is :all or contains the main class. It's
  ;; best to be explicit with the :aot key rather than relying on
  ;; auto-compilation of :main. Setting :main to nil is useful when a
  ;; project contains several main functions. nil will produce a jar
  ;; with manifest.mf that lacks `Main-Class' property.
  :main my.service.runner
  ;; Support project-specific task aliases. These are interpreted in
  ;; the same way as command-line arguments to the lein command. If
  ;; the alias points to a vector, it uses partial application. For
  ;; example, "lein with-magic run -m hi.core" would be equivalent to
  ;; "lein assoc :magic true run -m hi.core". Remember, commas are not
  ;; considered to be special by argument parsers, they're just part
  ;; of the preceding argument.
  :aliases {"launch" ["run" "-m" "myproject.main"]
            ;; Values from the project map can be spliced into the arguments
            ;; using :project/key keywords.
            "launch-version" ["run" "-m" "myproject.main" :project/version]
            "dumbrepl" ["trampoline" "run" "-m" "clojure.main/main"]
            ;; :pass-through-help ensures `lein my-alias help` is not converted
            ;; into `lein help my-alias`.
            "go" ^:pass-through-help ["run" "-m"]
            ;; For complex aliases, a docstring may be attached. The docstring
            ;; will be printed instead of the expansion when running `lein help`.
            "deploy!" ^{:doc "Recompile sources, then deploy if tests succeed."}
            ;; Nested vectors are supported for the "do" task
            ["do" "clean" ["test" ":integration"] ["deploy" "clojars"]]}

;;; Custom Release Tasks
  ;; By default `lein release` performs a series of tasks typical of the release
  ;; process for many Leiningen-managed projects. These tasks can be overridden
  ;; using `:release-tasks` as follows:
  :release-tasks [["vcs" "assert-committed"]
                  ["change" "version"
                   "leiningen.release/bump-version" "release"]
                  ["vcs" "commit"]
                  ["vcs" "tag"]
                  ["deploy"]]
  ;; This differs from the default `:release-tasks` behavior in that it doesn't
  ;; go on to perform another `change version` or `vcs` task, instead leaving
  ;; that up to the developer to do manually.

;;; Running Project Code
  ;; Normally Leiningen runs the javac and compile tasks before
  ;; calling any eval-in-project code, but you can override this with
  ;; the :prep-tasks key to do other things like compile protocol buffers.
  :prep-tasks [["protobuf" "compile"] "javac" "compile"]
  ;; These namespaces will be AOT-compiled. Needed for gen-class and
  ;; other Java interop functionality. Put a regex here to compile all
  ;; namespaces whose names match. If you only need AOT for an uberjar
  ;; gen-class, put `:aot :all` in the :uberjar profile and see :target-path for
  ;; how to enable profile-based target isolation.
  :aot [org.example.sample]
  ;; Forms to prepend to every form that is evaluated inside your project.
  ;; Allows working around the Gilardi Scenario: http://technomancy.us/143
  ;; Note: This code is not executed in jars or uberjars.
  :injections [(require 'clojure.pprint)]
  ;; Java agents can instrument and intercept certain VM features. Include
  ;; :bootclasspath true to place the agent jar on the bootstrap classpath.
  :java-agents [[nodisassemble "0.1.1" :options "extra"]]
  ;; Options to pass to java compiler for java source,
  ;; exactly the same as command line arguments to javac.
  :javac-options ["-target" "1.6" "-source" "1.6" "-Xlint:-options"]
  ;; Emit warnings on all reflection calls. - DEPRECATED (see below)
  :warn-on-reflection true
  ;; Sets the values of global vars within Clojure. This example
  ;; disables all pre- and post-conditions and emits warnings on
  ;; reflective calls. See the Clojure documentation for the list of
  ;; valid global variables to set (and their meaningful values).
  :global-vars {*warn-on-reflection* true
                *assert* false}
  ;; Use a different `java` executable for project JVMs. Leiningen's own JVM is
  ;; set with the LEIN_JAVA_CMD environment variable.
  :java-cmd "/home/phil/bin/java1.7"
  ;; You can set JVM-level options here. The :java-opts key is an alias for this.
  :jvm-opts ["-Xmx1g"]
  ;; Set the context in which your project code is evaluated. Defaults
  ;; to :subprocess, but can also be :leiningen (for plugins) or :nrepl
  ;; to connect to an existing project process over nREPL. A project nREPL
  ;; server can be started simply by invoking `lein repl`. If no connection
  ;; can be established, :nrepl falls back to :subprocess.
  :eval-in :leiningen
  ;; Enable bootclasspath optimization. This improves boot time but interferes
  ;; with certain libraries like Jetty that make assumptions about classloaders.
  :bootclasspath true

;;; Filesystem Paths
  ;; If you'd rather use a different directory structure, you can set these.
  ;; Paths that contain "inputs" are string vectors, "outputs" are strings.
  :source-paths ["src" "src/main/clojure"]
  :java-source-paths ["src/main/java"]  ; Java source is stored separately.
  :test-paths ["test" "src/test/clojure"]
  :resource-paths ["src/main/resource"] ; Non-code files included in classpath/jar.
  ;; All generated files will be placed in :target-path. In order to avoid
  ;; cross-profile contamination (for instance, uberjar classes interfering
  ;; with development), it's recommended to include %s in in your custom
  ;; :target-path, which will splice in names of the currently active profiles.
  :target-path "target/%s/"
  ;; Directory in which to place AOT-compiled files. Including %s will
  ;; splice the :target-path into this value.
  :compile-path "%s/classy-files"
  ;; Directory in which to extract native components from inside dependencies.
  ;; Including %s will splice the :target-path into this value. Note that this
  ;; is not where to *look* for existing native libraries; use :jvm-opts with
  ;; -Djava.library.path=... instead for that.
  :native-path "%s/bits-n-stuff"
  ;; Directories under which `lein clean` removes files.
  ;; Specified by keyword or keyword-chain to get-in path in this defproject.
  ;; Both a single path and a collection of paths are accepted as each.
  ;; For example, if the other parts of project are like:
  ;;   :target-path "target"
  ;;   :compile-path "classes"
  ;;   :foobar-paths ["foo" "bar"]
  ;;   :baz-config {:qux-path "qux"}
  ;; :clean-targets below lets `lein clean` remove files under "target",
  ;; "classes", "foo", "bar", "qux", and "out".
  ;; By default, will protect paths outside the project root and within standard
  ;; lein source directories ("src", "test", "resources", "doc", "project.clj").
  ;; However, this protection can be overridden with metadata on the :clean-targets
  ;; vector - ^{:protect false}
  :clean-targets [:target-path :compile-path :foobar-paths
                  [:baz-config :qux-path] "out"]
  ;; Workaround for http://dev.clojure.org/jira/browse/CLJ-322 by deleting
  ;; compilation artifacts for namespaces that come from dependencies.
  :clean-non-project-classes true
  ;; Paths to include on the classpath from each project in the
  ;; checkouts/ directory. (See the tutorial for more details about
  ;; checkout dependencies.) Set this to be a vector of functions that
  ;; take the target project as argument. Defaults to [:source-paths
  ;; :compile-path :resource-paths], but you could use the following
  ;; to share code from the test suite:
  :checkout-deps-shares [:source-paths :test-paths
                         ~(fn [p] (str (:root p) "/lib/dev/*"))]

;;; Testing
  ;; Predicates to determine whether to run a test or not, take test metadata
  ;; as argument. See `lein help test` for more information.
  :test-selectors {:default (fn [m] (not (or (:integration m) (:regression m))))
                   :integration :integration
                   :regression :regression}
  ;; In order to support the `retest` task, Leiningen must monkeypatch the
  ;; clojure.test library. This disables that feature and breaks `lein retest`.
  :monkeypatch-clojure-test false

;;; Repl
  ;; Options to change the way the REPL behaves.
  :repl-options {;; Specify the string to print when prompting for input.
                 ;; defaults to something like (fn [ns] (str *ns* "=> "))
                 :prompt (fn [ns] (str "your command for <" ns ">? "))
                 ;; What to print when the repl session starts.
                 :welcome (println "Welcome to the magical world of the repl!")
                 ;; Specify the ns to start the REPL in (overrides :main in
                 ;; this case only)
                 :init-ns foo.bar
                 ;; This expression will run when first opening a REPL, in the
                 ;; namespace from :init-ns or :main if specified.
                 :init (println "here we are in" *ns*)
                 ;; Print stack traces on exceptions (highly recommended, but
                 ;; currently overwrites *1, *2, etc).
                 :caught clj-stacktrace.repl/pst+
                 ;; Skip's the default requires and printed help message.
                 :skip-default-init false
                 ;; Customize the socket the repl task listens on and
                 ;; attaches to.
                 :host "0.0.0.0"
                 :port 4001
                 ;; If nREPL takes too long to load it may timeout,
                 ;; increase this to wait longer before timing out.
                 ;; Defaults to 30000 (30 seconds)
                 :timeout 40000
                 ;; nREPL server customization
                 ;; Only one of #{:nrepl-handler :nrepl-middleware}
                 ;; may be used at a time.
                 ;; Use a different server-side nREPL handler.
                 :nrepl-handler (nrepl.server/default-handler)
                 ;; Add server-side middleware to nREPL stack.
                 :nrepl-middleware [my.nrepl.thing/wrap-amazingness
                                    ;; Middleware without appropriate metadata
                                    ;; (see nrepl.middleware/set-descriptor!
                                    ;; for details) will simply be appended to the stack
                                    ;; of middleware (rather than ordered based on its
                                    ;; expectations and requirements).
                                    (fn [handler]
                                      (fn [& args]
                                        (prn :middle args)
                                        (apply handler args)))]}

;;; Jar Output
  ;; Name of the jar file produced. Will be placed inside :target-path.
  ;; Including %s will splice the project version into the filename.
  :jar-name "sample.jar"
  ;; As above, but for uberjar.
  :uberjar-name "sample-standalone.jar"
  ;; Leave the contents of :source-paths out of jars (for AOT projects).
  :omit-source true
  ;; Files with names matching any of these patterns will be excluded from jars.
  :jar-exclusions [#"(?:^|/).svn/"]
  ;; Files with names matching any of these patterns will included in the jar
  ;; even if they'd be skipped otherwise.
  :jar-inclusions [#"^\.ebextensions"]
  ;; Same as :jar-exclusions, but for uberjars.
  :uberjar-exclusions [#"META-INF/DUMMY.SF"]
  ;; By default Leiningen will run a clean before creating jars to prevent
  ;; undeclared AOT from leaking to downstream consumers; this disables
  ;; that behaviour.
  :auto-clean false
  ;; Files to merge programmatically in uberjars when multiple same-named files
  ;; exist across project and dependencies.  Should be a map of filename strings
  ;; or regular expressions to a sequence of three functions:
  ;; 1. Takes an input stream; returns a parsed datum.
  ;; 2. Takes a new datum and the current result datum; returns a merged datum.
  ;; 3. Takes an output stream and a datum; writes the datum to the stream.
  ;; Resolved in reverse dependency order, starting with project.
  :uberjar-merge-with {#"\.properties$" [slurp str spit]}
  ;; Add arbitrary jar entries. Supports :path, :paths, :bytes, and :fn types.
  :filespecs [{:type :path :path "config/base.clj"}
              ;; Directory paths are included recursively.
              {:type :paths :paths ["config/web" "config/cli"]}
              ;; Programmatically-generated content can use :bytes.
              {:type :bytes :path "project.clj"
               ;; Strings or byte arrays are accepted.
               :bytes ~(slurp "project.clj")}
              ;; :fn filespecs take the project as an argument and
              ;; should return a filespec map of one of the other types.
              {:type :fn :fn (fn [p]
                               {:type :bytes :path "git-log"
                                :bytes (:out (clojure.java.shell/sh
                                              "git" "log" "-n" "1"))})}]
  ;; Set arbitrary key/value pairs for the jar's manifest. Any
  ;; vector or sequence of pairs is supported as well.
  :manifest {"Project-awesome-level" "super-great"
             ;; Function values will be called with the project as an argument.
             "Class-Path" ~#(clojure.string/join
                             \space
                             (leiningen.core.classpath/get-classpath %))
             ;; If a value is a collection, a manifest section is built for it and
             ;; the name of the key is used as the section name.
             :my-section-1 [["MyKey1" "MyValue1"] ["MyKey2" "MyValue2"]]
             :my-section-2 {"MyKey3" "MyValue3" "MyKey4" "MyValue4"}
             ;; Symbol values will be resolved to find a function to call.
             "Grunge-level" my.plugin/calculate-grunginess}

;;; Pom Output
  ;; Where the pom.xml is written. If not set, the project root.
  :pom-location "target/"
  ;; Set parent for working within a multi-module maven project.
  :parent [org.example/parent "0.0.1" :relative-path "../parent/pom.xml"]
  ;; Extensions here will be propagated to the pom but not used by Leiningen.
  :extensions [[org.apache.maven.wagon/wagon-webdav "1.0-beta-2"]
               [foo/bar-baz "1.0"]]
  ;; Plugins here will be propagated to the pom but not used by Leiningen.
  :pom-plugins [[com.theoryinpractise/clojure-maven-plugin "1.3.13"
                 ;; this section is optional, values have the same syntax as pom-addition
                 {:configuration [:sourceDirectories [:sourceDirectory "src"]]
                  :extensions "true"
                  :executions ([:execution [:id "echodir"]
                                [:goals ([:goal "run"])]
                                [:phase "verify"]])}]
                [org.apache.tomcat.maven/tomcat7-maven-plugin "2.1"]
                [com.google.appengine/appengine-maven-plugin "1.9.68"
                 ;; Use a list to pass any structure unaltered
                 (:configuration
                  [:project "foo"]
                  [:version "bar"])]]
  ;; Include <scm> tag in generated pom.xml file. All key/value pairs
  ;; appear exactly as configured. If absent, Leiningen will try to
  ;; use information from a .git directory.
  :scm {:name "git"
        :tag "098afd745bcd"
        :url "http://127.0.0.1/git/my-project"
        ;; Allows you to use a repository in a different directory than the
        ;; project's root, for instance, if you had multiple projects in a
        ;; single git repository.
        :dir ".."}
  ;; Include xml in generated pom.xml file, as parsed by
  ;; clojure.data.xml/sexp-as-element. Resulting pom still needs to
  ;; validate according to the pom XML schema.
  :pom-addition [:developers [:developer {:id "benbit"}
                              [:name "Ben Bitdiddle"]
                              [:url "http://www.example.com/benjamin"]]]

;;; Safety flags
  ;; Indicate whether or not `lein install` should abort when trying to install
  ;; releases. When false, trying to run `lein install` in a project with a version
  ;; that isn't a snapshot will cause Leiningen to abort with a descriptive error
  ;; message.
  :install-releases? false
  ;; Dictate which git branches deploys should be allowed from. When set,
  ;; `lein deploy` will only work from the git branches included and will
  ;; abort otherwise.
  :deploy-branches ["master"]

;;; Artifact Classifers Installation
  ;; Option to install classified maven artifacts. A map where keys
  ;; indicate the classifier name.
  :classifiers {;; If the value is a map it is merged like a profile
                :tests {:source-paths ^:replace ["test"]}
                ;; If a keyword it is looked up from :profiles
                :classy :my-profile})

;;; Environment Variables used by Leiningen

;; JAVA_CMD - executable to use for java(1)
;; JVM_OPTS - extra options to pass to the java command
;; DEBUG - increased verbosity
;; LEIN_SILENT - suppress info-level output
;; LEIN_HOME - directory in which to look for user settings
;; LEIN_SNAPSHOTS_IN_RELEASE - allow releases to depend on snapshots
;; LEIN_JVM_OPTS - tweak speed of plugins or fix compatibility with old Java versions
;; LEIN_USE_BOOTCLASSPATH - speed up boot time on JVMs older than 9
;; LEIN_REPL_HOST - interface on which to connect to nREPL server
;; LEIN_REPL_PORT - port on which to start or connect to nREPL server
;; LEIN_OFFLINE - equivalent of :offline? true but works for plugins
;; LEIN_GPG - gpg executable to use for encryption/signing
;; LEIN_NEW_UNIX_NEWLINES - ensure that `lein new` emits '\n' as newlines
;; LEIN_SUPPRESS_USER_LEVEL_REPO_WARNINGS - suppress "repository in user profile" warnings
;; LEIN_FAST_TRAMPOLINE - memoize `java` invocation command to speed up subsequent trampoline launches
;; LEIN_NO_USER_PROFILES - suppress loading of user and system profiles
;; http_proxy - host and port to proxy HTTP connections through
;; http_no_proxy - pipe-separated list of hosts which may be accessed directly

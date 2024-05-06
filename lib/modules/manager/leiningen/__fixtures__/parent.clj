(defproject org.example/parent-project "1.0.0-SNAPSHOT"
  :plugins [[lein-parent "0.3.9"]
            [lein-project-version "0.1.0"]
            [lein-shell "0.5.0"]]
  :parent-project {:coords [my-org/my-parent "4.3.0"]
                   :inherit [:profiles :managed-dependencies :local-repo]}
  :profiles {:cljfmt {:plugins [[lein-cljfmt "0.9.2"]]}}
  :dependencies [[org.clojure/core.async "1.6.681"]
                 [org.clojure/core.match "1.1.0"]
                 [org.clojure/data.csv "1.1.0"]
                 [org.clojure/tools.cli "1.1.230"]
                 [metosin/malli "0.15.0"]])

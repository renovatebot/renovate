// swift-tools-version:5.6

import PackageDescription

let package = Package(
    name: "AvitoUITestRunner",
    products: [
        // MARK: - Products
        .executable(
            // MARK: AvitoRunner
            name: "AvitoRunner",
            targets: [
                "AvitoRunner"
            ]
        ),
        .library(
            // MARK: EmceePlugin
            name: "EmceePlugin",
            targets: [
                "Models",
                "Logging",
                "Plugin"
            ]
        ),
        .executable(
            // MARK: fake_fbxctest
            name: "fake_fbxctest",
            targets: ["FakeFbxctest"]
        ),
        .executable(
            // MARK: testing_plugin
            name: "testing_plugin",
            targets: ["TestingPlugin"]
        )
    ],
    dependencies : [
        // MARK: - Dependencies
        .package(url: "https://github.com/0x7fs/CountedSet", .branch("master")),
        .package(url: "foo", .exact("1.2.3.4")),
        .package(url: "bar", "1.2.3.4.5"...),
        .package(url: "baz", from: "1.2.3.4"),
        .package(url: "https://github.com/avito-tech/GraphiteClient.git", .exact(   "0.1.0"   )),
        .package(url: "https://github.com/IBM-Swift/BlueSignals.git", .exact("1.0.16")),
        .package(url: "https://github.com/apple/swift-argument-parser", exact: "1.2.1"),
        .package(url: "https://github.com/beefon/Shout", .branch("UpdateSocket")),
        .package(url: "https://github.com/daltoniam/Starscream.git", .exact("3.0.6")),
        .package(url: "https://github.com/httpswift/swifter.git", .exact("1.4.6")),
        . package ( url : "https://github.com/weichsel/ZIPFoundation/" ,
        /*foobar*/ from : "0.9.6")
        .package(url: "https://github.com/apple/swift-package-manager.git", .branch("swift-5.0-branch")),
    ],
    targets: [
        // MARK: - Targets
        .target(
            // MARK: Ansi
            name: "Ansi",
            dependencies: [
            ]
        ),
        .target(
            // MARK: ArgumentsParser
            name: "ArgumentsParser",
            dependencies: [
                "Extensions",
                "Logging",
                "Models",
                "RuntimeDump",
                "SPMUtility"
            ]
        ),
        .target(
        // MARK: AutomaticTermination
            name: "AutomaticTermination",
            dependencies: [
                "DateProvider",
                "Logging",
                "Timer"
            ]
        ),
        .testTarget(
            // MARK: AutomaticTerminationTests
            name: "AutomaticTerminationTests",
            dependencies: [
                "AutomaticTermination",
                "DateProvider"
            ]
        ),
        .target(
            // MARK: AvitoRunner
            name: "AvitoRunner",
            dependencies: [
                "AvitoRunnerLib"
            ]
        ),
        .target(
            // MARK: AvitoRunnerLib
            name: "AvitoRunnerLib",
            dependencies: [
                "ArgumentsParser",
                "ChromeTracing",
                "Deployer",
                "DistRunner",
                "DistWorker",
                "EventBus",
                "JunitReporting",
                "LaunchdUtils",
                "LocalQueueServerRunner",
                "LoggingSetup",
                "Metrics",
                "Models",
                "PluginManager",
                "PortDeterminer",
                "ProcessController",
                "RemoteQueue",
                "ResourceLocationResolver",
                "SSHDeployer",
                "ScheduleStrategy",
                "Scheduler",
                "SignalHandling",
                "SPMUtility",
                "Version"
            ]
        ),
        .testTarget(
            // MARK: AvitoRunnerLibTests
            name: "AvitoRunnerLibTests",
            dependencies: [
                "AvitoRunnerLib",
                "Models",
                "ModelsTestHelpers"
            ]
        ),
        .target(
            // MARK: BalancingBucketQueue
            name: "BalancingBucketQueue",
            dependencies: [
                "BucketQueue",
                "DateProvider",
                "Logging",
                "Models",
                "ResultsCollector",
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: BalancingBucketQueueTests
            name: "BalancingBucketQueueTests",
            dependencies: [
                "BalancingBucketQueue",
                "BucketQueueTestHelpers",
                "ResultsCollector"
            ]
        ),
        .target(
            // MARK: BucketQueue
            name: "BucketQueue",
            dependencies: [
                "DateProvider",
                "Logging",
                "Models",
                "WorkerAlivenessTracker"
            ]
        ),
        .target(
            // MARK: BucketQueueTestHelpers
            name: "BucketQueueTestHelpers",
            dependencies: [
                "BucketQueue",
                "DateProviderTestHelpers",
                "Models",
                "ModelsTestHelpers",
                "WorkerAlivenessTracker"
            ]
        ),
        .testTarget(
            // MARK: BucketQueueTests
            name: "BucketQueueTests",
            dependencies: [
                "BucketQueue",
                "BucketQueueTestHelpers",
                "DateProviderTestHelpers",
                "ModelsTestHelpers",
                "WorkerAlivenessTrackerTestHelpers"
            ]
        ),
        .target(
            // MARK: ChromeTracing
            name: "ChromeTracing",
            dependencies: [
                "Models"
            ]
        ),
        .target(
            // MARK: CurrentlyBeingProcessedBucketsTracker
            name: "CurrentlyBeingProcessedBucketsTracker",
            dependencies: [
                "CountedSet"
            ]
        ),
        .testTarget(
            // MARK: CurrentlyBeingProcessedBucketsTrackerTests
            name: "CurrentlyBeingProcessedBucketsTrackerTests",
            dependencies: [
                "CurrentlyBeingProcessedBucketsTracker"
            ]
        ),
        .target(
            // MARK: DateProvider
            name: "DateProvider",
            dependencies: []
        ),
        .target(
            // MARK: DateProviderTestHelpers
            name: "DateProviderTestHelpers",
            dependencies: [
                "DateProvider"
            ]
        ),
        .target(
            // MARK: Deployer
            name: "Deployer",
            dependencies: [
                "Extensions",
                "Logging",
                "Models",
                "SPMUtility",
                "ZIPFoundation"
            ]
        ),
        .testTarget(
            // MARK: DeployerTests
            name: "DeployerTests",
            dependencies: [
                "Deployer"
            ]
        ),
        .target(
            // MARK: DistDeployer
            name: "DistDeployer",
            dependencies: [
                "Deployer",
                "LaunchdUtils",
                "Logging",
                "Models",
                "SSHDeployer",
                "TempFolder",
                "Version"
            ]
        ),
        .testTarget(
            // MARK: DistDeployerTests
            name: "DistDeployerTests",
            dependencies: [
                "Deployer",
                "DistDeployer",
                "Extensions",
                "Models",
                "ModelsTestHelpers",
                "ResourceLocationResolver",
                "TempFolder",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: DistRunner
            name: "DistRunner",
            dependencies: [
                "AutomaticTermination",
                "BucketQueue",
                "DateProvider",
                "DistDeployer",
                "EventBus",
                "Extensions",
                "LocalHostDeterminer",
                "Models",
                "PortDeterminer",
                "QueueServer",
                "ResourceLocationResolver",
                "ScheduleStrategy",
                "TempFolder",
                "Version"
            ]
        ),
        .testTarget(
            // MARK: DistRunnerTests
            name: "DistRunnerTests",
            dependencies: [
                "DistRunner"
            ]
        ),
        .target(
            // MARK: DistWorker
            name: "DistWorker",
            dependencies: [
                "CurrentlyBeingProcessedBucketsTracker",
                "EventBus",
                "Extensions",
                "Logging",
                "Models",
                "PluginManager",
                "QueueClient",
                "RESTMethods",
                "ResourceLocationResolver",
                "Scheduler",
                "SimulatorPool",
                "SynchronousWaiter",
                "Timer",
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: DistWorkerTests
            name: "DistWorkerTests",
            dependencies: [
                "DistWorker",
                "ModelsTestHelpers",
                "Scheduler"
            ]
        ),
        .target(
            // MARK: EventBus
            name: "EventBus",
            dependencies: [
                "Logging",
                "Models"
            ]
        ),
        .testTarget(
            // MARK: EventBusTests
            name: "EventBusTests",
            dependencies: [
                "EventBus",
                "ModelsTestHelpers",
                "SynchronousWaiter"
            ]
        ),
        .target(
            // MARK: Extensions
            name: "Extensions",
            dependencies: [
            ]
        ),
        .testTarget(
            // MARK: ExtensionsTests
            name: "ExtensionsTests",
            dependencies: [
                "Extensions",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: FakeFbxctest
            name: "FakeFbxctest",
            dependencies: [
                "Extensions",
                "TestingFakeFbxctest"
            ]
        ),
        .target(
            // MARK: fbxctest
            name: "fbxctest",
            dependencies: [
                "Ansi",
                "JSONStream",
                "LocalHostDeterminer",
                "Logging",
                "Metrics",
                "Models",
                "ProcessController",
                "Timer",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: FileCache
            name: "FileCache",
            dependencies: [
                "Extensions",
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: FileCacheTests
            name: "FileCacheTests",
            dependencies: [
                "FileCache"
            ]
        ),
        .target(
            // MARK: FileHasher
            name: "FileHasher",
            dependencies: [
                "AtomicModels",
                "Extensions",
                "Models"
            ]
        ),
        .testTarget(
            // MARK: FileHasherTests
            name: "FileHasherTests",
            dependencies: [
                "FileHasher",
                "TempFolder"
            ]
        ),
        .target(
            // MARK: LocalHostDeterminer
            name: "LocalHostDeterminer",
            dependencies: [
                "Logging"
            ]
        ),
        .target(
            // MARK: JSONStream
            name: "JSONStream",
            dependencies: []
        ),
        .testTarget(
            // MARK: JSONStreamTests
            name: "JSONStreamTests",
            dependencies: [
                "SPMUtility",
                "JSONStream"
            ]
        ),
        .target(
            // MARK: JunitReporting
            name: "JunitReporting",
            dependencies: [
            ]
        ),
        .testTarget(
            // MARK: JunitReportingTests
            name: "JunitReportingTests",
            dependencies: [
                "Extensions",
                "JunitReporting"
            ]
        ),
        .target(
            // MARK: LaunchdUtils
            name: "LaunchdUtils",
            dependencies: [
            ]
        ),
        .testTarget(
            // MARK: LaunchdUtilsTests
            name: "LaunchdUtilsTests",
            dependencies: [
                "LaunchdUtils"
            ]
        ),
        .target(
            // MARK: ListeningSemaphore
            name: "ListeningSemaphore",
            dependencies: [
            ]
        ),
        .testTarget(
            // MARK: ListeningSemaphoreTests
            name: "ListeningSemaphoreTests",
            dependencies: [
                "ListeningSemaphore"
            ]
        ),
        .target(
            // MARK: LocalQueueServerRunner
            name: "LocalQueueServerRunner",
            dependencies: [
                "AutomaticTermination",
                "DateProvider",
                "Logging",
                "Models",
                "PortDeterminer",
                "QueueServer",
                "ScheduleStrategy",
                "SynchronousWaiter",
                "Version"
            ]
        ),
        .testTarget(
        // MARK: LocalQueueServerRunnerTests
            name: "LocalQueueServerRunnerTests",
            dependencies: [
                "AutomaticTermination",
                "LocalQueueServerRunner"
            ]
        ),
        .target(
            // MARK: Logging
            name: "Logging",
            dependencies: [
                "Ansi",
                "Extensions"
            ]
        ),
        .target(
            // MARK: LoggingSetup
            name: "LoggingSetup",
            dependencies: [
                "Ansi",
                "GraphiteClient",
                "IO",
                "LocalHostDeterminer",
                "Logging",
                "Metrics",
                "Sentry",
                "SPMUtility",
                "Version"
            ]
        ),
        .testTarget(
            // MARK: LoggingTests
            name: "LoggingTests",
            dependencies: [
                "Logging",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: Metrics
            name: "Metrics",
            dependencies: []
        ),
        .testTarget(
            // MARK: MetricsTests
            name: "MetricsTests",
            dependencies: [
                "Metrics"
            ]
        ),
        .target(
            // MARK: Models
            name: "Models",
            dependencies: [
                "Extensions"
            ]
        ),
        .target(
            // MARK: ModelsTestHelpers
            name: "ModelsTestHelpers",
            dependencies: [
                "Models",
                "ScheduleStrategy"
            ]
        ),
        .testTarget(
            // MARK: ModelsTests
            name: "ModelsTests",
            dependencies: [
                "Models",
                "ModelsTestHelpers",
                "TempFolder"
            ]
        ),
        .target(
            // MARK: Plugin
            name: "Plugin",
            dependencies: [
                "EventBus",
                "JSONStream",
                "Logging",
                "LoggingSetup",
                "Models",
                "SimulatorVideoRecorder",
                "Starscream",
                "SynchronousWaiter",
                "TestsWorkingDirectorySupport",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: PluginManager
            name: "PluginManager",
            dependencies: [
                "EventBus",
                "LocalHostDeterminer",
                "Logging",
                "ResourceLocationResolver",
                "Models",
                "ProcessController",
                "Scheduler",
                "Swifter",
                "SynchronousWaiter"
            ]
        ),
        .testTarget(
            // MARK: PluginManagerTests
            name: "PluginManagerTests",
            dependencies: [
                "EventBus",
                "Models",
                "ModelsTestHelpers",
                "PluginManager",
                "ResourceLocationResolver",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: PortDeterminer
            name: "PortDeterminer",
            dependencies: [
                "Logging",
                "Swifter"
            ]
        ),
        .testTarget(
            // MARK: PortDeterminerTests
            name: "PortDeterminerTests",
            dependencies: [
                "PortDeterminer",
                "Swifter"
            ]
        ),
        .target(
            // MARK: ProcessController
            name: "ProcessController",
            dependencies: [
                "Extensions",
                "Logging",
                "ResourceLocationResolver",
                "Timer",
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: ProcessControllerTests
            name: "ProcessControllerTests",
            dependencies: [
                "Extensions",
                "ProcessController",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: QueueClient
            name: "QueueClient",
            dependencies: [
                "Logging",
                "Models",
                "RESTMethods",
                "SynchronousWaiter",
                "Version",
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: QueueClientTests
            name: "QueueClientTests",
            dependencies: [
                "Models",
                "ModelsTestHelpers",
                "PortDeterminer",
                "QueueClient",
                "QueueServer",
                "RESTMethods",
                "Swifter",
                "SynchronousWaiter"
            ]
        ),
        .target(
            // MARK: QueueServer
            name: "QueueServer",
            dependencies: [
                "AutomaticTermination",
                "BalancingBucketQueue",
                "BucketQueue",
                "DateProvider",
                "EventBus",
                "Extensions",
                "FileHasher",
                "Logging",
                "Metrics",
                "Models",
                "PortDeterminer",
                "RESTMethods",
                "ResultsCollector",
                "ScheduleStrategy",
                "Swifter",
                "SynchronousWaiter",
                "Timer",
                "Version",
                "WorkerAlivenessTracker"
            ]
        ),
        .testTarget(
            // MARK: QueueServerTests
            name: "QueueServerTests",
            dependencies: [
                "AutomaticTermination",
                "BalancingBucketQueue",
                "BucketQueue",
                "BucketQueueTestHelpers",
                "DateProviderTestHelpers",
                "Deployer",
                "EventBus",
                "FileHasher",
                "Models",
                "ModelsTestHelpers",
                "QueueServer",
                "ResourceLocationResolver",
                "RESTMethods",
                "ResultsCollector",
                "ScheduleStrategy",
                "TempFolder",
                "VersionTestHelpers",
                "WorkerAlivenessTracker",
                "WorkerAlivenessTrackerTestHelpers"
            ]
        ),
        .target(
            // MARK: RemotePortDeterminer
            name: "RemotePortDeterminer",
            dependencies: [
                "QueueClient",
                "Version"
            ]
        ),
        .target(
            // MARK: RemotePortDeterminerTestHelpers
            name: "RemotePortDeterminerTestHelpers",
            dependencies: [
                "RemotePortDeterminer"
            ]
        ),
        .testTarget(
            // MARK: RemotePortDeterminerTests
            name: "RemotePortDeterminerTests",
            dependencies: [
                "RemotePortDeterminer"
            ]
        ),
        .target(
            // MARK: RemoteQueue
            name: "RemoteQueue",
            dependencies: [
                "DistDeployer",
                "Models",
                "RemotePortDeterminer",
                "SSHDeployer",
                "Version"
            ]
        ),
        .testTarget(
            // MARK: RemoteQueueTests
            name: "RemoteQueueTests",
            dependencies: [
                "RemotePortDeterminerTestHelpers",
                "RemoteQueue",
                "VersionTestHelpers"
            ]
        ),
        .target(
            // MARK: ResultsCollector
            name: "ResultsCollector",
            dependencies: [
                "Models"
            ]
        ),
        .testTarget(
            // MARK: ResultsCollectorTests
            name: "ResultsCollectorTests",
            dependencies: [
                "ModelsTestHelpers",
                "ResultsCollector"
            ]
        ),
        .target(
            // MARK: ResourceLocationResolver
            name: "ResourceLocationResolver",
            dependencies: [
                "AtomicModels",
                "Extensions",
                "FileCache",
                "Models",
                "URLResource"
            ]
        ),
        .testTarget(
            // MARK: ResourceLocationResolverTests
            name: "ResourceLocationResolverTests",
            dependencies: [
                "FileCache",
                "ResourceLocationResolver",
                "Swifter",
                "TempFolder",
                "URLResource"
            ]
        ),
        .target(
            // MARK: RESTMethods
            name: "RESTMethods",
            dependencies: [
                "Models",
                "Version"
            ]
        ),
        .target(
            // MARK: Runner
            name: "Runner",
            dependencies: [
                "EventBus",
                "fbxctest",
                "LocalHostDeterminer",
                "Logging",
                "Models",
                "SimulatorPool",
                "TempFolder",
                "TestsWorkingDirectorySupport"
            ]
        ),
        .testTarget(
            // MARK: RunnerTests
            name: "RunnerTests",
            dependencies: [
                "Extensions",
                "Models",
                "ModelsTestHelpers",
                "ResourceLocationResolver",
                "Runner",
                "ScheduleStrategy",
                "SimulatorPool",
                "TestingFakeFbxctest",
                "TempFolder"
            ]
        ),
        .target(
            // MARK: RuntimeDump
            name: "RuntimeDump",
            dependencies: [
                "EventBus",
                "Extensions",
                "Metrics",
                "Models",
                "Runner",
                "SynchronousWaiter",
                "TempFolder"
            ]
        ),
        .testTarget(
            // MARK: RuntimeDumpTests
            name: "RuntimeDumpTests",
            dependencies: [
                "Models",
                "ModelsTestHelpers",
                "ResourceLocationResolver",
                "RuntimeDump",
                "TestingFakeFbxctest",
                "TempFolder"
            ]
        ),
        .target(
            // MARK: Sentry
            name: "Sentry",
            dependencies: []
        ),
        .testTarget(
            // MARK: SentryTests
            name: "SentryTests",
            dependencies: [
                "Sentry"
            ]
        ),
        .target(
            // MARK: Scheduler
            name: "Scheduler",
            dependencies: [
                "EventBus",
                "ListeningSemaphore",
                "Logging",
                "Models",
                "Runner",
                "RuntimeDump",
                "ScheduleStrategy",
                "SimulatorPool",
                "SynchronousWaiter",
                "TempFolder"
            ]
        ),
        .target(
            // MARK: ScheduleStrategy
            name: "ScheduleStrategy",
            dependencies: [
                "Extensions",
                "Logging",
                "Models"
            ]
        ),
        .testTarget(
            // MARK: ScheduleStrategyTests
            name: "ScheduleStrategyTests",
            dependencies: [
                "Models",
                "ModelsTestHelpers",
                "ScheduleStrategy"
            ]
        ),
        .target(
        // MARK: SignalHandling
            name: "SignalHandling",
            dependencies: [
                "Models",
                "Signals"
            ]
        ),
        .testTarget(
        // MARK: SignalHandlingTests
        name: "SignalHandlingTests",
        dependencies: [
            "SignalHandling",
            "Signals"
            ]
        ),
        .target(
            // MARK: SimulatorPool
            name: "SimulatorPool",
            dependencies: [
                "Extensions",
                "fbxctest",
                "Logging",
                "Models",
                "ProcessController",
                "TempFolder",
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: SimulatorPoolTests
            name: "SimulatorPoolTests",
            dependencies: [
                "Models",
                "ModelsTestHelpers",
                "ResourceLocationResolver",
                "SimulatorPool",
                "SynchronousWaiter",
                "TempFolder"
            ]
        ),
        .target(
            // MARK: SimulatorVideoRecorder
            name: "SimulatorVideoRecorder",
            dependencies: [
                "Logging",
                "Models",
                "ProcessController"
            ]
        ),
        .target(
            // MARK: SSHDeployer
            name: "SSHDeployer",
            dependencies: [
                "Ansi",
                "Extensions",
                "Logging",
                "Models",
                "SPMUtility",
                "Deployer",
                "Shout"
            ]
        ),
        .testTarget(
            // MARK: SSHDeployerTests
            name: "SSHDeployerTests",
            dependencies: [
                "SSHDeployer"
            ]
        ),
        .target(
            // MARK: SynchronousWaiter
            name: "SynchronousWaiter",
            dependencies: []
        ),
        .testTarget(
            // MARK: SynchronousWaiterTests
            name: "SynchronousWaiterTests",
            dependencies: ["SynchronousWaiter"]
        ),
        .target(
            // MARK: TempFolder
            name: "TempFolder",
            dependencies: [
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: TempFolderTests
            name: "TempFolderTests",
            dependencies: [
                "TempFolder"
            ]
        ),
        .target(
            // MARK: TestingFakeFbxctest
            name: "TestingFakeFbxctest",
            dependencies: [
                "Extensions",
                "fbxctest",
                "Logging"
            ]
        ),
        .target(
            // MARK: TestingPlugin
            name: "TestingPlugin",
            dependencies: [
                "Extensions",
                "Models",
                "Logging",
                "LoggingSetup",
                "Plugin"
            ]
        ),
        .target(
            // MARK: TestsWorkingDirectorySupport
            name: "TestsWorkingDirectorySupport",
            dependencies: [
                "Models"
            ]
        ),
        .target(
            // MARK: Timer
            name: "Timer",
            dependencies: [
            ]
        ),
        .target(
            // MARK: URLResource
            name: "URLResource",
            dependencies: [
                "FileCache",
                "Logging",
                "Models",
                "SynchronousWaiter",
                "SPMUtility"
            ]
        ),
        .testTarget(
            // MARK: URLResourceTests
            name: "URLResourceTests",
            dependencies: [
                "FileCache",
                "Swifter",
                "URLResource",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: Version
            name: "Version",
            dependencies: [
                "FileHasher"
            ]
        ),
        .target(
            // MARK: VersionTestHelpers
            name: "VersionTestHelpers",
            dependencies: [
                "Version"
            ]
        ),
        .testTarget(
            // MARK: VersionTests
            name: "VersionTests",
            dependencies: [
                "Extensions",
                "FileHasher",
                "Version",
                "SPMUtility"
            ]
        ),
        .target(
            // MARK: WorkerAlivenessTracker
            name: "WorkerAlivenessTracker",
            dependencies: [
                "Logging"
            ]
        ),
        .target(
            // MARK: WorkerAlivenessTrackerTestHelpersTests
            name: "WorkerAlivenessTrackerTestHelpers",
            dependencies: [
                "WorkerAlivenessTracker"
            ]
        ),
        .testTarget(
            // MARK: WorkerAlivenessTrackerTests
            name: "WorkerAlivenessTrackerTests",
            dependencies: [
                "WorkerAlivenessTracker",
                "WorkerAlivenessTrackerTestHelpers"
            ]
        ),
        .target(
            // MARK: XcTestRun
            name: "XcTestRun",
            dependencies: [
            ]
        ),
        .testTarget(
            // MARK: XcTestRunTests
            name: "XcTestRunTests",
            dependencies: [
                "XcTestRun"
            ]
        )
    ]
)

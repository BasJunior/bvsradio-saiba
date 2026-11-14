import AppIntents

/// Playback intents shared by the app and the BVSWidget extension (compiled
/// into both targets). The system runs them in the app's process, where
/// AppDelegate installs `BvsPlaybackRelay.handler`; in the widget process the
/// handler stays nil and nothing happens.
enum BvsPlaybackRelay {
    @MainActor static var handler: ((String) -> Void)?

    @MainActor
    static func send(_ command: String) {
        handler?(command)
    }
}

/// Widget "Pause" button. Audio is already playing, so the app is alive in the
/// background and the web player can act without coming to the foreground.
@available(iOS 17.0, *)
struct BvsWidgetPauseIntent: AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Pause BVS Radio"
    static var isDiscoverable = false

    @MainActor
    func perform() async throws -> some IntentResult {
        BvsPlaybackRelay.send("pause")
        return .result()
    }
}

/// Widget "Skip" button, shown only while a queue with a next track is playing.
@available(iOS 17.0, *)
struct BvsWidgetNextIntent: AudioPlaybackIntent {
    static var title: LocalizedStringResource = "Skip Track on BVS Radio"
    static var isDiscoverable = false

    @MainActor
    func perform() async throws -> some IntentResult {
        BvsPlaybackRelay.send("next")
        return .result()
    }
}

/// Control Center / Lock Screen / Action button control. Starting WebView audio
/// needs the app in the foreground, so this one opens BVS Radio first.
@available(iOS 17.0, *)
struct BvsStartStationIntent: AppIntent {
    static var title: LocalizedStringResource = "Play BVS Radio"
    static var isDiscoverable = false
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        BvsPlaybackRelay.send("start-station")
        return .result()
    }
}

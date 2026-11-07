import AppIntents
import UIKit

/// Siri, Spotlight and Shortcuts entry points for BVS Radio.
/// Each intent forwards to the same web player bridge the lock screen uses,
/// so Siri control always matches what the in-app player is doing.

@available(iOS 16.0, *)
struct PlayBvsRadioIntent: AppIntent {
    static var title: LocalizedStringResource = "Play BVS Radio"
    static var description = IntentDescription("Starts or resumes BVS Radio.")
    // Starting WebView audio needs the app in the foreground at least once.
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        BvsIntentBridge.send("start-station")
        return .result()
    }
}

@available(iOS 16.0, *)
struct PauseBvsRadioIntent: AppIntent {
    static var title: LocalizedStringResource = "Pause BVS Radio"
    static var description = IntentDescription("Pauses BVS Radio.")
    static var openAppWhenRun = false

    @MainActor
    func perform() async throws -> some IntentResult {
        BvsIntentBridge.send("pause")
        return .result()
    }
}

@available(iOS 16.0, *)
struct NextTrackBvsRadioIntent: AppIntent {
    static var title: LocalizedStringResource = "Skip Track on BVS Radio"
    static var description = IntentDescription("Skips to the next track in BVS Radio.")
    static var openAppWhenRun = false

    @MainActor
    func perform() async throws -> some IntentResult {
        BvsIntentBridge.send("next")
        return .result()
    }
}

@available(iOS 16.0, *)
struct OpenBvsLibraryIntent: AppIntent {
    static var title: LocalizedStringResource = "Open My BVS Library"
    static var description = IntentDescription("Opens your saved music in BVS Radio.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        BvsIntentBridge.navigate("/library")
        return .result()
    }
}

@available(iOS 17.0, *)
struct BvsAppShortcuts: AppShortcutsProvider {
    static var shortcutTileColor: ShortcutTileColor = .lime

    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: PlayBvsRadioIntent(),
            phrases: [
                "Play \(.applicationName)",
                "Start \(.applicationName)",
                "Listen to \(.applicationName)",
                "Resume \(.applicationName)",
            ],
            shortTitle: "Play",
            systemImageName: "play.circle.fill"
        )
        AppShortcut(
            intent: PauseBvsRadioIntent(),
            phrases: ["Pause \(.applicationName)", "Stop \(.applicationName)"],
            shortTitle: "Pause",
            systemImageName: "pause.circle.fill"
        )
        AppShortcut(
            intent: NextTrackBvsRadioIntent(),
            phrases: ["Skip this song on \(.applicationName)", "Next track on \(.applicationName)"],
            shortTitle: "Skip Track",
            systemImageName: "forward.end.fill"
        )
        AppShortcut(
            intent: OpenBvsLibraryIntent(),
            phrases: ["Open my \(.applicationName) library", "Show my saved music in \(.applicationName)"],
            shortTitle: "My Library",
            systemImageName: "heart.circle.fill"
        )
    }
}

enum BvsIntentBridge {
    @MainActor
    static func send(_ command: String) {
        (UIApplication.shared.delegate as? AppDelegate)?.handleIntentMediaCommand(command)
    }

    @MainActor
    static func navigate(_ path: String) {
        (UIApplication.shared.delegate as? AppDelegate)?.handleIntentNavigation(path)
    }
}

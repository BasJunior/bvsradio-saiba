import StoreKit
import UIKit

/// Asks for an App Store rating only from people who clearly use the app:
/// several listening days and a good number of tracks. iOS itself caps how
/// often the sheet can appear; these rules keep us well inside that.
enum BvsReviewPrompt {
    private static let tracksKey = "bvs.review.tracksStarted"
    private static let daysKey = "bvs.review.listeningDays"
    private static let lastDayKey = "bvs.review.lastListeningDay"
    private static let lastAskKey = "bvs.review.lastAskedAt"
    private static let lastVersionKey = "bvs.review.lastAskedVersion"

    static let minimumTracks = 15
    static let minimumDays = 3
    static let minimumDaysBetweenAsks = 120.0

    private static var defaults: UserDefaults { .standard }

    private static var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? ""
    }

    /// Call when a new track starts playing.
    static func recordTrackStarted(now: Date = Date()) {
        defaults.set(defaults.integer(forKey: tracksKey) + 1, forKey: tracksKey)
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.dateFormat = "yyyy-MM-dd"
        let today = formatter.string(from: now)
        if defaults.string(forKey: lastDayKey) != today {
            defaults.set(today, forKey: lastDayKey)
            defaults.set(defaults.integer(forKey: daysKey) + 1, forKey: daysKey)
        }
    }

    static func isEligible(now: Date = Date()) -> Bool {
        guard defaults.integer(forKey: tracksKey) >= minimumTracks,
              defaults.integer(forKey: daysKey) >= minimumDays,
              defaults.string(forKey: lastVersionKey) != appVersion else { return false }
        if let last = defaults.object(forKey: lastAskKey) as? Date,
           now.timeIntervalSince(last) < minimumDaysBetweenAsks * 86_400 {
            return false
        }
        return true
    }

    /// Call when the app comes to the foreground. Waits a moment so the sheet
    /// never lands on top of a tap the listener is in the middle of.
    static func requestIfEligible(in scene: UIWindowScene?) {
        guard let scene, isEligible() else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
            guard scene.activationState == .foregroundActive, isEligible() else { return }
            defaults.set(Date(), forKey: lastAskKey)
            defaults.set(appVersion, forKey: lastVersionKey)
            if #available(iOS 16.0, *) {
                AppStore.requestReview(in: scene)
            } else {
                SKStoreReviewController.requestReview(in: scene)
            }
        }
    }
}

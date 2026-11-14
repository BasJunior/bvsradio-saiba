import Foundation
import UIKit
#if canImport(WidgetKit)
import WidgetKit
#endif

/// Now-playing snapshot shared between the app and the BVS widget through the
/// App Group container. Compiled into both targets; keep it free of app-only types.
struct BvsNowPlayingSnapshot: Codable, Equatable {
    var title: String
    var artist: String
    var source: String
    var isPlaying: Bool
    var hasArtwork: Bool
    var updatedAt: Date
    /// True while the queue has a next track. Optional so snapshots written
    /// by older builds still decode.
    var canSkip: Bool?

    static let idle = BvsNowPlayingSnapshot(
        title: "BVS Radio",
        artist: "Tap to start listening",
        source: "Live station",
        isPlaying: false,
        hasArtwork: false,
        updatedAt: .distantPast
    )
}

enum BvsNowPlayingStore {
    static let appGroup = "group.com.bvsradio.app"
    static let widgetKind = "BVSNowPlayingWidget"
    private static let snapshotFile = "now-playing.json"
    private static let artworkFile = "now-playing-artwork.jpg"

    // Plain files in the group container: readable by the widget everywhere,
    // without relying on cfprefsd group-domain routing.
    private static func sharedFile(_ name: String) -> URL? {
        FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: appGroup)?
            .appendingPathComponent(name)
    }

    private static var artworkURL: URL? { sharedFile(artworkFile) }

    static func load() -> BvsNowPlayingSnapshot {
        guard let url = sharedFile(snapshotFile),
              let data = try? Data(contentsOf: url),
              let snapshot = try? JSONDecoder().decode(BvsNowPlayingSnapshot.self, from: data)
        else { return .idle }
        return snapshot
    }

    static func loadArtwork() -> UIImage? {
        guard let url = artworkURL, let data = try? Data(contentsOf: url) else { return nil }
        return UIImage(data: data)
    }

    /// Saves and refreshes widgets only when something visible changed.
    static func save(_ snapshot: BvsNowPlayingSnapshot) {
        var previous = load()
        previous.updatedAt = snapshot.updatedAt
        guard previous != snapshot,
              let url = sharedFile(snapshotFile),
              let data = try? JSONEncoder().encode(snapshot) else { return }
        try? data.write(to: url, options: .atomic)
        reloadWidgets()
    }

    /// Stores a small square copy of the cover; widgets have tight memory limits.
    static func saveArtwork(_ image: UIImage?) {
        guard let url = artworkURL else { return }
        guard let image else {
            try? FileManager.default.removeItem(at: url)
            return
        }
        let side: CGFloat = 360
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let scaled = UIGraphicsImageRenderer(size: CGSize(width: side, height: side), format: format).image { _ in
            let ratio = max(side / image.size.width, side / image.size.height)
            let size = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
            image.draw(in: CGRect(x: (side - size.width) / 2, y: (side - size.height) / 2, width: size.width, height: size.height))
        }
        guard let data = scaled.jpegData(compressionQuality: 0.82) else { return }
        try? data.write(to: url, options: .atomic)
        reloadWidgets()
    }

    static func reloadWidgets() {
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: widgetKind)
        #endif
    }
}

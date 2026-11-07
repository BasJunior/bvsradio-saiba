import SwiftUI
import WidgetKit

// MARK: - Timeline

struct BvsNowPlayingEntry: TimelineEntry {
    let date: Date
    let snapshot: BvsNowPlayingSnapshot
    let artwork: UIImage?
}

struct BvsNowPlayingProvider: TimelineProvider {
    func placeholder(in context: Context) -> BvsNowPlayingEntry {
        BvsNowPlayingEntry(date: .now, snapshot: .idle, artwork: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (BvsNowPlayingEntry) -> Void) {
        completion(currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BvsNowPlayingEntry>) -> Void) {
        // The app reloads this widget whenever the track or play state changes.
        completion(Timeline(entries: [currentEntry()], policy: .never))
    }

    private func currentEntry() -> BvsNowPlayingEntry {
        let snapshot = BvsNowPlayingStore.load()
        return BvsNowPlayingEntry(
            date: .now,
            snapshot: snapshot,
            artwork: snapshot.hasArtwork ? BvsNowPlayingStore.loadArtwork() : nil
        )
    }
}

// MARK: - Style

private enum BvsWidgetStyle {
    static let lime = Color(red: 196 / 255, green: 243 / 255, blue: 67 / 255)
    static let ink = Color(red: 10 / 255, green: 10 / 255, blue: 10 / 255)
    static let playURL = URL(string: "bvsradio://play")!
    static let openURL = URL(string: "bvsradio://open")!
    static let libraryURL = URL(string: "bvsradio://library")!
}

private struct BvsArtwork: View {
    let image: UIImage?
    var corner: CGFloat = 12

    var body: some View {
        ZStack {
            if let image {
                Image(uiImage: image).resizable().scaledToFill()
            } else {
                LinearGradient(
                    colors: [BvsWidgetStyle.lime.opacity(0.35), Color.white.opacity(0.06), .black],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                Text("BVS")
                    .font(.system(size: 22, weight: .heavy))
                    .tracking(3)
                    .foregroundStyle(BvsWidgetStyle.lime)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
    }
}

private struct PlayStateBadge: View {
    let isPlaying: Bool

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: isPlaying ? "waveform" : "play.fill")
                .font(.system(size: 9, weight: .bold))
            Text(isPlaying ? "NOW PLAYING" : "BVS RADIO")
                .font(.system(size: 9, weight: .bold))
                .tracking(1.2)
        }
        .foregroundStyle(BvsWidgetStyle.lime)
    }
}

// MARK: - Views

struct BvsNowPlayingWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BvsNowPlayingEntry

    private var snapshot: BvsNowPlayingSnapshot { entry.snapshot }
    private var tapURL: URL { snapshot.isPlaying ? BvsWidgetStyle.openURL : BvsWidgetStyle.playURL }

    var body: some View {
        content
            .widgetURL(tapURL)
            .containerBackground(for: .widget) { background }
    }

    @ViewBuilder
    private var background: some View {
        switch family {
        case .accessoryCircular, .accessoryRectangular, .accessoryInline:
            AccessoryWidgetBackground()
        default:
            ZStack {
                BvsWidgetStyle.ink
                if let art = entry.artwork {
                    Image(uiImage: art).resizable().scaledToFill().blur(radius: 30).opacity(0.45)
                }
                LinearGradient(colors: [.clear, BvsWidgetStyle.ink.opacity(0.85)], startPoint: .top, endPoint: .bottom)
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch family {
        case .systemMedium: medium
        case .accessoryRectangular: rectangular
        case .accessoryCircular: circular
        case .accessoryInline: Text(snapshot.isPlaying ? "♪ \(snapshot.title)" : "BVS Radio")
        default: small
        }
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .top) {
                BvsArtwork(image: entry.artwork).frame(width: 58, height: 58)
                Spacer(minLength: 0)
                // Tapping opens the app (or starts the station), so never show a pause glyph.
                Image(systemName: snapshot.isPlaying ? "waveform.circle.fill" : "play.circle.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(BvsWidgetStyle.lime)
            }
            Spacer(minLength: 0)
            PlayStateBadge(isPlaying: snapshot.isPlaying)
            Text(snapshot.title)
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(2)
            Text(snapshot.artist)
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.65))
                .lineLimit(1)
        }
    }

    private var medium: some View {
        HStack(spacing: 12) {
            // Square cover sized to the widget height, so narrow devices keep room for text.
            BvsArtwork(image: entry.artwork, corner: 14)
                .aspectRatio(1, contentMode: .fit)
                .frame(maxWidth: 120, maxHeight: .infinity)
            VStack(alignment: .leading, spacing: 4) {
                PlayStateBadge(isPlaying: snapshot.isPlaying)
                Text(snapshot.title)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(2)
                    .minimumScaleFactor(0.85)
                Text(snapshot.artist)
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.65))
                    .lineLimit(1)
                Spacer(minLength: 0)
                ViewThatFits(in: .horizontal) {
                    mediumButtons(compactLibrary: false)
                    mediumButtons(compactLibrary: true)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private func mediumButtons(compactLibrary: Bool) -> some View {
        HStack(spacing: 6) {
            Link(destination: tapURL) {
                Label(snapshot.isPlaying ? "Open" : "Listen", systemImage: snapshot.isPlaying ? "waveform" : "play.fill")
                    .font(.system(size: 12, weight: .bold))
                    .lineLimit(1)
                    .fixedSize()
                    .foregroundStyle(.black)
                    .padding(.horizontal, 11)
                    .padding(.vertical, 7)
                    .background(BvsWidgetStyle.lime, in: Capsule())
            }
            Link(destination: BvsWidgetStyle.libraryURL) {
                Group {
                    if compactLibrary {
                        Image(systemName: "heart.fill").accessibilityLabel("Library")
                    } else {
                        Label("Library", systemImage: "heart.fill").lineLimit(1).fixedSize()
                    }
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, compactLibrary ? 9 : 11)
                .padding(.vertical, 7)
                .background(Color.white.opacity(0.14), in: Capsule())
            }
        }
    }

    private var rectangular: some View {
        HStack(spacing: 8) {
            Image(systemName: snapshot.isPlaying ? "waveform" : "radio")
                .font(.system(size: 18, weight: .semibold))
            VStack(alignment: .leading, spacing: 1) {
                Text(snapshot.isPlaying ? "BVS · Now playing" : "BVS Radio")
                    .font(.system(size: 11, weight: .semibold))
                    .widgetAccentable()
                Text(snapshot.title).font(.system(size: 13, weight: .semibold)).lineLimit(1)
                Text(snapshot.artist).font(.system(size: 11)).lineLimit(1).opacity(0.8)
            }
            Spacer(minLength: 0)
        }
    }

    private var circular: some View {
        VStack(spacing: 1) {
            Image(systemName: snapshot.isPlaying ? "waveform" : "play.fill")
                .font(.system(size: 18, weight: .bold))
            Text("BVS").font(.system(size: 10, weight: .heavy))
        }
        .widgetAccentable()
    }
}

// MARK: - Widget

struct BvsNowPlayingWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: BvsNowPlayingStore.widgetKind, provider: BvsNowPlayingProvider()) { entry in
            BvsNowPlayingWidgetView(entry: entry)
        }
        .configurationDisplayName("BVS Now Playing")
        .description("See what's on BVS Radio and jump back in with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryCircular, .accessoryInline])
    }
}

@main
struct BvsWidgetBundle: WidgetBundle {
    var body: some Widget {
        BvsNowPlayingWidget()
    }
}

import UIKit
import AVFoundation
import MediaPlayer
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler {

    var window: UIWindow?
    private var webViewURLObservation: NSKeyValueObservation?
    private let navigationRouteHandler = "bvsNavigationRoute"
    private let nowPlayingRouteHandler = "bvsNowPlaying"
    private var remoteCommandsConfigured = false
    private var currentArtworkURL = ""

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Allow HTML5 / WebView audio to continue when the screen locks (radio use case).
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .default,
                options: [.allowAirPlay, .allowBluetoothHFP]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Non-fatal: playback still works while app is foregrounded.
            print("AVAudioSession setup failed: \(error)")
        }
        configureRemoteCommandsIfNeeded()
        DispatchQueue.main.async { [weak self] in
            self?.configureNavigationGesturesIfNeeded()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and begins the transition to the background state.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Background audio remains active through the playback AVAudioSession.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        configureNavigationGesturesIfNeeded()
        configureRemoteCommandsIfNeeded()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    private func configureNavigationGesturesIfNeeded() {
        guard webViewURLObservation == nil else { return }
        guard let bridge = window?.rootViewController as? CAPBridgeViewController else {
            #if DEBUG
            NSLog("BVS navigation bridge unavailable root=%@", String(describing: window?.rootViewController))
            #endif
            return
        }
        bridge.loadViewIfNeeded()
        guard let webView = bridge.webView else {
            #if DEBUG
            NSLog("BVS navigation web view unavailable")
            #endif
            return
        }
        let routeBridge = WKUserScript(
            source: """
            (() => {
              if (window.__bvsNativeRouteBridgeInstalled) return;
              window.__bvsNativeRouteBridgeInstalled = true;
              const emit = () => window.webkit?.messageHandlers?.bvsNavigationRoute?.postMessage(window.location.href);
              for (const name of ['pushState', 'replaceState']) {
                const original = window.history[name];
                window.history[name] = function(...args) {
                  const result = original.apply(this, args);
                  emit();
                  return result;
                };
              }
              window.addEventListener('popstate', emit);
              emit();
            })();
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        webView.configuration.userContentController.addUserScript(routeBridge)
        webView.configuration.userContentController.add(self, name: navigationRouteHandler)
        webView.configuration.userContentController.add(self, name: nowPlayingRouteHandler)
        webView.evaluateJavaScript(routeBridge.source)
        webViewURLObservation = webView.observe(\.url, options: [.initial, .new]) { [weak self] observedWebView, _ in
            self?.updateNavigationGestures(for: observedWebView)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == nowPlayingRouteHandler {
            handleNowPlayingMessage(message.body)
            return
        }

        guard message.name == navigationRouteHandler,
              let route = message.body as? String,
              let url = URL(string: route),
              let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }
        updateNavigationGestures(for: webView, routeURL: url)
    }

    private func handleNowPlayingMessage(_ body: Any) {
        guard let payload = body as? [String: Any], let action = payload["action"] as? String else { return }
        let center = MPNowPlayingInfoCenter.default()

        if action == "clear" {
            center.nowPlayingInfo = nil
            currentArtworkURL = ""
            return
        }

        var info = center.nowPlayingInfo ?? [:]
        if action == "update" {
            if let title = payload["title"] as? String, !title.isEmpty { info[MPMediaItemPropertyTitle] = title }
            if let artist = payload["artist"] as? String, !artist.isEmpty { info[MPMediaItemPropertyArtist] = artist }
            if let album = payload["album"] as? String, !album.isEmpty { info[MPMediaItemPropertyAlbumTitle] = album }
            if let artwork = payload["artwork"] as? String, !artwork.isEmpty, artwork != currentArtworkURL {
                currentArtworkURL = artwork
                loadNowPlayingArtwork(artwork)
            }
        }

        if let elapsed = number(payload["elapsed"]) {
            info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = max(0, elapsed)
        }
        if let duration = number(payload["duration"]), duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = duration
        }
        if let playing = boolean(payload["playing"]) {
            info[MPNowPlayingInfoPropertyPlaybackRate] = playing ? 1.0 : 0.0
        }
        center.nowPlayingInfo = info
    }

    private func number(_ value: Any?) -> Double? {
        if let number = value as? NSNumber { return number.doubleValue }
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        return nil
    }

    private func boolean(_ value: Any?) -> Bool? {
        if let value = value as? Bool { return value }
        if let number = value as? NSNumber { return number.boolValue }
        return nil
    }

    private func loadNowPlayingArtwork(_ rawURL: String) {
        guard let url = URL(string: rawURL) else { return }
        URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self,
                  self.currentArtworkURL == rawURL,
                  let data,
                  let image = UIImage(data: data) else { return }
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            DispatchQueue.main.async {
                guard self.currentArtworkURL == rawURL else { return }
                var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
                info[MPMediaItemPropertyArtwork] = artwork
                MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            }
        }.resume()
    }

    private func configureRemoteCommandsIfNeeded() {
        guard !remoteCommandsConfigured else { return }
        remoteCommandsConfigured = true
        let commands = MPRemoteCommandCenter.shared()

        commands.playCommand.isEnabled = true
        commands.playCommand.addTarget { [weak self] _ in
            self?.emitNativeMediaCommand("play")
            return .success
        }
        commands.pauseCommand.isEnabled = true
        commands.pauseCommand.addTarget { [weak self] _ in
            self?.emitNativeMediaCommand("pause")
            return .success
        }
        commands.nextTrackCommand.isEnabled = true
        commands.nextTrackCommand.addTarget { [weak self] _ in
            self?.emitNativeMediaCommand("next")
            return .success
        }
        commands.previousTrackCommand.isEnabled = true
        commands.previousTrackCommand.addTarget { [weak self] _ in
            self?.emitNativeMediaCommand("previous")
            return .success
        }
        commands.skipForwardCommand.isEnabled = false
        commands.skipBackwardCommand.isEnabled = false
        commands.changePlaybackPositionCommand.isEnabled = false
    }

    private func emitNativeMediaCommand(_ command: String) {
        guard let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView,
              let data = try? JSONSerialization.data(withJSONObject: ["command": command]),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async {
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('bvs:native-media-command',{detail:\(json)}));")
        }
    }

    private func updateNavigationGestures(for webView: WKWebView) {
        updateNavigationGestures(for: webView, routeURL: webView.url)
    }

    private func updateNavigationGestures(for webView: WKWebView, routeURL url: URL?) {
        guard let url else {
            webView.allowsBackForwardNavigationGestures = false
            return
        }
        let trustedHosts = ["bvsradio.com", "www.bvsradio.com"]
        guard url.host.map(trustedHosts.contains) == true else {
            webView.allowsBackForwardNavigationGestures = false
            return
        }
        let primaryRoots = [
            "/", "/app/ios", "/app/ios/explore", "/app/ios/beats", "/app/ios/library",
            "/app/android", "/app/android/explore", "/app/android/beats", "/app/android/library"
        ]
        let hasDismissibleLayer = url.fragment?.hasPrefix("bvs-") == true
        let gestureEnabled = hasDismissibleLayer || !primaryRoots.contains(url.path)
        webView.allowsBackForwardNavigationGestures = gestureEnabled
        #if DEBUG
        NSLog("BVS navigation route=%@ layer=%@ gesture=%@", url.path, url.fragment ?? "none", gestureEnabled.description)
        #endif
    }

}

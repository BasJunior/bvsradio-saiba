import UIKit
import AVFoundation
import MediaPlayer
import Capacitor
import WebKit
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    private var webViewURLObservation: NSKeyValueObservation?
    private let navigationRouteHandler = "bvsNavigationRoute"
    private let nowPlayingRouteHandler = "bvsNowPlaying"
    private let pushRegistrationHandler = "bvsPushRegistration"
    private var remoteCommandsConfigured = false
    private var currentArtworkURL = ""
    private var pendingPushHref: String?
    private var pendingNativeMediaPayloads: [[String: Any]] = []

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
        UNUserNotificationCenter.current().delegate = self
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioSessionInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance()
        )
        configureRemoteCommandsIfNeeded()
        DispatchQueue.main.async { [weak self] in
            self?.configureNavigationGesturesIfNeeded()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state.
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
        flushPendingNativeMediaCommands()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        emitPushEvent("bvs:native-push-registration", payload: ["token": token])
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        emitPushEvent("bvs:native-push-registration", payload: ["error": error.localizedDescription])
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
              window.__bvsNativeMediaQueue = window.__bvsNativeMediaQueue || [];
              window.__bvsNativeMediaReady = Boolean(window.__bvsNativeMediaReady);
              window.__bvsReceiveNativeMediaCommand = (payload) => {
                if (window.__bvsNativeMediaReady) {
                  window.dispatchEvent(new CustomEvent('bvs:native-media-command', { detail: payload }));
                } else {
                  window.__bvsNativeMediaQueue.push(payload);
                }
              };
              emit();
            })();
            """,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: true
        )
        webView.configuration.userContentController.addUserScript(routeBridge)
        webView.configuration.userContentController.add(self, name: navigationRouteHandler)
        webView.configuration.userContentController.add(self, name: nowPlayingRouteHandler)
        webView.configuration.userContentController.add(self, name: pushRegistrationHandler)
        webView.evaluateJavaScript(routeBridge.source)
        webViewURLObservation = webView.observe(\.url, options: [.initial, .new]) { [weak self] observedWebView, _ in
            self?.updateNavigationGestures(for: observedWebView)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.flushPendingPushAction()
            self?.flushPendingNativeMediaCommands()
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == nowPlayingRouteHandler {
            handleNowPlayingMessage(message.body)
            return
        }
        if message.name == pushRegistrationHandler {
            handlePushRegistrationMessage(message.body)
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
            let commands = MPRemoteCommandCenter.shared()
            commands.nextTrackCommand.isEnabled = false
            commands.previousTrackCommand.isEnabled = false
            commands.skipForwardCommand.isEnabled = false
            commands.skipBackwardCommand.isEnabled = false
            commands.changePlaybackPositionCommand.isEnabled = false
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

            let commands = MPRemoteCommandCenter.shared()
            if let canNext = boolean(payload["canNext"]) {
                commands.nextTrackCommand.isEnabled = canNext
            }
            if let canPrevious = boolean(payload["canPrevious"]) {
                commands.previousTrackCommand.isEnabled = canPrevious
            }
            if let canSeek = boolean(payload["canSeek"]) {
                // BVS is a music player: keep transport controls as previous/next track.
                // Seeking remains available through the scrubber without replacing those controls.
                commands.skipForwardCommand.isEnabled = false
                commands.skipBackwardCommand.isEnabled = false
                commands.changePlaybackPositionCommand.isEnabled = canSeek
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

    @objc private func handleAudioSessionInterruption(_ notification: Notification) {
        guard
            let rawType = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: rawType)
        else { return }

        if type == .began {
            var info = MPNowPlayingInfoCenter.default().nowPlayingInfo ?? [:]
            info[MPNowPlayingInfoPropertyPlaybackRate] = 0.0
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info
            _ = emitNativeMediaCommand("pause")
            return
        }

        guard type == .ended else { return }
        let rawOptions = notification.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt ?? 0
        let options = AVAudioSession.InterruptionOptions(rawValue: rawOptions)
        if options.contains(.shouldResume) {
            do {
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                print("AVAudioSession resume failed: \(error)")
            }
            _ = emitNativeMediaCommand("play")
        }
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
            return self?.emitNativeMediaCommand("play") == true ? .success : .commandFailed
        }
        commands.pauseCommand.isEnabled = true
        commands.pauseCommand.addTarget { [weak self] _ in
            return self?.emitNativeMediaCommand("pause") == true ? .success : .commandFailed
        }

        // Availability is updated from the real BVS queue in handleNowPlayingMessage.
        commands.nextTrackCommand.isEnabled = false
        commands.nextTrackCommand.addTarget { [weak self] _ in
            return self?.emitNativeMediaCommand("next") == true ? .success : .commandFailed
        }
        commands.previousTrackCommand.isEnabled = false
        commands.previousTrackCommand.addTarget { [weak self] _ in
            return self?.emitNativeMediaCommand("previous") == true ? .success : .commandFailed
        }

        // Keep interval skip commands disabled for music UX. The progress scrubber
        // uses changePlaybackPositionCommand instead and does not replace track controls.
        commands.skipForwardCommand.preferredIntervals = [15]
        commands.skipForwardCommand.isEnabled = false
        commands.skipForwardCommand.addTarget { [weak self] event in
            guard let event = event as? MPSkipIntervalCommandEvent else { return .commandFailed }
            return self?.emitNativeMediaCommand("skip-forward", extra: ["interval": event.interval]) == true ? .success : .commandFailed
        }
        commands.skipBackwardCommand.preferredIntervals = [15]
        commands.skipBackwardCommand.isEnabled = false
        commands.skipBackwardCommand.addTarget { [weak self] event in
            guard let event = event as? MPSkipIntervalCommandEvent else { return .commandFailed }
            return self?.emitNativeMediaCommand("skip-backward", extra: ["interval": event.interval]) == true ? .success : .commandFailed
        }
        commands.changePlaybackPositionCommand.isEnabled = false
        commands.changePlaybackPositionCommand.addTarget { [weak self] event in
            guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
            return self?.emitNativeMediaCommand("seek", extra: ["position": max(0, event.positionTime)]) == true ? .success : .commandFailed
        }
    }

    @discardableResult
    private func emitNativeMediaCommand(_ command: String, extra: [String: Any] = [:]) -> Bool {
        var payload = extra
        payload["command"] = command
        return emitNativeMediaPayload(payload)
    }

    @discardableResult
    private func emitNativeMediaPayload(_ payload: [String: Any]) -> Bool {
        guard JSONSerialization.isValidJSONObject(payload) else { return false }
        DispatchQueue.main.async { [weak self] in
            self?.deliverNativeMediaPayload(payload)
        }
        return true
    }

    private func deliverNativeMediaPayload(_ payload: [String: Any]) {
        guard
            let data = try? JSONSerialization.data(withJSONObject: payload),
            let json = String(data: data, encoding: .utf8),
            let bridge = window?.rootViewController as? CAPBridgeViewController,
            let webView = bridge.webView
        else {
            pendingNativeMediaPayloads.append(payload)
            return
        }

        let script = "window.__bvsReceiveNativeMediaCommand ? window.__bvsReceiveNativeMediaCommand(\(json)) : (window.__bvsNativeMediaQueue = (window.__bvsNativeMediaQueue || []).concat([\(json)]));"
        webView.evaluateJavaScript(script) { [weak self] _, error in
            if error != nil {
                self?.pendingNativeMediaPayloads.append(payload)
            }
        }
    }

    private func flushPendingNativeMediaCommands() {
        guard !pendingNativeMediaPayloads.isEmpty else { return }
        let pending = pendingNativeMediaPayloads
        pendingNativeMediaPayloads.removeAll()
        for payload in pending {
            deliverNativeMediaPayload(payload)
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

    private func handlePushRegistrationMessage(_ body: Any) {
        guard let payload = body as? [String: Any], let action = payload["action"] as? String else { return }
        let center = UNUserNotificationCenter.current()
        if action == "status" {
            center.getNotificationSettings { [weak self] settings in
                self?.emitPushPermission(settings.authorizationStatus)
            }
            return
        }
        guard action == "register" else { return }
        center.requestAuthorization(options: [.alert, .badge, .sound]) { [weak self] granted, error in
            guard let self else { return }
            if let error {
                self.emitPushEvent("bvs:native-push-permission", payload: ["state": "denied", "error": error.localizedDescription])
                return
            }
            center.getNotificationSettings { [weak self] settings in
                guard let self else { return }
                self.emitPushPermission(settings.authorizationStatus)
                if granted || settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional || settings.authorizationStatus == .ephemeral {
                    DispatchQueue.main.async {
                        UIApplication.shared.registerForRemoteNotifications()
                    }
                }
            }
        }
    }

    private func emitPushPermission(_ status: UNAuthorizationStatus) {
        let state: String
        switch status {
        case .authorized, .provisional, .ephemeral:
            state = "granted"
        case .denied:
            state = "denied"
        case .notDetermined:
            state = "prompt"
        @unknown default:
            state = "unavailable"
        }
        emitPushEvent("bvs:native-push-permission", payload: ["state": state])
    }

    private func emitPushEvent(_ name: String, payload: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(payload),
              let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else { return }
        DispatchQueue.main.async { [weak self] in
            guard let self,
                  let bridge = self.window?.rootViewController as? CAPBridgeViewController,
                  let webView = bridge.webView else { return }
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(name)',{detail:\(json)}));")
        }
    }

    private func emitPushAction(_ href: String) {
        guard !href.isEmpty else { return }
        guard let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView,
              let data = try? JSONSerialization.data(withJSONObject: ["href": href]),
              let json = String(data: data, encoding: .utf8) else {
            pendingPushHref = href
            return
        }
        pendingPushHref = nil
        DispatchQueue.main.async {
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('bvs:native-push-action',{detail:\(json)}));")
        }
    }

    private func flushPendingPushAction() {
        guard let href = pendingPushHref else { return }
        emitPushAction(href)
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
        completionHandler([.banner, .list, .sound, .badge])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
        let info = response.notification.request.content.userInfo
        if let href = info["href"] as? String, !href.isEmpty {
            pendingPushHref = href
            emitPushAction(href)
        }
        completionHandler()
    }

}

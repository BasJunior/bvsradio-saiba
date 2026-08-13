import UIKit
import AVFoundation
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, WKScriptMessageHandler {

    var window: UIWindow?
    private var webViewURLObservation: NSKeyValueObservation?
    private let navigationRouteHandler = "bvsNavigationRoute"

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
        DispatchQueue.main.async { [weak self] in
            self?.configureNavigationGesturesIfNeeded()
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
        configureNavigationGesturesIfNeeded()
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
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
        webView.evaluateJavaScript(routeBridge.source)
        webViewURLObservation = webView.observe(\.url, options: [.initial, .new]) { [weak self] observedWebView, _ in
            self?.updateNavigationGestures(for: observedWebView)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == navigationRouteHandler,
              let route = message.body as? String,
              let url = URL(string: route),
              let bridge = window?.rootViewController as? CAPBridgeViewController,
              let webView = bridge.webView else { return }
        updateNavigationGestures(for: webView, routeURL: url)
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

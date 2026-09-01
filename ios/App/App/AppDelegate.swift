import UIKit
import AVFoundation
import Capacitor

@objc(BvsOfflineMediaPlugin)
public class BvsOfflineMediaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BvsOfflineMediaPlugin"
    public let jsName = "BvsOfflineMedia"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "list", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "renew", returnType: CAPPluginReturnPromise),
    ]

    private struct ManifestData {
        let trackId: String
        let title: String
        let artist: String
        let artworkUrl: String?
        let downloadUrl: URL
        let downloadUrlExpiresAt: String
        let licenseValidUntil: String
    }

    private struct Record: Codable {
        let trackId: String
        var surface: String
        var title: String
        var artist: String
        var artworkUrl: String?
        var licenseValidUntil: String
        var downloadedAt: String
        var bytes: Int64
        var fileName: String
    }

    private let metadataQueue = DispatchQueue(label: "com.bvsradio.app.offline-metadata")
    private let maxMediaBytes: Int64 = 2 * 1024 * 1024 * 1024

    @objc public func download(_ call: CAPPluginCall) {
        do {
            let manifest = try validatedManifest(call)
            performDownload(manifest, call: call)
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc public func renew(_ call: CAPPluginCall) {
        do {
            let manifest = try validatedManifest(call)
            metadataQueue.async { [weak self] in
                guard let self else { return }
                do {
                    var records = try self.loadRecords()
                    guard var record = records[manifest.trackId], FileManager.default.fileExists(atPath: self.mediaURL(manifest.trackId).path) else {
                        DispatchQueue.main.async { self.performDownload(manifest, call: call) }
                        return
                    }
                    record.surface = "ios"
                    record.title = manifest.title
                    record.artist = manifest.artist
                    record.artworkUrl = manifest.artworkUrl
                    record.licenseValidUntil = manifest.licenseValidUntil
                    records[manifest.trackId] = record
                    try self.saveRecords(records)
                    self.resolve(call, ["item": self.itemPayload(record)])
                } catch {
                    self.reject(call, error.localizedDescription)
                }
            }
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc public func list(_ call: CAPPluginCall) {
        metadataQueue.async { [weak self] in
            guard let self else { return }
            do {
                let records = try self.loadRecords().values.sorted { $0.downloadedAt > $1.downloadedAt }
                self.resolve(call, ["items": records.map { self.itemPayload($0) }])
            } catch {
                self.reject(call, error.localizedDescription)
            }
        }
    }

    @objc public func status(_ call: CAPPluginCall) {
        guard let trackId = call.getString("trackId"), isUUID(trackId) else {
            call.reject("A valid track is required.")
            return
        }
        metadataQueue.async { [weak self] in
            guard let self else { return }
            do {
                let record = try self.loadRecords()[trackId]
                self.resolve(call, ["item": record.map { self.itemPayload($0) } ?? NSNull()])
            } catch {
                self.reject(call, error.localizedDescription)
            }
        }
    }

    @objc public func remove(_ call: CAPPluginCall) {
        guard let trackId = call.getString("trackId"), isUUID(trackId) else {
            call.reject("A valid track is required.")
            return
        }
        metadataQueue.async { [weak self] in
            guard let self else { return }
            do {
                let file = self.mediaURL(trackId)
                if FileManager.default.fileExists(atPath: file.path) {
                    try FileManager.default.removeItem(at: file)
                }
                var records = try self.loadRecords()
                records.removeValue(forKey: trackId)
                try self.saveRecords(records)
                self.resolve(call, [:])
            } catch {
                self.reject(call, error.localizedDescription)
            }
        }
    }

    private func validatedManifest(_ call: CAPPluginCall) throws -> ManifestData {
        guard let raw = call.getObject("manifest") else { throw offlineError("A download manifest is required.") }
        let numberVersion = (raw["version"] as? NSNumber)?.intValue ?? raw["version"] as? Int ?? 0
        let surface = raw["surface"] as? String ?? ""
        let storagePolicy = raw["storagePolicy"] as? String ?? ""
        let exportAllowed = (raw["exportAllowed"] as? NSNumber)?.boolValue ?? raw["exportAllowed"] as? Bool ?? true
        let requiresRevalidation = (raw["requiresRevalidation"] as? NSNumber)?.boolValue ?? raw["requiresRevalidation"] as? Bool ?? false
        guard numberVersion == 1 else { throw offlineError("Unsupported download manifest.") }
        guard surface == "ios" else { throw offlineError("This download was not cleared for iOS.") }
        guard storagePolicy == "app-private" else { throw offlineError("Private storage is required.") }
        guard exportAllowed == false else { throw offlineError("Exportable media is not accepted.") }
        guard requiresRevalidation == true else { throw offlineError("Rights revalidation is required.") }

        let trackId = (raw["trackId"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let title = (raw["title"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let artist = (raw["artist"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let artworkUrl = raw["artworkUrl"] as? String
        let downloadValue = (raw["downloadUrl"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let downloadExpires = (raw["downloadUrlExpiresAt"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let licenseValidUntil = (raw["licenseValidUntil"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)

        guard isUUID(trackId), !title.isEmpty, !artist.isEmpty else { throw offlineError("The download manifest is incomplete.") }
        guard let downloadUrl = URL(string: downloadValue), downloadUrl.scheme?.lowercased() == "https" else {
            throw offlineError("Secure media URL required.")
        }
        let now = Date()
        guard let downloadExpiry = parseISO(downloadExpires), downloadExpiry > now else { throw offlineError("The download link has expired.") }
        guard let licenseExpiry = parseISO(licenseValidUntil), licenseExpiry > now else { throw offlineError("The offline licence has expired.") }

        return ManifestData(
            trackId: trackId,
            title: title,
            artist: artist,
            artworkUrl: artworkUrl,
            downloadUrl: downloadUrl,
            downloadUrlExpiresAt: downloadExpires,
            licenseValidUntil: licenseValidUntil
        )
    }

    private func performDownload(_ manifest: ManifestData, call: CAPPluginCall) {
        var request = URLRequest(url: manifest.downloadUrl)
        request.timeoutInterval = 30
        request.setValue("audio/*,application/octet-stream;q=0.9,*/*;q=0.1", forHTTPHeaderField: "Accept")
        URLSession.shared.downloadTask(with: request) { [weak self] temporary, response, error in
            guard let self else { return }
            if let error {
                self.reject(call, error.localizedDescription)
                return
            }
            guard let temporary,
                  let http = response as? HTTPURLResponse,
                  (200..<300).contains(http.statusCode),
                  http.url?.scheme?.lowercased() == "https" else {
                self.reject(call, "The media server did not return a secure download.")
                return
            }
            if response?.expectedContentLength ?? 0 > self.maxMediaBytes {
                self.reject(call, "Media file exceeds the offline limit.")
                return
            }
            self.metadataQueue.sync {
                do {
                    let directory = try self.offlineDirectory()
                    let destination = self.mediaURL(manifest.trackId, directory: directory)
                    if FileManager.default.fileExists(atPath: destination.path) {
                        try FileManager.default.removeItem(at: destination)
                    }
                    try FileManager.default.moveItem(at: temporary, to: destination)
                    let attributes = try FileManager.default.attributesOfItem(atPath: destination.path)
                    let bytes = (attributes[.size] as? NSNumber)?.int64Value ?? 0
                    guard bytes <= self.maxMediaBytes else {
                        try? FileManager.default.removeItem(at: destination)
                        throw self.offlineError("Media file exceeds the offline limit.")
                    }
                    try FileManager.default.setAttributes(
                        [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                        ofItemAtPath: destination.path
                    )
                    let record = Record(
                        trackId: manifest.trackId,
                        surface: "ios",
                        title: manifest.title,
                        artist: manifest.artist,
                        artworkUrl: manifest.artworkUrl,
                        licenseValidUntil: manifest.licenseValidUntil,
                        downloadedAt: self.isoNow(),
                        bytes: bytes,
                        fileName: destination.lastPathComponent
                    )
                    var records = try self.loadRecords()
                    records[manifest.trackId] = record
                    try self.saveRecords(records)
                    self.resolve(call, ["item": self.itemPayload(record)])
                } catch {
                    self.reject(call, error.localizedDescription)
                }
            }
        }.resume()
    }

    private func itemPayload(_ record: Record) -> [String: Any] {
        let fileExists = FileManager.default.fileExists(atPath: mediaURL(record.trackId).path)
        let valid = parseISO(record.licenseValidUntil).map { $0 > Date() } ?? false
        let state = !fileExists ? "failed" : valid ? "ready" : "expired"
        var item: [String: Any] = [
            "trackId": record.trackId,
            "surface": "ios",
            "title": record.title,
            "artist": record.artist,
            "licenseValidUntil": record.licenseValidUntil,
            "downloadedAt": record.downloadedAt,
            "bytes": record.bytes,
            "state": state,
        ]
        if let artworkUrl = record.artworkUrl { item["artworkUrl"] = artworkUrl }
        return item
    }

    private func offlineDirectory() throws -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        var directory = base.appendingPathComponent("BVSOffline", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try? directory.setResourceValues(values)
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: directory.path
        )
        return directory
    }

    private func mediaURL(_ trackId: String, directory: URL? = nil) -> URL {
        let base = directory ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("BVSOffline", isDirectory: true)
        return base.appendingPathComponent("\(trackId).media", isDirectory: false)
    }

    private func metadataURL() throws -> URL {
        try offlineDirectory().appendingPathComponent("records.json", isDirectory: false)
    }

    private func loadRecords() throws -> [String: Record] {
        let url = try metadataURL()
        guard FileManager.default.fileExists(atPath: url.path) else { return [:] }
        return try JSONDecoder().decode([String: Record].self, from: Data(contentsOf: url))
    }

    private func saveRecords(_ records: [String: Record]) throws {
        let url = try metadataURL()
        let data = try JSONEncoder().encode(records)
        try data.write(to: url, options: .atomic)
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
            ofItemAtPath: url.path
        )
    }

    private func resolve(_ call: CAPPluginCall, _ payload: PluginCallResultData) {
        DispatchQueue.main.async { call.resolve(payload) }
    }

    private func reject(_ call: CAPPluginCall, _ message: String) {
        DispatchQueue.main.async { call.reject(message) }
    }

    private func offlineError(_ message: String) -> NSError {
        NSError(domain: "BvsOfflineMedia", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func isUUID(_ value: String) -> Bool {
        UUID(uuidString: value)?.uuidString.lowercased() == value.lowercased()
    }

    private func parseISO(_ value: String) -> Date? {
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = fractional.date(from: value) { return date }
        let standard = ISO8601DateFormatter()
        standard.formatOptions = [.withInternetDateTime]
        return standard.date(from: value)
    }

    private func isoNow() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }
}

@objc(BVSBridgeViewController)
class BVSBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(BvsOfflineMediaPlugin())
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Allow HTML5 / WebView audio to continue when the screen locks (radio use case).
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback,
                mode: .default,
                options: [.allowAirPlay, .allowBluetooth]
            )
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Non-fatal: playback still works while app is foregrounded.
            print("AVAudioSession setup failed: \(error)")
        }
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}

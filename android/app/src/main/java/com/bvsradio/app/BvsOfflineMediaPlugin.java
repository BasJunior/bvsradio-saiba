package com.bvsradio.app;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URL;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.net.ssl.HttpsURLConnection;

@CapacitorPlugin(name = "BvsOfflineMedia")
public class BvsOfflineMediaPlugin extends Plugin {
    private static final String PREFS = "bvs_offline_media";
    private static final String RECORDS = "records";
    private static final long MAX_MEDIA_BYTES = 2L * 1024L * 1024L * 1024L;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private static final class ManifestData {
        String trackId;
        String title;
        String artist;
        String artworkUrl;
        String downloadUrl;
        String downloadUrlExpiresAt;
        String licenseValidUntil;
    }

    @PluginMethod
    public void download(PluginCall call) {
        final ManifestData manifest;
        try {
            manifest = validateManifest(call.getObject("manifest"));
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage());
            return;
        }
        executor.execute(() -> {
            try {
                JSONObject record = downloadAndPersist(manifest);
                resolve(call, itemResponse(record));
            } catch (Exception error) {
                reject(call, safeMessage(error, "Download failed."));
            }
        });
    }

    @PluginMethod
    public void renew(PluginCall call) {
        final ManifestData manifest;
        try {
            manifest = validateManifest(call.getObject("manifest"));
        } catch (IllegalArgumentException error) {
            call.reject(error.getMessage());
            return;
        }
        executor.execute(() -> {
            try {
                JSONObject records = loadRecords();
                JSONObject existing = records.optJSONObject(manifest.trackId);
                File file = mediaFile(manifest.trackId);
                if (existing == null || !file.isFile()) {
                    resolve(call, itemResponse(downloadAndPersist(manifest)));
                    return;
                }
                existing.put("title", manifest.title);
                existing.put("artist", manifest.artist);
                existing.put("artworkUrl", manifest.artworkUrl == null ? JSONObject.NULL : manifest.artworkUrl);
                existing.put("licenseValidUntil", manifest.licenseValidUntil);
                existing.put("surface", "android");
                records.put(manifest.trackId, existing);
                saveRecords(records);
                resolve(call, itemResponse(existing));
            } catch (Exception error) {
                reject(call, safeMessage(error, "Renewal failed."));
            }
        });
    }

    @PluginMethod
    public void list(PluginCall call) {
        executor.execute(() -> {
            try {
                JSONObject records = loadRecords();
                JSArray items = new JSArray();
                Iterator<String> keys = records.keys();
                while (keys.hasNext()) {
                    JSONObject record = records.optJSONObject(keys.next());
                    if (record != null) items.put(item(record));
                }
                JSObject response = new JSObject();
                response.put("items", items);
                resolve(call, response);
            } catch (Exception error) {
                reject(call, safeMessage(error, "Offline library is unavailable."));
            }
        });
    }

    @PluginMethod
    public void status(PluginCall call) {
        String trackId = call.getString("trackId", "");
        if (!validTrackId(trackId)) {
            call.reject("A valid track is required.");
            return;
        }
        executor.execute(() -> {
            try {
                JSONObject record = loadRecords().optJSONObject(trackId);
                JSObject response = new JSObject();
                response.put("item", record == null ? JSONObject.NULL : item(record));
                resolve(call, response);
            } catch (Exception error) {
                reject(call, safeMessage(error, "Offline status is unavailable."));
            }
        });
    }

    @PluginMethod
    public void playbackSource(PluginCall call) {
        String trackId = call.getString("trackId", "");
        if (!validTrackId(trackId)) {
            call.reject("A valid track is required.");
            return;
        }
        executor.execute(() -> {
            try {
                JSONObject record = loadRecords().optJSONObject(trackId);
                File file = mediaFile(trackId);
                if (record == null || !file.isFile()) {
                    reject(call, "This offline recording is no longer stored on this device.");
                    return;
                }
                if (parseIso(record.optString("licenseValidUntil", "")) <= System.currentTimeMillis()) {
                    reject(call, "Offline rights need revalidation before playback.");
                    return;
                }
                JSObject response = new JSObject();
                response.put("item", item(record));
                response.put("uri", file.toURI().toString());
                resolve(call, response);
            } catch (Exception error) {
                reject(call, safeMessage(error, "Offline playback is unavailable."));
            }
        });
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String trackId = call.getString("trackId", "");
        if (!validTrackId(trackId)) {
            call.reject("A valid track is required.");
            return;
        }
        executor.execute(() -> {
            try {
                File media = mediaFile(trackId);
                if (media.exists() && !media.delete()) throw new IOException("Could not remove private media.");
                JSONObject records = loadRecords();
                records.remove(trackId);
                saveRecords(records);
                resolve(call, new JSObject());
            } catch (Exception error) {
                reject(call, safeMessage(error, "Removal failed."));
            }
        });
    }

    private ManifestData validateManifest(JSObject raw) {
        if (raw == null) throw new IllegalArgumentException("A download manifest is required.");
        if (raw.optInt("version", 0) != 1) throw new IllegalArgumentException("Unsupported download manifest.");
        if (!"android".equals(raw.optString("surface", ""))) throw new IllegalArgumentException("This download was not cleared for Android.");
        if (!"app-private".equals(raw.optString("storagePolicy", ""))) throw new IllegalArgumentException("Private storage is required.");
        if (raw.optBoolean("exportAllowed", true)) throw new IllegalArgumentException("Exportable media is not accepted.");
        if (!raw.optBoolean("requiresRevalidation", false)) throw new IllegalArgumentException("Rights revalidation is required.");

        ManifestData manifest = new ManifestData();
        manifest.trackId = raw.optString("trackId", "").trim();
        manifest.title = raw.optString("title", "").trim();
        manifest.artist = raw.optString("artist", "").trim();
        manifest.artworkUrl = raw.isNull("artworkUrl") ? null : raw.optString("artworkUrl", null);
        manifest.downloadUrl = raw.optString("downloadUrl", "").trim();
        manifest.downloadUrlExpiresAt = raw.optString("downloadUrlExpiresAt", "").trim();
        manifest.licenseValidUntil = raw.optString("licenseValidUntil", "").trim();

        if (!validTrackId(manifest.trackId) || manifest.title.isEmpty() || manifest.artist.isEmpty()) {
            throw new IllegalArgumentException("The download manifest is incomplete.");
        }
        try {
            URL url = new URL(manifest.downloadUrl);
            if (!"https".equalsIgnoreCase(url.getProtocol())) throw new IllegalArgumentException("Secure media URL required.");
        } catch (IOException error) {
            throw new IllegalArgumentException("Secure media URL required.");
        }
        long now = System.currentTimeMillis();
        if (parseIso(manifest.downloadUrlExpiresAt) <= now) throw new IllegalArgumentException("The download link has expired.");
        if (parseIso(manifest.licenseValidUntil) <= now) throw new IllegalArgumentException("The offline licence has expired.");
        return manifest;
    }

    private JSONObject downloadAndPersist(ManifestData manifest) throws Exception {
        File directory = offlineDirectory();
        File temporary = File.createTempFile(manifest.trackId + "-", ".part", directory);
        File destination = mediaFile(manifest.trackId);
        long written = 0;
        HttpsURLConnection connection = null;
        try {
            URL url = new URL(manifest.downloadUrl);
            connection = (HttpsURLConnection) url.openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "audio/*,application/octet-stream;q=0.9,*/*;q=0.1");
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new IOException("Media server returned " + status + ".");
            URL finalUrl = connection.getURL();
            if (finalUrl == null || !"https".equalsIgnoreCase(finalUrl.getProtocol())) throw new IOException("Insecure media redirect blocked.");
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_MEDIA_BYTES) throw new IOException("Media file exceeds the offline limit.");
            try (BufferedInputStream input = new BufferedInputStream(connection.getInputStream());
                 BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(temporary))) {
                byte[] buffer = new byte[64 * 1024];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    written += count;
                    if (written > MAX_MEDIA_BYTES) throw new IOException("Media file exceeds the offline limit.");
                    output.write(buffer, 0, count);
                }
                output.flush();
            }
            if (destination.exists() && !destination.delete()) throw new IOException("Could not replace private media.");
            if (!temporary.renameTo(destination)) {
                copyFile(temporary, destination);
                if (!temporary.delete()) temporary.deleteOnExit();
            }

            JSONObject record = new JSONObject();
            record.put("trackId", manifest.trackId);
            record.put("surface", "android");
            record.put("title", manifest.title);
            record.put("artist", manifest.artist);
            record.put("artworkUrl", manifest.artworkUrl == null ? JSONObject.NULL : manifest.artworkUrl);
            record.put("licenseValidUntil", manifest.licenseValidUntil);
            record.put("downloadedAt", isoNow());
            record.put("bytes", destination.length());
            record.put("fileName", destination.getName());
            JSONObject records = loadRecords();
            records.put(manifest.trackId, record);
            saveRecords(records);
            return record;
        } finally {
            if (connection != null) connection.disconnect();
            if (temporary.exists()) temporary.delete();
        }
    }

    private JSObject itemResponse(JSONObject record) throws JSONException {
        JSObject response = new JSObject();
        response.put("item", item(record));
        return response;
    }

    private JSObject item(JSONObject record) throws JSONException {
        JSObject out = new JSObject();
        String trackId = record.optString("trackId", "");
        String licenseValidUntil = record.optString("licenseValidUntil", "");
        File file = mediaFile(trackId);
        String state;
        if (!file.isFile()) state = "failed";
        else if (parseIso(licenseValidUntil) <= System.currentTimeMillis()) state = "expired";
        else state = "ready";
        out.put("trackId", trackId);
        out.put("surface", "android");
        out.put("title", record.optString("title", ""));
        out.put("artist", record.optString("artist", ""));
        if (!record.isNull("artworkUrl")) out.put("artworkUrl", record.optString("artworkUrl", ""));
        out.put("licenseValidUntil", licenseValidUntil);
        out.put("downloadedAt", record.optString("downloadedAt", ""));
        out.put("bytes", record.optLong("bytes", file.exists() ? file.length() : 0));
        out.put("state", state);
        return out;
    }

    private File offlineDirectory() throws IOException {
        File directory = new File(getContext().getFilesDir(), "bvs-offline");
        if (!directory.exists() && !directory.mkdirs()) throw new IOException("Private media directory is unavailable.");
        return directory;
    }

    private File mediaFile(String trackId) {
        return new File(new File(getContext().getFilesDir(), "bvs-offline"), trackId + ".media");
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private JSONObject loadRecords() {
        String encoded = preferences().getString(RECORDS, "{}");
        try { return new JSONObject(encoded == null ? "{}" : encoded); }
        catch (JSONException ignored) { return new JSONObject(); }
    }

    private void saveRecords(JSONObject records) throws IOException {
        if (!preferences().edit().putString(RECORDS, records.toString()).commit()) {
            throw new IOException("Could not persist offline metadata.");
        }
    }

    private static boolean validTrackId(String trackId) {
        try { return trackId != null && UUID.fromString(trackId).toString().equalsIgnoreCase(trackId); }
        catch (Exception ignored) { return false; }
    }

    private static long parseIso(String value) {
        if (value == null || value.isEmpty()) return 0;
        String[] patterns = {"yyyy-MM-dd'T'HH:mm:ss.SSSX", "yyyy-MM-dd'T'HH:mm:ssX"};
        for (String pattern : patterns) {
            try {
                SimpleDateFormat format = new SimpleDateFormat(pattern, Locale.US);
                format.setLenient(false);
                format.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date date = format.parse(value);
                if (date != null) return date.getTime();
            } catch (ParseException ignored) {}
        }
        return 0;
    }

    private static String isoNow() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }

    private static void copyFile(File source, File destination) throws IOException {
        try (BufferedInputStream input = new BufferedInputStream(new FileInputStream(source));
             BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(destination))) {
            byte[] buffer = new byte[64 * 1024];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            output.flush();
        }
    }

    private void resolve(PluginCall call, JSObject payload) {
        getActivity().runOnUiThread(() -> call.resolve(payload));
    }

    private void reject(PluginCall call, String message) {
        getActivity().runOnUiThread(() -> call.reject(message));
    }

    private static String safeMessage(Exception error, String fallback) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? fallback : message;
    }
}

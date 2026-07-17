#!/usr/bin/env ruby
# frozen_string_literal: true
# Run on Mac only (needs local AuthKey_*.p8 + ASC_ISSUER_ID).
# Usage:
#   export ASC_ISSUER_ID=...
#   export ASC_KEY_PATH=~/Desktop/saibagrok/AuthKey_JC3GYXWG8N.p8
#   export ASC_KEY_ID=JC3GYXWG8N
#   ruby ops/store-launch/scripts/asc_submit_review.rb

require "openssl"
require "base64"
require "json"
require "net/http"
require "uri"
require "time"

KEY_PATH = ENV.fetch("ASC_KEY_PATH", File.expand_path("~/Desktop/saibagrok/AuthKey_JC3GYXWG8N.p8"))
KEY_ID = ENV.fetch("ASC_KEY_ID", "JC3GYXWG8N")
ISSUER_ID = ENV.fetch("ASC_ISSUER_ID")
BUNDLE_ID = "com.bvsradio.app"
APP_APPLE_ID = ENV.fetch("ASC_APP_ID", "6792035284")

def b64url(data)
  Base64.urlsafe_encode64(data).delete("=")
end

def make_jwt(key_path, key_id, issuer_id)
  private_key = OpenSSL::PKey.read(File.read(key_path))
  header = b64url({ alg: "ES256", kid: key_id, typ: "JWT" }.to_json)
  now = Time.now.to_i
  payload = b64url({
    iss: issuer_id,
    iat: now,
    exp: now + 15 * 60,
    aud: "appstoreconnect-v1"
  }.to_json)
  signing_input = "#{header}.#{payload}"
  der = private_key.dsa_sign_asn1(OpenSSL::Digest::SHA256.digest(signing_input))
  asn1 = OpenSSL::ASN1.decode(der)
  r = asn1.value[0].value.to_s(2).rjust(32, "\x00")[-32..]
  s = asn1.value[1].value.to_s(2).rjust(32, "\x00")[-32..]
  "#{signing_input}.#{b64url(r + s)}"
end

class ASC
  def initialize(jwt)
    @jwt = jwt
  end

  def request(method, path, body = nil)
    uri = URI("https://api.appstoreconnect.apple.com#{path}")
    klass = {
      get: Net::HTTP::Get,
      post: Net::HTTP::Post,
      patch: Net::HTTP::Patch
    }.fetch(method)
    req = klass.new(uri)
    req["Authorization"] = "Bearer #{@jwt}"
    req["Content-Type"] = "application/json"
    req.body = JSON.generate(body) if body
    res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |h| h.request(req) }
    parsed = res.body.to_s.empty? ? {} : JSON.parse(res.body)
    [res.code.to_i, parsed]
  end

  def get(path) = request(:get, path)
  def post(path, body) = request(:post, path, body)
  def patch(path, body) = request(:patch, path, body)
end

def die!(msg)
  warn "ERROR: #{msg}"
  exit 1
end

die!("Missing key file: #{KEY_PATH}") unless File.file?(KEY_PATH)

api = ASC.new(make_jwt(KEY_PATH, KEY_ID, ISSUER_ID))

# Resolve app
code, data = api.get("/v1/apps?filter[bundleId]=#{BUNDLE_ID}")
die!("List apps failed #{code}: #{data}") unless code == 200
app = (data["data"] || []).first
die!("No app for #{BUNDLE_ID}") unless app
app_id = app["id"]
puts "App: #{app.dig('attributes', 'name')} id=#{app_id}"

# Latest valid build
code, data = api.get("/v1/builds?filter[app]=#{app_id}&filter[processingState]=VALID&sort=-uploadedDate&limit=5")
die!("List builds failed #{code}: #{data}") unless code == 200
build = (data["data"] || []).first
die!("No VALID build to submit") unless build
build_id = build["id"]
ver = build.dig("attributes", "version")
puts "Build: id=#{build_id} version=#{ver} state=#{build.dig('attributes', 'processingState')}"

# App Store versions (prefer EDITABLE / PREPARE_FOR_SUBMISSION)
code, data = api.get("/v1/apps/#{app_id}/appStoreVersions?limit=10")
die!("List versions failed #{code}: #{data}") unless code == 200
versions = data["data"] || []
version = versions.find { |v|
  %w[PREPARE_FOR_SUBMISSION READY_FOR_REVIEW REJECTED DEVELOPER_REJECTED].include?(v.dig("attributes", "appStoreState"))
}
version ||= versions.find { |v| v.dig("attributes", "versionString") == "1.0" }

if version.nil?
  code, data = api.post("/v1/appStoreVersions", {
    data: {
      type: "appStoreVersions",
      attributes: {
        platform: "IOS",
        versionString: "1.0"
      },
      relationships: {
        app: { data: { type: "apps", id: app_id } }
      }
    }
  })
  die!("Create version failed #{code}: #{data}") unless [200, 201].include?(code)
  version = data["data"]
  puts "Created appStoreVersion #{version['id']}"
else
  puts "Using appStoreVersion #{version['id']} state=#{version.dig('attributes', 'appStoreState')}"
end

version_id = version["id"]

# Attach build
code, data = api.patch("/v1/appStoreVersions/#{version_id}/relationships/build", {
  data: { type: "builds", id: build_id }
})
# Some API shapes use different path — try alternate if fails
if code >= 400
  code, data = api.patch("/v1/appStoreVersions/#{version_id}", {
    data: {
      type: "appStoreVersions",
      id: version_id,
      relationships: {
        build: { data: { type: "builds", id: build_id } }
      }
    }
  })
end
puts "Attach build → HTTP #{code}"
puts JSON.pretty_generate(data) if code >= 400

# Create review submission (App Store Connect API v1)
code, data = api.post("/v1/reviewSubmissions", {
  data: {
    type: "reviewSubmissions",
    attributes: { platform: "IOS" },
    relationships: {
      app: { data: { type: "apps", id: app_id } }
    }
  }
})
puts "Create reviewSubmission → HTTP #{code}"
if code >= 400
  warn JSON.pretty_generate(data)
  warn <<~TIP

    If metadata/screenshots are incomplete, finish in App Store Connect UI:
    https://appstoreconnect.apple.com/apps/#{APP_APPLE_ID}/appstore
    Required often: iPhone screenshots, privacy policy URL, age rating, content rights.
  TIP
  exit 1
end

submission_id = data.dig("data", "id")
puts "reviewSubmission id=#{submission_id}"

# Add version item
code, data = api.post("/v1/reviewSubmissionItems", {
  data: {
    type: "reviewSubmissionItems",
    relationships: {
      reviewSubmission: { data: { type: "reviewSubmissions", id: submission_id } },
      appStoreVersion: { data: { type: "appStoreVersions", id: version_id } }
    }
  }
})
puts "Add submission item → HTTP #{code}"
warn JSON.pretty_generate(data) if code >= 400

# Submit
code, data = api.patch("/v1/reviewSubmissions/#{submission_id}", {
  data: {
    type: "reviewSubmissions",
    id: submission_id,
    attributes: { submitted: true }
  }
})
puts "Submit → HTTP #{code}"
if code >= 400
  warn JSON.pretty_generate(data)
  exit 1
end

puts "SUCCESS: submitted for App Review (submission #{submission_id})"
puts "Track: https://appstoreconnect.apple.com/apps/#{APP_APPLE_ID}/appstore"

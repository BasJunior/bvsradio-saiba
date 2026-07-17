#!/usr/bin/env ruby
# frozen_string_literal: true

require "openssl"
require "base64"
require "json"
require "net/http"
require "uri"
require "time"

KEY_PATH = ENV.fetch("ASC_KEY_PATH", "/Users/abiaschivayo/Desktop/saibagrok/AuthKey_JC3GYXWG8N.p8")
KEY_ID = ENV.fetch("ASC_KEY_ID", "JC3GYXWG8N")
ISSUER_ID = ENV.fetch("ASC_ISSUER_ID")
BUNDLE_ID = "com.bvsradio.app"
APP_APPLE_ID = "6792035284"
GROUP_NAME = "Internal"
TESTER_EMAIL = ENV.fetch("ASC_TESTER_EMAIL", "abiasjnr@gmail.com")

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
  r = asn1.value[0].value.to_s(2)
  s = asn1.value[1].value.to_s(2)
  r = r.rjust(32, "\x00")[-32..]
  s = s.rjust(32, "\x00")[-32..]
  "#{signing_input}.#{b64url(r + s)}"
end

class ASC
  def initialize(jwt)
    @jwt = jwt
  end

  def request(method, path, body = nil)
    uri = URI("https://api.appstoreconnect.apple.com#{path}")
    klass = { get: Net::HTTP::Get, post: Net::HTTP::Post, patch: Net::HTTP::Patch, delete: Net::HTTP::Delete }[method]
    req = klass.new(uri)
    req["Authorization"] = "Bearer #{@jwt}"
    req["Content-Type"] = "application/json"
    req.body = JSON.generate(body) if body
    res = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |h| h.request(req) }
    parsed = res.body && !res.body.empty? ? JSON.parse(res.body) : {}
    [res.code.to_i, parsed]
  end

  def get(path) = request(:get, path)
  def post(path, body) = request(:post, path, body)
end

def die!(msg)
  warn "ERROR: #{msg}"
  exit 1
end

jwt = make_jwt(KEY_PATH, KEY_ID, ISSUER_ID)
api = ASC.new(jwt)

code, data = api.get("/v1/apps?filter[bundleId]=#{BUNDLE_ID}")
die!("Auth/list apps failed (#{code}): #{data}") unless code == 200
apps = data["data"] || []
die!("No app for #{BUNDLE_ID}") if apps.empty?
app = apps.first
app_id = app["id"]
puts "App: #{app.dig('attributes', 'name')} (#{app_id})"

# Builds for app
code, builds_data = api.get("/v1/builds?filter[app]=#{app_id}&sort=-uploadedDate&limit=5")
die!("List builds failed (#{code}): #{builds_data}") unless code == 200
builds = builds_data["data"] || []
die!("No builds found") if builds.empty?
build = builds.first
build_id = build["id"]
build_num = build.dig("attributes", "version")
proc_state = build.dig("attributes", "processingState")
puts "Build: id=#{build_id} version=#{build_num} processing=#{proc_state}"

# List beta groups
code, groups_data = api.get("/v1/betaGroups?filter[app]=#{app_id}")
die!("List groups failed (#{code}): #{groups_data}") unless code == 200
groups = groups_data["data"] || []
group = groups.find { |g| g.dig("attributes", "name") == GROUP_NAME }

if group
  group_id = group["id"]
  puts "Group exists: #{GROUP_NAME} (#{group_id})"
else
  code, created = api.post("/v1/betaGroups", {
    data: {
      type: "betaGroups",
      attributes: {
        name: GROUP_NAME,
        isInternalGroup: true,
        hasAccessToAllBuilds: true
      },
      relationships: {
        app: { data: { type: "apps", id: app_id } }
      }
    }
  })
  die!("Create group failed (#{code}): #{created}") unless [200, 201].include?(code)
  group_id = created.dig("data", "id")
  puts "Created group: #{GROUP_NAME} (#{group_id})"
end

# Assign build to group
code, rel = api.post("/v1/betaGroups/#{group_id}/relationships/builds", {
  data: [{ type: "builds", id: build_id }]
})
if [200, 201, 204].include?(code)
  puts "Assigned build #{build_num} to group #{GROUP_NAME}"
elsif code == 409
  puts "Build already assigned to group (409) — OK"
else
  warn "Assign build response (#{code}): #{rel}"
end

# Find or invite beta tester
code, testers_data = api.get("/v1/betaTesters?filter[email]=#{URI.encode_www_form_component(TESTER_EMAIL)}&filter[apps]=#{app_id}")
testers = (code == 200 ? (testers_data["data"] || []) : [])
tester = testers.first

if tester
  tester_id = tester["id"]
  puts "Tester found: #{TESTER_EMAIL} (#{tester_id})"
else
  # Try create beta tester linked to group
  code, created_t = api.post("/v1/betaTesters", {
    data: {
      type: "betaTesters",
      attributes: {
        email: TESTER_EMAIL,
        firstName: "Abias",
        lastName: "Chivayo"
      },
      relationships: {
        betaGroups: { data: [{ type: "betaGroups", id: group_id }] },
        apps: { data: [{ type: "apps", id: app_id }] }
      }
    }
  })
  if [200, 201].include?(code)
    tester_id = created_t.dig("data", "id")
    puts "Created/invited tester: #{TESTER_EMAIL} (#{tester_id})"
  else
    # Internal testers must already be App Store Connect users
    warn "Create tester failed (#{code}): #{created_t}"
    warn "For INTERNAL groups, tester must already be in Users and Access."
    # Add existing users who are on the team
    code, users = api.get("/v1/users?limit=50")
    if code == 200
      (users["data"] || []).each do |u|
        email = u.dig("attributes", "username") || u.dig("attributes", "email")
        puts "  ASC user: #{email} roles=#{u.dig('attributes', 'roles')}"
      end
    end
  end
end

if tester_id
  code, _ = api.post("/v1/betaGroups/#{group_id}/relationships/betaTesters", {
    data: [{ type: "betaTesters", id: tester_id }]
  })
  if [200, 201, 204].include?(code)
    puts "Linked tester to group"
  elsif code == 409
    puts "Tester already in group — OK"
  else
    # try alternate
    warn "Link tester response may be non-critical"
  end
end

# Export compliance if needed
code, build_full = api.get("/v1/builds/#{build_id}")
uses_non_exempt = build_full.dig("data", "attributes", "usesNonExemptEncryption")
puts "usesNonExemptEncryption=#{uses_non_exempt.inspect}"
if uses_non_exempt.nil?
  code, patched = api.patch("/v1/builds/#{build_id}", {
    data: {
      type: "builds",
      id: build_id,
      attributes: { usesNonExemptEncryption: false }
    }
  }) if api.respond_to?(:patch)
end

# PATCH helper
code, patched = begin
  uri_path = "/v1/builds/#{build_id}"
  body = {
    data: {
      type: "builds",
      id: build_id,
      attributes: { usesNonExemptEncryption: false }
    }
  }
  api.request(:patch, uri_path, body)
end
puts "Export compliance patch: #{code} #{patched.is_a?(Hash) && patched['errors'] ? patched['errors'] : 'ok'}"

puts "DONE"
puts "Install via TestFlight on iPhone signed in as #{TESTER_EMAIL}"
puts "https://appstoreconnect.apple.com/apps/#{APP_APPLE_ID}/testflight/ios"

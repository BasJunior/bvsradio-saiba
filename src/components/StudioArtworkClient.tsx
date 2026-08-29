"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ArtworkChangeRequestForm from "@/components/ArtworkChangeRequestForm";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export default function StudioArtworkClient() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Account service is not configured.");
      return;
    }
    void createClient().auth.getSession().then(({ data }) => {
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Sign in with your creator account.");
        return;
      }
      setToken(accessToken);
    }).catch(() => setError("Could not open artwork tools."));
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p>{error}</p>
        <Link href="/auth/login?next=/creator/studio/artwork" className="mt-4 inline-flex min-h-11 items-center rounded-full border border-red-200/30 px-4 py-2">
          Sign in
        </Link>
      </div>
    );
  }

  if (!token) return <p className="text-sm text-text-secondary">Opening artwork tools…</p>;

  return (
    <div className="space-y-8">
      <ArtworkChangeRequestForm
        token={token}
        scope="releases"
        heading="Change release cover artwork"
        copy="Choose one of your tracks or releases, upload the replacement cover, and send it to BVS editorial. The current artwork stays live until the replacement is approved."
        formId="studio-release-cover-change"
      />
      <ArtworkChangeRequestForm
        token={token}
        scope="beats"
        heading="Change beat or beat pack cover artwork"
        copy="Choose one of your beats or beat packs, upload the replacement cover, and send it to BVS editorial. The current artwork stays live until the replacement is approved. For a beat pack, you can also apply the approved cover to every beat in that pack."
        formId="studio-beat-cover-change"
      />
    </div>
  );
}

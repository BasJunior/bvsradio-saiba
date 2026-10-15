"use client";
import { useState } from "react";
import BeatCrateUploadForm from "@/components/BeatCrateUploadForm";
import LegacyBeatPackUploadForm from "@/components/LegacyBeatPackUploadForm";

export default function BeatPackUploadForm() {
  const [legacy, setLegacy] = useState(false);
  return (
    <div className="space-y-4">
      <BeatCrateUploadForm />
      <details
        onToggle={(event) => setLegacy(event.currentTarget.open)}
        className="border border-white/15 p-4"
      >
        <summary className="cursor-pointer text-sm">
          Continue an older beat-pack draft
        </summary>
        {legacy ? <LegacyBeatPackUploadForm /> : null}
      </details>
    </div>
  );
}

import Link from "next/link";
import MusicVideoSubmitForm from "@/components/MusicVideoSubmitForm";
import StudioCreateAnalytics from "@/components/StudioCreateAnalytics";

export default function CreateMusicVideoPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 pb-20 pt-10 sm:px-6 sm:pt-12">
      <StudioCreateAnalytics intent="music_video" />
      <Link href="/creator/studio" className="inline-flex min-h-11 items-center text-sm text-brand">
        ← Studio
      </Link>
      <p className="mt-8 text-xs font-semibold uppercase tracking-[.22em] text-brand">Create · Music video</p>
      <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Upload a music video</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
        After editorial approval, listeners can choose <strong className="text-white">Watch</strong> while
        your track is on. Radio audio stays in continuous rotation — the next song always continues when
        the current track ends, whether or not someone opened the video.
      </p>
      <div className="mt-8 overflow-x-hidden rounded-3xl border border-white/10 bg-white/[.02] p-5 sm:p-6">
        <MusicVideoSubmitForm />
      </div>
    </main>
  );
}

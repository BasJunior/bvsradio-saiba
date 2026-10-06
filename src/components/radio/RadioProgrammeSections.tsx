import CreatorPortraitRail from "@/components/home/CreatorPortraitRail";
import { getPublicProgrammes } from "@/lib/station-content";
import type { Show } from "@/lib/station";

const dayOrder: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function nextOccurrence(show: Show) {
  const [dayLabel = "", timeLabel = ""] = show.schedule.split(" · ");
  const day = dayOrder[dayLabel.trim().toLowerCase()];
  const match = timeLabel.match(/(\d{1,2}):(\d{2})/);
  if (day === undefined || !match) return Number.POSITIVE_INFINITY;

  const nowParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Harare",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) => nowParts.find((part) => part.type === type)?.value || "";
  const currentDay = dayOrder[get("weekday").toLowerCase()] ?? 0;
  const currentMinutes = Number(get("hour") || 0) * 60 + Number(get("minute") || 0);
  const showMinutes = Number(match[1]) * 60 + Number(match[2]);
  let deltaDays = (day - currentDay + 7) % 7;
  if (deltaDays === 0 && showMinutes <= currentMinutes) deltaDays = 7;
  return deltaDays * 24 * 60 + showMinutes - currentMinutes;
}

export default async function RadioProgrammeSections() {
  const shows = await getPublicProgrammes();
  const upcoming = shows
    .filter((show) => Number.isFinite(nextOccurrence(show)))
    .sort((a, b) => nextOccurrence(a) - nextOccurrence(b));
  const programmeItems = [
    { id: "station", name: "BVS Continuous Rotation", image: "/images/editorial/radio-studio-harare.webp", href: "#radio-on-air", detail: "The station · Press play above to listen" },
    ...upcoming.map((show, index) => ({ id: show.slug, name: show.title, image: show.image, href: `/shows/${show.slug}`, detail: `${index === 0 ? "Next scheduled" : "Later"} · ${show.schedule} · ${show.host}` })),
  ];

  return <>
    <div id="radio-coming-up" className="mt-12 scroll-mt-28">
      <CreatorPortraitRail title="On the programme" kicker="Schedule · Times in CAT unless stated" tone="charcoal" allHref="/radio/schedule" allLabel="Full schedule" items={programmeItems} />
    </div>
    <div id="radio-shows" className="scroll-mt-28">
      <CreatorPortraitRail title="Shows" kicker="More voices. More stories." tone="ink" allHref="/shows" items={shows.map(show => ({ id: show.slug, name: show.title, image: show.image, href: `/shows/${show.slug}`, detail: `${show.schedule}${show.tagline ? ` · ${show.tagline}` : ""}` }))} emptyMessage="Published shows will appear here. In the meantime, explore the station rotation." />
    </div>
  </>;
}

import { answerAskBvs, type AskBvsClientContext, type AskBvsClientItem } from "@/lib/ask-bvs-flow";
import { NextResponse } from "next/server";

type Link = { label: string; href: string };
type Answer = { reply: string; links: Link[]; mode?: "ai" | "guide" };
type Topic = { words: string[]; answer: Omit<Answer, "mode"> };

const topics: Topic[] = [
  {
    words: ["lyrics", "lyric", "write", "writing", "songwriting", "song idea", "blank page"],
    answer: {
      reply: "Lyrics Pad is BVS’s private writing space. Sign in to start a blank pad for free, return to existing songs, or write with a beat already licensed to your account.",
      links: [{ label: "Open Lyrics Pad", href: "/lyrics" }, { label: "Your Library", href: "/library" }],
    },
  },
  {
    words: ["playlist", "library", "liked", "saved", "favourite", "favorite", "following", "history", "recent"],
    answer: {
      reply: "Your BVS Library keeps the music and creator activity you want to return to: liked music, playlists, follows, recent listening, saved beats and licensed beats.",
      links: [{ label: "Open Library", href: "/library" }, { label: "Playlists", href: "/library?section=playlists" }],
    },
  },
  {
    words: ["beatstore", "beat", "beats", "licence", "license", "lease", "producer"],
    answer: {
      reply: "Use BeatStore to discover producer work and licensing options. Beats you save return to Library, and completed BVS beat licences can be used with Lyrics Pad.",
      links: [{ label: "Open BeatStore", href: "/catalogue?type=beat#beatstore" }, { label: "Saved & licensed beats", href: "/library?section=licensed-beats" }, { label: "Lyrics Pad", href: "/lyrics" }],
    },
  },
  {
    words: ["creator studio", "creator", "release", "submit", "upload", "artist", "publish", "editorial"],
    answer: {
      reply: "Creator Studio is the main BVS workspace for creator actions and release progress. If you are ready to send music for review, use the submission flow.",
      links: [{ label: "Creator Studio", href: "/creator/studio" }, { label: "Submit music", href: "/upload" }],
    },
  },
  {
    words: ["listen", "radio", "live", "stream", "play", "now playing"],
    answer: {
      reply: "Start with BVS Radio for the current rotation, then save what catches you so it stays in your Library.",
      links: [{ label: "Listen now", href: "/radio" }, { label: "Your Library", href: "/library" }],
    },
  },
  {
    words: ["discover", "search", "find music", "find artist", "catalogue", "catalog", "album"],
    answer: {
      reply: "Explore BVS to find music, artists and creators, or browse the wider catalogue when you want to go deeper.",
      links: [{ label: "Explore BVS", href: "/search" }, { label: "Browse catalogue", href: "/catalogue" }],
    },
  },
  {
    words: ["show", "shows", "room", "rooms", "programme", "program", "conversation"],
    answer: {
      reply: "BVS Shows is where programmes, live energy and creator conversations live on the web.",
      links: [{ label: "Open Shows", href: "/shows" }],
    },
  },
  {
    words: ["marketplace", "mix", "master", "mixing", "mastering", "service", "services", "production", "engineer"],
    answer: {
      reply: "Use Creator Marketplace to find creator products and professional talent. Official BVS mixing, mastering and production services are available separately through BVS Studio Services.",
      links: [{ label: "Creator Marketplace", href: "/marketplace" }, { label: "BVS Studio Services", href: "/shop" }],
    },
  },
  {
    words: ["premium", "membership", "plan"],
    answer: {
      reply: "Ask BVS Premium requires an active paid membership, starting with the listener plan. Use the Premium button in this conversation to check access or view the offer. Premium Instant covers an individual release and does not include this access.",
      links: [{ label: "BVS Premium", href: "/premium" }],
    },
  },
  {
    words: ["login", "account", "register", "password", "sign in", "sign up", "join", "profile"],
    answer: {
      reply: "Use Account Centre for your BVS identity and account controls. If you are signed out, you can sign in or create a BVS account first.",
      links: [{ label: "Account Centre", href: "/account" }, { label: "Sign in", href: "/auth/login" }, { label: "Join BVS", href: "/auth/signup" }],
    },
  },
  {
    words: ["contact", "email", "support", "help", "advert", "partner", "press", "problem", "issue"],
    answer: {
      reply: "For something that needs a person — support, partnerships, advertising, press or an account-specific issue — contact the BVS team.",
      links: [{ label: "Contact BVS", href: "/contact" }],
    },
  },
  {
    words: ["about", "who are you", "what is bvs", "best virtual sound", "zimbabwe"],
    answer: {
      reply: "BVS stands for Best Virtual Sound. It brings independent music, radio, discovery and creator tools together—rooted in Zimbabwe and open to the world.",
      links: [{ label: "About BVS", href: "/about" }],
    },
  },
  {
    words: ["blog", "news", "article", "story", "stories"],
    answer: {
      reply: "BVS Stories covers music, production, culture and practical guidance for creators.",
      links: [{ label: "Read BVS Stories", href: "/blog" }],
    },
  },
];

const defaultAnswer: Omit<Answer, "mode"> = {
  reply: "What would you like to do: find something to listen to, look for a beat, or work on your own music? You can name an artist, genre or track to get started.",
  links: [{ label: "Explore BVS", href: "/search" }, { label: "Your Library", href: "/library" }, { label: "Contact BVS", href: "/contact" }],
};

function guideAnswer(message: string): Answer {
  const normalized = message.toLowerCase();
  const match = topics.find(({ words }) => words.some((word) => ` ${normalized.replace(/[^a-z0-9]+/g, " ")} `.includes(` ${word} `)));
  const answer = match?.answer ?? defaultAnswer;
  return { ...answer, links: answer.links.slice(0, 2), mode: "guide" };
}

function cleanContext(value: unknown): AskBvsClientContext {
  if (!value || typeof value !== "object") return {};
  const input = value as Record<string, unknown>;
  const cleanList = (key: "history" | "follows"): AskBvsClientItem[] => {
    const rows = Array.isArray(input[key]) ? input[key] : [];
    return rows.slice(0, 8).flatMap((value: unknown) => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      if (typeof row.title !== "string" || !row.title.trim()) return [];
      return [{
        title: row.title.trim().slice(0, 160),
        id: typeof row.id === "string" ? row.id.slice(0, 160) : undefined,
        kind: typeof row.kind === "string" ? row.kind.slice(0, 32) : undefined,
        subtitle: typeof row.subtitle === "string" ? row.subtitle.slice(0, 180) : undefined,
        href: typeof row.href === "string" ? row.href.slice(0, 500) : undefined,
      }];
    });
  };
  const previousResults = Array.isArray(input.previousResults) ? input.previousResults.slice(0, 6).flatMap(row => row && typeof row.id === "string" && typeof row.kind === "string" ? [{ id: row.id.slice(0, 160), kind: row.kind.slice(0, 32) }] : []) : [];
  const shownIds = Array.isArray(input.shownIds) ? input.shownIds.filter((id): id is string => typeof id === "string").slice(-40).map(id => id.slice(0, 200)) : [];
  return { history: cleanList("history"), follows: cleanList("follows"), previousResults, shownIds };
}

export async function POST(request: Request) {
  let message = "";
  let context: AskBvsClientContext = {};
  try {
    const body = (await request.json()) as { message?: unknown; path?: unknown; context?: unknown };
    message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    context = cleanContext(body.context);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!message) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  // Resolve help and product questions before catalogue scoring: ordinary words
  // such as “what” must not turn a capabilities question into a song match.
  const respond = (answer: Answer) => NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  if (/^(?:hi|hello|hey|thanks|thank you)[!.?\s]*$/i.test(message)) return respond({
    reply: /thank/i.test(message) ? "You’re welcome. What would you like to explore next?" : "Hi—tell me what you’re looking for. I can find BVS music and beats, suggest shows, or help you use the platform.",
    links: [], mode: "guide",
  });
  if (/\b(?:what can you do|what do you do|how can you help|what is ask bvs|who are you)\b/i.test(message)) return respond({
    reply: "I can find published BVS songs, beats, artists and shows, explain producer credits, and guide you through saving music or submitting a release. Try ‘find dark hip hop beats’, then ‘something slower’. Premium adds creative writing and production help when available.",
    links: [{ label: "Explore BVS", href: "/search" }], mode: "guide",
  });
  if (/\b(?:save|like|collect|bookmark)\b.*\b(?:song|track|music|beat)\b|\b(?:song|track|music|beat)\b.*\b(?:save|like|collect|bookmark)\b/i.test(message) && /^(?:how|where|can i|help)/i.test(message)) return respond({
    reply: "Use the heart or Save control on a song or beat to keep it in your Library. Sign in to keep your collection with your account, then open Library to return to it.",
    links: [{ label: "Open Library", href: "/library" }], mode: "guide",
  });
  if (/\b(?:premium|membership)\b/i.test(message)) return respond(guideAnswer("premium"));
  if (/^(how|where|open|can i|help me)\b/i.test(message) && /lyrics pad|playlist|library|creator studio|submit|upload|sign in|sign up|password|contact|mixing|mastering/i.test(message)) {
    return respond(guideAnswer(message));
  }

  try {
    const followUpdates = /(new|latest|happening|recent).*(follow|following)|(?:follow|following).*(new|latest|happening|recent)|creators i follow|people i follow/i.test(message);
    if (followUpdates) {
      const follows = (context.follows || []).slice(0, 5);
      const answers = await Promise.all(follows.map((follow) => answerAskBvs(`What's new from ${follow.title}?`)));
      const objects = answers.flatMap((answer) => answer.objects).filter((object, index, rows) => rows.findIndex((item) => item.id === object.id && item.kind === object.kind) === index).slice(0, 6);
      return NextResponse.json({
        reply: objects.length ? "Here’s the newest published BVS activity I could match from creators you follow." : follows.length ? "I couldn’t find recent published activity for the creators you follow." : "Follow a creator and I can bring their published activity back to you.",
        objects, links: [{ label: "Your Library", href: "/library" }], mode: "flow",
      }, { headers: { "Cache-Control": "no-store" } });
    }
    const answer = await answerAskBvs(message, context);
    if (answer.mode === "flow") return NextResponse.json(answer, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Ask BVS discovery unavailable", error instanceof Error ? error.message : error);
  }

  // Free discovery and navigation remain available without paid model calls.
  return NextResponse.json(guideAnswer(message), { headers: { "Cache-Control": "no-store" } });
}

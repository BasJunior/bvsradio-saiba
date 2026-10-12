/** First-party, deterministic ranking. Scores are heuristics, never probabilities. */
export const orchestrationCategories = ["followed_artists", "new_music", "live_shows", "creator_updates", "commerce", "community", "recommendations", "offers"] as const;
export type OrchestrationCategory = typeof orchestrationCategories[number];
export type NotificationCandidate = {
  id: string; category: OrchestrationCategory; eventType: string;
  entityKey: string; equivalentKey: string; deepLink: string;
  createdAt: string; expiresAt: string;
  importance: number; urgency: number; operational: boolean;
  eligible: boolean; actionCompleted: boolean; seen: boolean;
  /** Set only from a trusted backend media observation, never UI intent. */
  liveSignalAt?: string | null;
};
export type NotificationContact = {
  notificationId: string; category: OrchestrationCategory; equivalentKey: string;
  sentAt: string; openedAt?: string | null; operational: boolean;
};
export type NotificationContext = {
  preferences: Partial<Record<OrchestrationCategory, boolean>>;
  pushAllowed: boolean; quiet: boolean; holdout: boolean;
  affinities: Partial<Record<OrchestrationCategory, number>>;
  activeEntityKey?: string | null; activeAt?: string | null;
  contacts: NotificationContact[];
};
export type NotificationDecision = {
  id: string; action: "push" | "inbox" | "defer"; reason: string; score: number;
};
const day = 86400000;
const clamp = (n: number, low: number, high: number) => Number.isFinite(n) ? Math.min(high, Math.max(low, n)) : low;
function age(value: string | undefined | null, now: number) {
  const date = Date.parse(value || "");
  return Number.isFinite(date) ? now - date : Infinity;
}
export function rankNotifications(candidates: NotificationCandidate[], context: NotificationContext, now = Date.now()): NotificationDecision[] {
  // Count logical contacts, not installations/retries. One notification on two devices = one contact.
  const contactById = new Map<string, NotificationContact>();
  for (const contact of context.contacts) {
    const previous = contactById.get(contact.notificationId);
    if (!previous || Date.parse(contact.sentAt) > Date.parse(previous.sentAt)) {
      contactById.set(contact.notificationId, { ...contact, openedAt: contact.openedAt || previous?.openedAt });
    } else if (contact.openedAt && !previous.openedAt) {
      contactById.set(contact.notificationId, { ...previous, openedAt: contact.openedAt });
    }
  }
  const contacts = [...contactById.values()];
  const recent = contacts.filter(c => age(c.sentAt, now) >= 0 && age(c.sentAt, now) < 7 * day);
  const discretionary = recent.filter(c => !c.operational);
  const ranked = candidates.map(candidate => {
    const decision = (reason: string, action: NotificationDecision["action"] = "inbox", score = 0): NotificationDecision => ({ id: candidate.id, action, reason, score });
    if (!candidate.eligible) return decision("not_eligible");
    if (context.preferences[candidate.category] !== true) return decision("category_disabled");
    if (!context.pushAllowed) return decision("push_unavailable");
    if (!/^\/(?!\/)[^\\\s]*$/.test(candidate.deepLink) || /^\/(?:$|notifications$|start$|creator\/studio$|editorial$|app\/(?:ios|android)(?:\/(?:notifications|you))?$)/.test(candidate.deepLink.split(/[?#]/)[0])) return decision("missing_exact_destination");
    if (!Number.isFinite(Date.parse(candidate.expiresAt)) || age(candidate.expiresAt, now) >= 0 || age(candidate.createdAt, now) < 0 || !Number.isFinite(age(candidate.createdAt, now))) return decision("expired_or_invalid_time");
    if (candidate.actionCompleted || candidate.seen) return decision("already_handled");
    if (candidate.eventType === "live_started" && (age(candidate.liveSignalAt, now) < 0 || age(candidate.liveSignalAt, now) > 90000)) return decision("live_signal_unconfirmed");
    if (context.activeEntityKey === candidate.entityKey && age(context.activeAt, now) >= 0 && age(context.activeAt, now) < 120000) return decision("already_at_destination");
    if (recent.some(c => c.notificationId !== candidate.id && c.equivalentKey === candidate.equivalentKey && age(c.sentAt, now) < day)) return decision("equivalent_recently_sent");
    if (contacts.some(c => c.notificationId === candidate.id)) return decision("already_contacted");
    if (context.quiet) return decision("quiet_hours", "defer");
    if (!candidate.operational && context.holdout) return decision("holdout");
    if (!candidate.operational && (discretionary.filter(c => age(c.sentAt, now) < day).length >= 2 || discretionary.length >= 5)) return decision("frequency_cap", "defer");
    if (!candidate.operational && discretionary.some(c => age(c.sentAt, now) < 4 * 3600000)) return decision("contact_cooldown", "defer");
    const categoryContacts = recent.filter(c => c.category === candidate.category && age(c.sentAt, now) >= day);
    // Unopened is only an observed non-interaction, not proof the OS displayed or user ignored it.
    const opens = categoryContacts.filter(c => c.openedAt).length;
    const interaction = (opens + 1) / (categoryContacts.length + 2);
    const fatigue = categoryContacts.length >= 3 ? Math.max(.2, interaction) : 1;
    const affinity = clamp(context.affinities[candidate.category] ?? .5, .1, 2);
    const freshness = Math.max(.05, 1 - age(candidate.createdAt, now) / Math.max(1, Date.parse(candidate.expiresAt) - Date.parse(candidate.createdAt)));
    const score = clamp(candidate.importance, 0, 100) * affinity * freshness * (.5 + interaction) * clamp(candidate.urgency, 1, 2) * (candidate.operational ? 1 : fatigue);
    if (!candidate.operational && score < 12) return decision("low_relevance", "inbox", score);
    return decision("relevant_now", "push", score);
  });
  const byId = new Map(candidates.map(c => [c.id, c]));
  ranked.sort((a, b) => Number(byId.get(b.id)?.operational) - Number(byId.get(a.id)?.operational) || b.score - a.score || a.id.localeCompare(b.id));
  // One next-best reason per decision batch. Unselected events remain in the inbox.
  let selected = false;
  return ranked.map(d => {
    if (d.action !== "push") return d;
    if (selected) return { ...d, action: "defer", reason: "higher_value_candidate" };
    selected = true;
    return d;
  });
}

/** Legacy off switches are ceilings; finer preferences can never silently undo them. */
export function orchestrationPreferences(legacy: Record<string, boolean | undefined>, granular: Partial<Record<OrchestrationCategory, boolean>> = {}): Record<OrchestrationCategory, boolean> {
  const mapping: Record<OrchestrationCategory, string> = { followed_artists: "releases", new_music: "releases", live_shows: "shows", creator_updates: "creator_work", commerce: "orders", community: "community", recommendations: "marketing", offers: "marketing" };
  return Object.fromEntries(orchestrationCategories.map(c => [c, legacy[mapping[c]] === true && granular[c] !== false])) as Record<OrchestrationCategory, boolean>;
}

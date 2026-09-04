export function AppNavIcon({
  id,
  active,
}: {
  id: "home" | "explore" | "library" | "studio" | "you";
  active: boolean;
}) {
  const stroke = "currentColor";
  if (id === "home") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" />
      </svg>
    );
  }
  if (id === "explore") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <path strokeLinecap="round" d="m16 16 4 4" />
      </svg>
    );
  }
  if (id === "library") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={active ? "currentColor" : "none"} stroke={stroke} strokeWidth="1.8" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
      </svg>
    );
  }
  if (id === "studio") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8" aria-hidden="true">
        <rect x="4.5" y="4.5" width="15" height="15" rx="3.5" />
        <path strokeLinecap="round" d="M12 8.5v7M8.5 12h7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={stroke} strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="9" r="3.2" />
      <path strokeLinecap="round" d="M6.5 19.2a5.8 5.8 0 0 1 11 0" />
    </svg>
  );
}

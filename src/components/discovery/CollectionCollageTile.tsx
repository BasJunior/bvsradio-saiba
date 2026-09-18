import Image from "next/image";

export default function CollectionCollageTile({
  name,
  image,
  curator,
  itemCount,
  detail,
  active = false,
  onOpen,
}: {
  name: string;
  image: string;
  curator?: string;
  itemCount?: number;
  detail?: string;
  active?: boolean;
  onOpen: () => void;
}) {
  const remote = /^https?:\/\//i.test(image) || image.startsWith("/api/media/");
  const countLabel =
    typeof itemCount === "number" && itemCount > 0
      ? `${itemCount} ${itemCount === 1 ? "item" : "items"}`
      : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-[min(78vw,15rem)] shrink-0 snap-start text-left ${active ? "text-brand" : ""}`}
    >
      <div className="relative aspect-square overflow-hidden bg-black/30">
        <Image
          src={image}
          alt=""
          fill
          unoptimized={remote}
          sizes="240px"
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/35 via-transparent to-white/10" />
        {countLabel ? (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            {countLabel}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 truncate text-base font-semibold">{name}</h3>
      <p className="mt-0.5 truncate text-xs text-text-secondary">
        {curator ? `Curated by ${curator}` : detail || "BVS collection"}
        {countLabel && curator ? ` · ${countLabel}` : ""}
      </p>
    </button>
  );
}

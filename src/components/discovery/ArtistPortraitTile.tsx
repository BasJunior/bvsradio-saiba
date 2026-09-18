import Image from "next/image";
import Link from "next/link";

export default function ArtistPortraitTile({
  href,
  name,
  image,
  detail,
  tags,
}: {
  href: string;
  name: string;
  image: string;
  detail?: string;
  tags?: string[];
}) {
  return (
    <Link
      href={href}
      className="group w-[min(42vw,9.5rem)] shrink-0 snap-start text-center"
    >
      <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
        <Image
          src={image}
          alt={name}
          fill
          unoptimized={/^https?:\/\//i.test(image)}
          sizes="152px"
          className="object-cover object-center transition duration-300 group-hover:scale-[1.04]"
        />
      </div>
      <h3 className="mt-3 truncate text-sm font-semibold group-hover:text-brand">
        {name}
      </h3>
      {detail ? (
        <p className="truncate text-xs text-text-secondary">{detail}</p>
      ) : null}
      {tags?.length ? (
        <p className="mt-1 truncate text-[11px] text-brand/90">
          {tags.slice(0, 2).join(" · ")}
        </p>
      ) : null}
    </Link>
  );
}

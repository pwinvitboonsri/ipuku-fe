/* eslint-disable @next/next/no-img-element -- image_url is an arbitrary owner-pasted URL, so next/image remote patterns can't be known ahead */
import { glyphOf, itemTone } from "@/lib/tone";

// Product photo from image_url, or the design's colour-tinted tile with a glyph when there's none.
export function ItemPhoto({ id, name, imageUrl, size = "card" }: { id: string; name: string; imageUrl?: string | null; size?: "card" | "line" | "hero" }) {
  const color = itemTone(id);
  const glyph = glyphOf(name);

  if (size === "line") {
    return imageUrl ? (
      <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-[8px] object-cover" />
    ) : (
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] font-serif text-[18px] font-medium italic text-white"
        style={{ background: color, textShadow: "0 1px 2px rgba(0,0,0,0.18)" }}
      >
        {glyph}
      </div>
    );
  }

  const hero = size === "hero";
  return (
    <div className={`relative aspect-square w-full shrink-0 overflow-hidden ${hero ? "rounded-[14px]" : "rounded-[10px]"}`} style={{ background: color }}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 25%, rgba(255,255,255,${hero ? 0.25 : 0.22}), transparent 55%)` }} />
          <div
            className="absolute font-serif font-medium italic leading-none"
            style={{
              right: hero ? 14 : 10,
              bottom: hero ? 8 : 4,
              fontSize: hero ? 72 : 42,
              color: `rgba(255,255,255,${hero ? 0.85 : 0.82})`,
              textShadow: hero ? "0 2px 6px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.18)",
            }}
          >
            {glyph}
          </div>
        </>
      )}
    </div>
  );
}

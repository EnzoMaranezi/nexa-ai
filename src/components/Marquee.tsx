import { landingContent, useI18n } from "@/lib/i18n";

export function Marquee() {
  const { locale } = useI18n();
  const words = landingContent[locale].marqueeWords;
  const row = [...words, ...words, ...words, ...words];
  return (
    <div
      className="overflow-hidden border-y border-border py-8"
      aria-hidden
      role="presentation"
    >
      <div className="flex w-max animate-marquee items-center gap-14">
        {[0, 1].map((k) => (
          <div key={k} className="flex items-center gap-14">
            {row.map((w, i) => (
              <span key={`${k}-${i}`} className="flex items-center gap-14">
                <span className="text-3xl tracking-tight text-muted-foreground/50 md:text-5xl">
                  {w}
                </span>
                <span className="h-1 w-1 rounded-full bg-lime/60" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

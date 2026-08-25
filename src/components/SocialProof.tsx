import { Reveal } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function SocialProof() {
  const { locale, t } = useI18n();
  const marks = landingContent[locale].socialMarks;

  return (
    <section className="shell border-y border-border py-14">
      <Reveal>
        <p className="label-mono text-center">{t("landing.socialProofLabel")}</p>
        <ul className="mt-9 grid grid-cols-2 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {marks.map((m) => (
            <li
              key={m}
              className="text-center font-mono text-xs uppercase tracking-[0.22em] text-muted-foreground/70 transition-colors hover:text-foreground"
            >
              {m}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          {t("landing.socialProofBody")}
        </p>
      </Reveal>
    </section>
  );
}

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Plus } from "lucide-react";
import { Reveal, SectionLabel } from "./primitives";
import { landingContent, useI18n } from "@/lib/i18n";

export function FAQ() {
  const { locale, t } = useI18n();
  const faqs = landingContent[locale].faqs;
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="shell py-28 md:py-40">
      <div className="grid gap-14 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionLabel>FAQ</SectionLabel>
          <Reveal>
            <h2 className="display-sm mt-7 max-w-[10ch]">
              {t("landing.faqTitle")} <span className="editorial">{t("landing.faqHighlight")}</span>
            </h2>
          </Reveal>
        </div>

        <div className="lg:col-span-8">
          <ul className="border-t border-border">
            {faqs.map((f, i) => {
              const isOpen = open === i;
              return (
                <li key={f.q} className="border-b border-border">
                  <h3>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-6 py-6 text-left"
                    >
                      <span className={`text-lg tracking-tight transition-colors ${isOpen ? "text-lime" : ""}`}>
                        {f.q}
                      </span>
                      <Plus
                        className={`h-4 w-4 shrink-0 transition-transform duration-400 ${isOpen ? "rotate-45 text-lime" : "text-muted-foreground"}`}
                        aria-hidden
                      />
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-xl pb-7 text-sm leading-relaxed text-muted-foreground">
                          {f.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}

"use client";
import { motion, useReducedMotion } from "framer-motion";
import { Copy } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui-custom/Button";
import { routineTemplates, buildTemplateRoutine } from "@/data/routineTemplates";
import { uid } from "@/utils/id";
import type { Exercise } from "@/types/exercise";
import type { Routine } from "@/db/schema";

const templateImages: Record<string, string> = {
  "Push Day (PPL)": "/images/push-day.jpg",
  "Pull Day (PPL)": "/images/pull-day.jpg",
  "Legs Day (PPL)": "/images/legs-day.jpg",
  "Full Body Foundational": "/images/full-body.jpg",
};

interface PopularTemplatesProps {
  exercises: Exercise[];
  onSave: (routine: Routine) => void;
}

export default function PopularTemplates({ exercises, onSave }: PopularTemplatesProps) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const fadeUp = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.1, duration: 0.4, ease: "easeOut" as const },
    }),
  };

  return (
    <motion.section
      custom={7}
      variants={fadeUp}
      initial={prefersReducedMotion ? false : "hidden"}
      animate="visible"
      className="space-y-3"
    >
      <div className="flex items-center gap-2">
        <div className="h-4 w-1 rounded-full bg-secondary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-primary">
          {t("popular_templates")}
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {routineTemplates.map((template, idx) => (
          <motion.div
            key={template.name}
            className="glass-card flex flex-col overflow-hidden rounded-2xl border border-border border-l-4 border-l-secondary/40"
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.5 + idx * 0.1 }}
          >
            <div className="relative aspect-[3/1] overflow-hidden bg-bg-elevated">
              <img
                src={templateImages[template.name] || "/images/full-body.jpg"}
                alt={template.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-bg-card via-bg-card/40 to-transparent" />
              <h3 className="absolute bottom-2 left-4 right-4 text-sm font-bold uppercase tracking-wider text-text-primary">
                {template.name}
              </h3>
            </div>
            <div className="p-3">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-secondary/30 text-secondary hover:bg-secondary/5"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={async () => {
                  if (exercises.length === 0) return;
                  const built = buildTemplateRoutine(template, exercises);
                  onSave({
                    id: uid(),
                    name: template.name,
                    exercises: built.exercises,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  });
                }}
              >
                {t("add_to_my_routines")}
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.section>
  );
}

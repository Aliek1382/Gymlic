import { Dumbbell, TrendingUp, Users } from "lucide-react";

export function AuthIllustration({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary to-[#1f2f9e] p-10 text-primary-foreground lg:flex lg:w-[42%] lg:flex-col lg:justify-between">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 size-64 rounded-full bg-white/10 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -right-10 size-72 rounded-full bg-white/10 blur-2xl"
      />

      <div className="relative space-y-3">
        <h2 className="text-2xl font-bold leading-relaxed">{title}</h2>
        <p className="text-sm leading-relaxed text-primary-foreground/80">
          {description}
        </p>
      </div>

      <div className="relative flex flex-1 items-center justify-center py-10">
        <div className="relative flex size-full max-h-72 items-center justify-center rounded-2xl border border-white/20 bg-white/10 backdrop-blur-sm">
          <Dumbbell className="size-24 text-white/90" strokeWidth={1.25} />
          <div className="absolute right-6 top-6 flex size-11 items-center justify-center rounded-xl bg-white/15">
            <Users className="size-5 text-white/90" />
          </div>
          <div className="absolute bottom-6 left-6 flex size-11 items-center justify-center rounded-xl bg-white/15">
            <TrendingUp className="size-5 text-white/90" />
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-white/15">
          <Dumbbell className="size-4 text-white" />
        </div>
        <span className="text-lg font-bold">جیم‌لیک</span>
      </div>
    </div>
  );
}

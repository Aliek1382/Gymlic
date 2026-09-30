"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleGate } from "@/features/authentication/components/role-gate";
import { useAuthContext } from "@/features/authentication/hooks/use-auth-context";
import { useTicketTrainers } from "@/features/tickets";
import { getErrorMessage } from "@/lib/get-error-message";
import { useMyResume, useTrainerResume } from "../hooks/use-trainer-resume";
import { TrainerResumeEditor } from "./trainer-resume-editor";
import { TrainerResumeViewCard } from "./trainer-resume-view";

function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function TrainerEditor() {
  const resume = useMyResume();
  if (resume.isPending) return <Loading />;
  if (resume.isError) {
    return (
      <p className="text-sm text-destructive">
        {getErrorMessage(resume.error, "بارگذاری رزومه با خطا مواجه شد.")}
      </p>
    );
  }
  return <TrainerResumeEditor initial={resume.data} />;
}

function AthleteResume() {
  const router = useRouter();
  // Static export: no /trainer-resume/[id] route, so a specific trainer is `?id=`.
  const requestedId = useSearchParams().get("id");
  const trainers = useTicketTrainers(true);
  const options = trainers.data ?? [];
  const trainerId =
    options.find((t) => t.id === requestedId)?.id ?? options[0]?.id ?? null;
  const resume = useTrainerResume(trainerId);

  if (trainers.isPending) return <Loading />;
  if (!trainerId) {
    return <p className="text-sm text-muted-foreground">هنوز به مربی‌ای وصل نیستید.</p>;
  }

  return (
    <div className="space-y-4">
      {options.length > 1 && (
        <Tabs value={trainerId} onValueChange={(id) => router.replace(`/trainer-resume?id=${id}`)}>
          <TabsList>
            {options.map((trainer) => (
              <TabsTrigger key={trainer.id} value={trainer.id}>
                {trainer.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      {resume.isPending ? (
        <Loading />
      ) : resume.isError ? (
        <p className="text-sm text-destructive">
          {getErrorMessage(resume.error, "بارگذاری رزومه با خطا مواجه شد.")}
        </p>
      ) : (
        <TrainerResumeViewCard resume={resume.data} />
      )}
    </div>
  );
}

export function TrainerResumePage() {
  const { data: context } = useAuthContext();
  const role = context?.accountType;

  return (
    <RoleGate allow={["athlete", "trainer"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {role === "trainer" ? "رزومهٔ من" : "رزومهٔ مربی"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {role === "trainer"
              ? "این صفحه را شاگردانتان در پنل خودشان فقط‌خواندنی می‌بینند."
              : "معرفی، افتخارات، مدارک و تعرفهٔ مربی شما."}
          </p>
        </div>
        {role === "trainer" && <TrainerEditor />}
        {role === "athlete" && <AthleteResume />}
      </div>
    </RoleGate>
  );
}

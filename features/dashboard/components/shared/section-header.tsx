import { CardHeader, CardTitle } from "@/components/ui/card";

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <CardHeader>
      <CardTitle className="text-base">{title}</CardTitle>
      {action}
    </CardHeader>
  );
}

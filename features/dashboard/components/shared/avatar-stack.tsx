import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toPersianDigits } from "@/lib/persian";

interface AvatarStackItem {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function AvatarStack({
  items,
  overflowCount,
}: {
  items: AvatarStackItem[];
  overflowCount: number;
}) {
  return (
    <div className="flex items-center -space-x-2 space-x-reverse">
      {overflowCount > 0 && (
        <Avatar className="border-2 border-card bg-primary text-primary-foreground">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs">
            +{toPersianDigits(overflowCount)}
          </AvatarFallback>
        </Avatar>
      )}
      {items.map((item) => (
        <Avatar key={item.id} className="border-2 border-card">
          {item.avatarUrl && <AvatarImage src={item.avatarUrl} alt={item.name} />}
          <AvatarFallback className="text-xs">
            {(item.name || "کا").slice(0, 2)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

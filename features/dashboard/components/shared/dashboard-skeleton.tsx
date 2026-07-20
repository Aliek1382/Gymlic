import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatisticCardSkeleton() {
  return (
    <Card className="gap-4 py-5">
      <div className="flex flex-col gap-4 px-5">
        <Skeleton className="size-11 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </Card>
  );
}

export function ChartCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <div className="space-y-4 px-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </Card>
  );
}

export function TableCardSkeleton() {
  return (
    <Card>
      <div className="space-y-4 px-6">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full rounded-xl" />
        ))}
      </div>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatisticCardSkeleton key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCardSkeleton className="lg:col-span-2" />
        <ChartCardSkeleton />
      </div>
      <TableCardSkeleton />
    </div>
  );
}

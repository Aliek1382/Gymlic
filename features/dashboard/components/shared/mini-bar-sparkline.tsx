export function MiniBarSparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-8 items-end gap-1.5">
      {values.map((value, index) => (
        <div
          key={index}
          className="w-full rounded-sm bg-success/70"
          style={{ height: `${Math.max(12, (value / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

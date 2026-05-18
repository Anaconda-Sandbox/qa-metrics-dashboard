interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: "red" | "green" | "yellow" | "blue" | "default";
  loading?: boolean;
  error?: string;
}

const colorMap = {
  red: "text-rose-400",
  green: "text-emerald-400",
  yellow: "text-amber-400",
  blue: "text-indigo-400",
  default: "text-[#e2e8f0]",
};

const bgMap = {
  red: "bg-rose-500/5 border-rose-500/20",
  green: "bg-emerald-500/5 border-emerald-500/20",
  yellow: "bg-amber-500/5 border-amber-500/20",
  blue: "bg-indigo-500/5 border-indigo-500/20",
  default: "bg-[#0f1419] border-[#1e2a3a]/60",
};

export default function KPICard({
  title,
  value,
  subtitle,
  color = "default",
  loading,
  error,
}: KPICardProps) {
  if (loading) {
    return (
      <div className="rounded-xl bg-[#0f1419] border border-[#1e2a3a]/60 p-4">
        <div className="flex flex-col items-center justify-center py-2 space-y-2">
          <div className="relative">
            <div className="w-6 h-6 border-2 border-[#1e2a3a] rounded-full"></div>
            <div className="absolute top-0 left-0 w-6 h-6 border-2 border-transparent border-t-[#6366f1] rounded-full animate-spin"></div>
          </div>
          <div className="h-3 bg-[#1e2a3a]/40 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-[#0f1419] border border-rose-500/20 p-4 text-center">
        <p className="text-[10px] text-[#64748b] font-medium mb-1">{title}</p>
        <p className="text-xs text-rose-400">{error}</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl ${bgMap[color]} border p-4 text-center transition-all hover:scale-[1.02]`}>
      <p className="text-[10px] text-[#64748b] font-medium uppercase tracking-wider mb-1">{title}</p>
      <p className={`text-2xl font-bold tracking-tight ${colorMap[color]}`}>{value}</p>
      {subtitle && (
        <p className="text-[10px] text-[#475569] mt-1">{subtitle}</p>
      )}
    </div>
  );
}

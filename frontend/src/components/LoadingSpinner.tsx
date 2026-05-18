interface LoadingSpinnerProps {
  message?: string;
  subMessage?: string;
  size?: "sm" | "md" | "lg";
}

export default function LoadingSpinner({
  message = "Loading...",
  subMessage,
  size = "md",
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6 border-2",
    md: "w-10 h-10 border-3",
    lg: "w-14 h-14 border-4",
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 space-y-3">
      <div className="relative">
        <div className={`${sizeClasses[size]} border-[#1e2a3a] rounded-full`}></div>
        <div
          className={`absolute top-0 left-0 ${sizeClasses[size]} border-transparent border-t-[#6366f1] rounded-full animate-spin`}
        ></div>
      </div>
      {message && (
        <div className="text-center">
          <p className="text-sm font-medium text-[#e2e8f0]">{message}</p>
          {subMessage && (
            <p className="text-xs text-[#64748b] mt-0.5">{subMessage}</p>
          )}
        </div>
      )}
    </div>
  );
}

export function LoadingCard({
  message,
  subMessage,
}: {
  message?: string;
  subMessage?: string;
}) {
  return (
    <div className="rounded-2xl bg-[#0f1419] border border-[#1e2a3a]/60 p-6">
      <LoadingSpinner message={message} subMessage={subMessage} />
    </div>
  );
}

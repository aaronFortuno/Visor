import type { Session } from "../lib/types";
import { StatusBadge, TypeBadge } from "./StatusBadge";

interface Props {
  session: Session;
  onClick: () => void;
}

export function SessionCard({ session, onClick }: Props) {
  const timeAgo = formatTimeAgo(session.updatedAt);

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-visor-card border border-visor-border rounded-xl p-4 md:p-5 hover:border-visor-accent/50 transition-all group"
    >
      <div className="flex items-start justify-between mb-2 md:mb-3">
        <h3 className="font-semibold text-white text-sm md:text-base group-hover:text-visor-accent transition-colors truncate">
          {session.name}
        </h3>
        <StatusBadge status={session.status} />
      </div>

      <div className="flex items-center gap-2 mb-3">
        <TypeBadge type={session.type} />
        {session.pid && (
          <span className="text-xs md:text-sm text-gray-500 font-mono">PID {session.pid}</span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs md:text-sm text-gray-500">
        <span className="font-mono truncate max-w-[60%]">
          {session.command} {session.args.join(" ")}
        </span>
        <span>{timeAgo}</span>
      </div>
    </button>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr + "Z");
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

interface SortableThProps {
  label: string;
  active: boolean;
  direction: SortDirection;
  onSort: () => void;
  className?: string;
  children?: ReactNode;
}

export default function SortableTh({
  label,
  active,
  direction,
  onSort,
  className = "",
  children,
}: SortableThProps) {
  return (
    <th
      className={className}
      aria-sort={
        active
          ? direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
    >
      <button
        type="button"
        onClick={onSort}
        title={`Ordenar por ${label}`}
        className="inline-flex items-center gap-1 font-semibold uppercase tracking-wider hover:text-teal-700 transition-colors cursor-pointer"
      >
        {children}
        {label}
        {active ? (
          direction === "asc" ? (
            <ChevronUp size={12} />
          ) : (
            <ChevronDown size={12} />
          )
        ) : (
          <ChevronsUpDown size={12} className="opacity-40" />
        )}
      </button>
    </th>
  );
}
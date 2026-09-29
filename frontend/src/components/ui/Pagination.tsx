import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from "lucide-react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

interface PaginationProps {
  page: number;
  pageSize: PageSize;
  count: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

export default function Pagination({
  page,
  pageSize,
  count,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, totalPages);
  const from = count === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = Math.min(safePage * pageSize, count);

  const first = () => onPageChange(1);
  const previous = () => onPageChange(Math.max(1, safePage - 1));
  const next = () => onPageChange(Math.min(totalPages, safePage + 1));
  const last = () => onPageChange(totalPages);

  const navButton =
    "p-1.5 rounded-md transition-colors text-slate-400 enabled:hover:text-teal-600 enabled:hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-100 bg-white rounded-b-xl">
      <div className="flex items-center gap-2 text-[11px] text-slate-500">
        <label htmlFor="page-size" className="shrink-0">
          Linhas por página:
        </label>
        <select
          id="page-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) as PageSize)}
          className="text-xs rounded-md border border-slate-200 bg-white px-1.5 py-1 outline-none focus:border-teal-600"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span className="shrink-0 tabular-nums">
          {count === 0 ? "0 resultados" : `${from}–${to} de ${count}`}
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <button type="button" onClick={first} disabled={safePage <= 1} className={navButton} title="Primeira página" aria-label="Primeira página">
          <ChevronsLeft size={14} />
        </button>
        <button type="button" onClick={previous} disabled={safePage <= 1} className={navButton} title="Página anterior" aria-label="Página anterior">
          <ChevronLeft size={14} />
        </button>
        <span className="px-2 text-[11px] font-semibold text-slate-600 tabular-nums">
          {safePage} / {totalPages}
        </span>
        <button type="button" onClick={next} disabled={safePage >= totalPages} className={navButton} title="Próxima página" aria-label="Próxima página">
          <ChevronRight size={14} />
        </button>
        <button type="button" onClick={last} disabled={safePage >= totalPages} className={navButton} title="Última página" aria-label="Última página">
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}
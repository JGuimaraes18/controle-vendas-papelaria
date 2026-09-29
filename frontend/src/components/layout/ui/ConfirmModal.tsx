import { X, AlertCircle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-50 p-4">
      {/* Caixa do Modal Slim */}
      <div className="bg-white w-full max-w-[360px] rounded-xl shadow-xl border border-slate-100 p-4 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Cabeçalho */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-rose-50 text-rose-600 shrink-0">
              <AlertCircle size={16} />
            </div>
            <h2 className="text-sm font-semibold text-slate-900 leading-none">
              {title}
            </h2>
          </div>
          <button 
            onClick={onCancel} 
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-md hover:bg-slate-50 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Mensagem Corpo */}
        <p className="text-xs text-slate-500 leading-relaxed pl-7">
          {message}
        </p>

        {/* Rodapé / Ações */}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors border border-slate-200"
          >
            Não, cancelar
          </button>

          <button
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-[#fff] hover:bg-rose-700 active:scale-95 transition-all shadow-sm shadow-rose-600/10"
          >
            Sim, excluir
          </button>
        </div>
      </div>
    </div>
  );
}
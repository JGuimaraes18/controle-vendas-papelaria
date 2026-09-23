import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Search, Plus, Calendar, User, ShoppingBag } from "lucide-react";
import { getCustomers } from "../../../services/customerService";
import { getSellers } from "../../../services/sellerService";
import { getProducts } from "../../../services/productService";
import { getUser, isAdmin } from "../../../services/authService";
import type { Seller } from "../../../types/Seller";
import type { Customer } from "../../../types/Customer";
import type { Product } from "../../../types/Product";
import type { Sale, SaleItem } from "../../../types/Sale";

interface SaleFormProps {
  initialData?: Sale | null;
  onSave: (payload: any) => Promise<void>;
  title: string;
}

export default function SaleForm({ initialData, onSave, title }: SaleFormProps) {
  const navigate = useNavigate();
  const suggestionRef = useRef<HTMLDivElement>(null);
  
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  
  const [items, setItems] = useState<SaleItem[]>(initialData?.items || []);
  const [selectedSeller, setSelectedSeller] = useState<number>(0);
  const [selectedCustomer, setSelectedCustomer] = useState<number>(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [formError, setFormError] = useState(false);

  useEffect(() => {
    async function loadData() {
      const user = getUser();
      const isSeller = !isAdmin();

      const [c, fetchedSellers, p] = await Promise.all([
        getCustomers(),
        isSeller ? Promise.resolve([] as Seller[]) : getSellers(),
        getProducts(),
      ]);

      setCustomers(c);
      setProducts(p);

      // SELLER has no access to /api/sellers/ (403); uses own data from login
      const s: Seller[] =
        isSeller && user?.seller_id
          ? [
              {
                id: user.seller_id,
                user: user.id,
                first_name: user.first_name ?? "",
                last_name: user.last_name ?? "",
                full_name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
                email: user.email ?? "",
                phone: "",
                group: "SELLER",
                is_active: true,
              },
            ]
          : fetchedSellers;

      if (initialData) {
        setItems(initialData.items);
        const sId = typeof initialData.seller === "object" ? (initialData.seller as any).id : Number(initialData.seller);
        const cId = typeof initialData.customer === "object" ? (initialData.customer as any).id : Number(initialData.customer);

        setSelectedSeller(sId);
        setSelectedCustomer(cId);

        if (isSeller) {
          const sellerLogged = s.find((seller) => seller.user === user?.id);
          if (sellerLogged) setSellers([sellerLogged]);
        } else {
          setSellers(s);
        }
        return;
      }

      if (isSeller) {
        const sellerLogged = s.find((seller) => seller.user === user?.id);
        if (sellerLogged) {
          setSellers([sellerLogged]);
          setSelectedSeller(sellerLogged.id);
        }
      } else {
        setSellers(s);
      }
    }

    loadData();
  }, [initialData]);

  useEffect(() => {
    if (focusedIndex >= 0 && suggestionRef.current) {
      const activeElement = suggestionRef.current.children[focusedIndex] as HTMLElement;
      activeElement?.scrollIntoView({ block: "nearest" });
    }
  }, [focusedIndex]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setSelectedProduct(null);
    setFocusedIndex(-1);
    if (val.trim().length > 0) {
      const filtered = products.filter(p => 
        p.code.toLowerCase().includes(val.toLowerCase()) || 
        p.description.toLowerCase().includes(val.toLowerCase())
      );
      setFilteredProducts(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelectProduct = (p: Product) => {
    setSearchQuery(p.description);
    setSelectedProduct(p);
    setShowSuggestions(false);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (focusedIndex >= 0) handleSelectProduct(filteredProducts[focusedIndex]);
    } else if (e.key === "Escape") setShowSuggestions(false);
  };

  const handleAddItem = () => {
    if (!selectedProduct) return;
    const unitPrice = parseFloat(selectedProduct.unit_price);
    const newItem: SaleItem = {
      id: Math.random(),
      product: selectedProduct.id,
      product_description: selectedProduct.description,
      quantity: quantityToAdd,
      unit_price: unitPrice,
      total_value: unitPrice * quantityToAdd
    };
    setItems([...items, newItem]);
    setSearchQuery("");
    setSelectedProduct(null);
    setQuantityToAdd(1);
  };

  const totalGeral = items.reduce((acc, item) => acc + item.total_value, 0);

  const handleUpdateQuantity = (index: number, newQuantity: number) => {
    const updated = [...items];
    updated[index].quantity = newQuantity;
    updated[index].total_value = updated[index].unit_price * newQuantity;
    setItems(updated);
  };

  const handleSubmit = async () => {
    const hasError = !selectedSeller || !selectedCustomer || items.length === 0;
    if (hasError) {
      setFormError(true);
      return;
    }
    setFormError(false);
    const payload = {
      customer: Number(selectedCustomer),
      seller: Number(selectedSeller),
      items: items.map(item => ({
        product: item.product,
        quantity: item.quantity,
      })),
    };
    await onSave(payload);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 p-1">
      <div className="flex justify-between items-center border-b border-slate-100 pb-2">
        <div>
          <div className="text-2xl font-bold text-slate-900">{title}</div>
        </div>
        <div className="text-xs text-slate-400 font-medium flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md">
          <Calendar size={13} />
          {initialData ? new Date(initialData.date).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
            <ShoppingBag className="text-teal-600" size={16} />
            <h3 className="text-sm font-bold text-slate-800">Produtos</h3>
          </div>

          {/* INPUTS EM LINHA ÚNICA */}
          <div className="grid grid-cols-12 gap-2 items-end relative">
            <div className="col-span-12 sm:col-span-8 relative">
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Buscar Produto</label>
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full text-xs border border-slate-200 rounded-lg px-3 py-1.5 pl-8 outline-none focus:border-teal-600 bg-slate-50/50" 
                  placeholder="Código ou descrição..." 
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
                />
                <Search className="absolute left-2.5 top-2 text-slate-400" size={14} />
              </div>
              
              {showSuggestions && filteredProducts.length > 0 && (
                <div className="absolute z-50 w-full bg-white border border-slate-100 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto" ref={suggestionRef}>
                  {filteredProducts.map((p, idx) => (
                    <div key={p.id} onClick={() => handleSelectProduct(p)} className={`px-3 py-2 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0 text-xs ${focusedIndex === idx ? "bg-teal-50" : "hover:bg-slate-50"}`}>
                      <div>
                        <p className="font-semibold text-slate-800">{p.description}</p>
                        <p className="text-[9px] text-slate-400 uppercase">CÓD: {p.code}</p>
                      </div>
                      <span className="text-teal-600 font-bold">R$ {parseFloat(p.unit_price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="col-span-6 sm:col-span-2">
              <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Qtd</label>
              <input type="number" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none text-center bg-slate-50/50" value={quantityToAdd} onChange={(e) => setQuantityToAdd(Number(e.target.value))} min="1" />
            </div>

            <button onClick={handleAddItem} className="col-span-6 sm:col-span-2 bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-700 h-[30px] transition-all flex items-center justify-center gap-1 shadow-sm">
              <Plus size={14} /> Inserir
            </button>
          </div>

          <div className="border border-slate-100 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                <tr className="text-slate-500 font-semibold text-[11px] uppercase">
                  <th className="p-2.5 w-[45%]">Produto</th>
                  <th className="p-2.5 w-[10%] text-center">Quantidade</th>
                  <th className="p-2.5 w-[20%] text-center">Valor Unitário</th>
                  <th className="p-2.5 w-[15%] text-center">Total</th>
                  <th className="p-2.5 w-[10%] text-center">Ação</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50 text-xs">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-400 text-[11px]">
                      {formError && <p className="text-red-500 font-medium mb-1">* Carrinho vazio.</p>}
                      Nenhum item na lista.
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-2 text-slate-800 font-medium truncate">{item.product_description}</td>
                      <td className="p-2 text-center">
                        {editingIndex === idx ? (
                          <input
                            type="number"
                            min="1"
                            autoFocus
                            value={item.quantity}
                            onChange={(e) => handleUpdateQuantity(idx, Number(e.target.value))}
                            onBlur={() => setEditingIndex(null)}
                            className="w-12 text-center border border-slate-200 rounded px-1 py-0.5 outline-none"
                          />
                        ) : (
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded font-medium text-slate-700">{item.quantity}</span>
                        )}
                      </td>
                      <td className="p-2 text-slate-500 text-center">R$ {Number(item.unit_price).toFixed(2)}</td>
                      <td className="p-2 font-bold text-slate-900 text-center">R$ {Number(item.total_value).toFixed(2)}</td>
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditingIndex(idx)} className="p-1 text-slate-400 hover:text-teal-600 rounded hover:bg-slate-100">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 space-y-4 h-fit sticky top-4">
          <div className="flex items-center gap-1.5 border-b border-slate-50 pb-2">
            <User className="text-teal-600" size={16} />
            <h3 className="text-sm font-bold text-slate-800">Dados da Venda</h3>
          </div>
          
          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Vendedor</label>
              {isAdmin() ? (
                <select
                  className={`w-full text-xs bg-slate-50/50 border rounded-lg p-2 outline-none focus:border-teal-600 transition-all cursor-pointer ${
                    formError && !selectedSeller ? "border-rose-400 bg-rose-50/50" : "border-slate-200"
                  }`}
                  value={selectedSeller}
                  onChange={(e) => setSelectedSeller(Number(e.target.value))}
                >
                  <option value={0}>Selecione...</option>
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {String(s.id).padStart(3, "0")} - {s.full_name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 text-slate-700 font-medium flex items-center gap-2">
                  <User size={12} className="text-slate-400" />
                  {sellers.length > 0 ? sellers[0].full_name : "Carregando..."}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">Cliente</label>
              <select 
                className={`w-full text-xs bg-slate-50/50 border rounded-lg p-2 outline-none focus:border-teal-600 transition-all cursor-pointer ${
                  formError && !selectedCustomer ? "border-rose-400 bg-rose-50/50" : "border-slate-200"
                }`} 
                value={selectedCustomer} 
                onChange={(e) => setSelectedCustomer(Number(e.target.value))}
              >
                <option value={0}>Selecione...</option>
                {customers.map(c => <option key={c.id} value={c.id}>{String(c.id).padStart(3, '0')} - {c.name}</option>)}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-3">
              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Total Geral</span>
                <span className="text-xl font-black text-teal-800">
                  R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate("/")}
                  className="flex-1 border border-slate-200 text-slate-600 py-1.5 rounded-lg font-bold hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>

                <button
                  onClick={handleSubmit}
                  className="flex-1 bg-teal-600 text-white py-1.5 rounded-lg font-bold shadow-sm hover:bg-teal-700 active:scale-[0.98] transition-all"
                >
                  Gravar Venda
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
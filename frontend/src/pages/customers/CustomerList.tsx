import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, User, Mail, Phone } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getCustomers,
  deleteCustomer,
} from "../../services/customerService";

import type { Customer } from "../../types/Customer";
import { ConfirmModal } from "../../components/layout/ui/ConfirmModal";
import SortableTh from "../../components/layout/ui/SortableTh";
import type { SortDirection } from "../../components/layout/ui/SortableTh";
import { isAdmin } from "../../services/authService";
import { formatPhone } from "../../utils/format";

interface CustomerListProps {
  searchTerm: string;
}

type CustomerSortKey = "name" | "email" | "phone";

export default function CustomerList({
  searchTerm,
}: CustomerListProps) {
  const navigate = useNavigate();

  const admin = isAdmin();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CustomerSortKey>("name");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  const [customerToDelete, setCustomerToDelete] =
    useState<Customer | null>(null);

  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    try {
      setLoading(true);
      setError(null);

      const data = await getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os clientes.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: CustomerSortKey) {
    if (sortKey === key) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedCustomers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    const filtered = term
      ? customers.filter(
          (customer) =>
            customer.name.toLowerCase().includes(term) ||
            customer.email.toLowerCase().includes(term) ||
            customer.phone.toLowerCase().includes(term)
        )
      : [...customers];

    return filtered.sort((a, b) => {
      let cmp: number;

      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "phone":
          cmp = a.phone.localeCompare(b.phone);
          break;
        case "name":
        default:
          cmp = a.name.localeCompare(b.name);
          break;
      }

      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [customers, searchTerm, sortKey, sortDir]);

  const handleDelete = async () => {
    if (!customerToDelete) return;

    try {
      await deleteCustomer(customerToDelete.id);

      setCustomers((current) =>
        current.filter(
          (customer) => customer.id !== customerToDelete.id
        )
      );

      setModalOpen(false);
      setCustomerToDelete(null);

      navigate("/", {
        state: {
          message: "Cliente excluído com sucesso!",
          type: "success",
        },
      });
    } catch (err) {
      console.error(err);

      setModalOpen(false);
      setCustomerToDelete(null);

      navigate("/", {
        state: {
          message: "Erro ao excluir cliente!",
          type: "error",
        },
      });
    }
  };

  const openDeleteModal = (customer: Customer) => {
    setCustomerToDelete(customer);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <p className="p-10 text-center text-teal-700 font-bold">
        Carregando...
      </p>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-rose-600 text-xs font-medium">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr className="text-slate-500 font-semibold text-[11px] uppercase">
                <th className="p-2.5 w-[8%]">ID</th>
                <SortableTh
                  label="Cliente"
                  active={sortKey === "name"}
                  direction={sortDir}
                  onSort={() => toggleSort("name")}
                  className="p-2.5 w-[30%]"
                />
                <SortableTh
                  label="E-mail"
                  active={sortKey === "email"}
                  direction={sortDir}
                  onSort={() => toggleSort("email")}
                  className="p-2.5 w-[30%]"
                />
                <SortableTh
                  label="Telefone"
                  active={sortKey === "phone"}
                  direction={sortDir}
                  onSort={() => toggleSort("phone")}
                  className="p-2.5 w-[22%]"
                />
                <th className="p-2.5 w-[10%] text-center">
                  Ação
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-50 text-xs">
              {sortedCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-slate-400 text-[11px]"
                  >
                    {searchTerm
                      ? "Nenhum cliente encontrado."
                      : "Nenhum cliente cadastrado."}
                  </td>
                </tr>
              ) : (
                sortedCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-2.5 text-slate-400 font-medium">
                      {String(customer.id).padStart(3, "0")}
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-teal-50 flex items-center justify-center shrink-0">
                          <User
                            size={13}
                            className="text-teal-600"
                          />
                        </div>

                        <span className="text-slate-800 font-semibold">
                          {customer.name}
                        </span>
                      </div>
                    </td>

                    <td className="p-2.5 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Mail
                          size={12}
                          className="text-slate-400"
                        />
                        {customer.email}
                      </div>
                    </td>

                    <td className="p-2.5 text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Phone
                          size={12}
                          className="text-slate-400"
                        />
                        {formatPhone(customer.phone)}
                      </div>
                    </td>

                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() =>
                            navigate(`/clientes/editar/${customer.id}`)
                          }
                          className="p-1.5 text-slate-400 hover:text-teal-600 rounded hover:bg-slate-100 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>

                        {admin && (
                          <button
                            onClick={() => openDeleteModal(customer)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-slate-100 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {customerToDelete && (
        <ConfirmModal
          isOpen={modalOpen}
          onCancel={() => {
            setModalOpen(false);
            setCustomerToDelete(null);
          }}
          onConfirm={handleDelete}
          title="Excluir Cliente"
          message={`Deseja realmente excluir o cliente "${customerToDelete.name}"?`}
        />
      )}
    </>
  );
}
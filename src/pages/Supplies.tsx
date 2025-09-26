import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";

interface SupplyRequest {
  id: number;
  supply_name: string;
  quantity: number;
  brand?: string;
  model?: string;
  notes?: string;
  status: "pending" | "ordered" | "in_transit" | "delivered" | "rejected";
  admin_notes?: string;
  created_at: string;
  user_email?: string; // Only for admin view
}

interface CommonSupply {
  id: number;
  name: string;
  brand?: string;
  model?: string;
  description?: string;
}

interface StructuredSupplies {
  [name: string]: {
    [brand: string]: string[];
  };
}

const Supplies: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "GOD";

  // Form state
  const [selectedSupply, setSelectedSupply] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");

  // Data from API
  const [requests, setRequests] = useState<SupplyRequest[]>([]);
  const [commonSupplies, setCommonSupplies] = useState<CommonSupply[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const structuredSupplies = useMemo(() => {
    return commonSupplies.reduce<StructuredSupplies>((acc, supply) => {
      if (!supply.name) return acc;
      if (!acc[supply.name]) {
        acc[supply.name] = {};
      }
      const brand = supply.brand || 'N/A';
      if (!acc[supply.name][brand]) {
        acc[supply.name][brand] = [];
      }
      if (supply.model) {
        acc[supply.name][brand].push(supply.model);
      }
      return acc;
    }, {});
  }, [commonSupplies]);

  const supplyNames = Object.keys(structuredSupplies);
  const availableBrands = selectedSupply ? Object.keys(structuredSupplies[selectedSupply]) : [];
  const availableModels = selectedSupply && selectedBrand ? structuredSupplies[selectedSupply][selectedBrand] : [];

  const translateStatus = (status: SupplyRequest["status"]) => {
    switch (status) {
      case "pending":
        return "Pendiente";
      case "ordered":
        return "Pedido";
      case "in_transit":
        return "En Tránsito";
      case "delivered":
        return "Entregado";
      case "rejected":
        return "Rechazado";
      default:
        return status;
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [requests, commonSupplies] = await Promise.all([
        apiClient.get<SupplyRequest[]>("/api/supplies/requests"),
        apiClient.get<CommonSupply[]>("/api/supplies/common"),
      ]);
      setRequests(requests);
      setCommonSupplies(commonSupplies);
    } catch (err: any) {
      setError(err.message || "Error al cargar los datos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.post("/api/supplies/requests", {
        supplyName: selectedSupply,
        quantity,
        brand: selectedBrand === 'N/A' ? undefined : selectedBrand,
        model: selectedModel === 'N/A' ? undefined : selectedModel,
        notes: notes || undefined,
      });
      setSuccessMessage("¡Solicitud de insumo enviada con éxito!");
      setSelectedSupply("");
      setSelectedBrand("");
      setSelectedModel("");
      setQuantity(1);
      setNotes("");
      fetchData(); // Refresh requests
    } catch (err: any) {
      setError(err.message || "Error al enviar la solicitud");
    }
  };

  const handleStatusChange = async (requestId: number, newStatus: SupplyRequest["status"]) => {
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.put(`/api/supplies/requests/${requestId}/status`, {
        status: newStatus,
      });
      setSuccessMessage("¡Estado de la solicitud actualizado con éxito!");
      fetchData(); // Refresh requests
    } catch (err: any) {
      setError(err.message || "Error al actualizar el estado");
    }
  };

  if (loading) return <div className="p-4">Cargando...</div>;
  if (error && !successMessage) return <div className="p-4 text-red-500">Error: {error}</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Solicitudes de Insumos</h1>

      {successMessage && <div className="bg-green-100 text-green-700 p-3 rounded mb-4">{successMessage}</div>}
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">Error: {error}</div>}

      <div className="mb-8 p-6 bg-white shadow-md rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Solicitar Nuevo Insumo</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="supplyName" className="block text-sm font-medium text-gray-700">Nombre del Insumo</label>
            <select
              id="supplyName"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              value={selectedSupply}
              onChange={(e) => {
                setSelectedSupply(e.target.value);
                setSelectedBrand("");
                setSelectedModel("");
              }}
              required
            >
              <option value="">Seleccione un insumo</option>
              {supplyNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">Cantidad</label>
            <input
              type="number"
              id="quantity"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              required
            />
          </div>
          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-gray-700">Marca</label>
            <select
              id="brand"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setSelectedModel("");
              }}
              disabled={!selectedSupply}
            >
              <option value="">Seleccione una marca</option>
              {availableBrands.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="model" className="block text-sm font-medium text-gray-700">Modelo</label>
            <select
              id="model"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={!selectedBrand || availableModels.length === 0}
            >
              <option value="">Seleccione un modelo</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notas (Opcional)</label>
            <textarea
              id="notes"
              rows={3}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Enviar Solicitud
            </button>
          </div>
        </form>
      </div>

      <div className="p-6 bg-white shadow-md rounded-lg">
        <h2 className="text-xl font-semibold mb-4">{isAdmin ? "Todas las Solicitudes" : "Solicitudes Activas"}</h2>
        {requests.length === 0 ? (
          <p>No se encontraron solicitudes de insumos.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Insumo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Marca/Modelo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas</th>
                  {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Solicitado Por</th>}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notas del Admin</th>}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha Solicitud</th>
                  {isAdmin && <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{request.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.supply_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.quantity}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {request.brand && <span>{request.brand}</span>}
                      {request.brand && request.model && <span>/</span>}
                      {request.model && <span>{request.model}</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.notes || "-"}</td>
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.user_email}</td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{translateStatus(request.status)}</td>
                    {isAdmin && <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{request.admin_notes || "-"}</td>}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(request.created_at).toLocaleString()}</td>
                    {isAdmin && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <select
                          value={request.status}
                          onChange={(e) => handleStatusChange(request.id, e.target.value as SupplyRequest["status"])}
                          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                          <option value="pending">Pendiente</option>
                          <option value="ordered">Pedido</option>
                          <option value="in_transit">En Tránsito</option>
                          <option value="delivered">Entregado</option>
                          <option value="rejected">Rechazado</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Supplies;
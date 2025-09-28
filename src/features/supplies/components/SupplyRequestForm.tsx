import React, { useState, useMemo } from "react";
import Button from "../../../components/Button";
import Input from "../../../components/Input";
import Alert from "../../../components/Alert";
import { apiClient } from "../../../lib/apiClient";
import type { CommonSupply, StructuredSupplies } from "../types";

interface SupplyRequestFormProps {
  commonSupplies: CommonSupply[];
  onSuccess: () => void;
}

export default function SupplyRequestForm({ commonSupplies, onSuccess }: SupplyRequestFormProps) {
  const [selectedSupply, setSelectedSupply] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");
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
      onSuccess(); // Refresh requests
    } catch (err: any) {
      setError(err.message || "Error al enviar la solicitud");
    }
  };

  return (
    <div className="mb-8 p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Solicitar Nuevo Insumo</h2>
      {successMessage && <Alert variant="success">{successMessage}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Nombre del Insumo"
          type="select"
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
        </Input>
        <Input
          label="Cantidad"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
          min="1"
          required
        />
        <Input
          label="Marca"
          type="select"
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
        </Input>
        <Input
          label="Modelo"
          type="select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          disabled={!selectedBrand || availableModels.length === 0}
        >
          <option value="">Seleccione un modelo</option>
          {availableModels.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </Input>
        <div className="md:col-span-2">
          <Input
            label="Notas (Opcional)"
            type="textarea"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <Button type="submit">
            Enviar Solicitud
          </Button>
        </div>
      </form>
    </div>
  );
}

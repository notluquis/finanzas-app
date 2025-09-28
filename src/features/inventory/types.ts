export type InventoryCategory = {
  id: number;
  name: string;
};

export type InventoryItem = {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  current_stock: number;
  category_name?: string;
};

export type InventoryMovement = {
  item_id: number;
  quantity_change: number;
  reason: string;
};

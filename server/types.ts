import type express from "express";
import type { UserRole } from "./db.js";

export type AuthSession = {
  userId: number;
  email: string;
  role: UserRole;
};

export type AuthenticatedRequest = express.Request & { auth?: AuthSession };

export type InventoryCategory = {
  id: number;
  name: string;
  created_at: string;
};

export type InventoryItem = {
  id: number;
  category_id: number | null;
  name: string;
  description: string | null;
  current_stock: number;
  created_at: string;
  updated_at: string;
  category_name?: string; // For joining
};

export type InventoryMovement = {
  id: number;
  item_id: number;
  quantity_change: number;
  reason: string | null;
  created_at: string;
};

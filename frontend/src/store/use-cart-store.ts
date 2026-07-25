import { create } from "zustand";
import { MenuItem } from "@/services/menu";

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  specialInstructions: string;
}

interface CartStore {
  items: CartItem[];
  addItem: (menuItem: MenuItem, quantity?: number, specialInstructions?: string) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, quantity: number) => void;
  updateInstructions: (menuItemId: string, instructions: string) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getSubtotal: () => number;
  getTax: () => number;
  getGrandTotal: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (menuItem, quantity = 1, specialInstructions = "") => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (i) => i.menuItem.id === menuItem.id
      );
      if (existingIndex > -1) {
        const updated = [...state.items];
        updated[existingIndex].quantity += quantity;
        if (specialInstructions) {
          updated[existingIndex].specialInstructions = specialInstructions;
        }
        return { items: updated };
      }
      return {
        items: [
          ...state.items,
          { menuItem, quantity, specialInstructions },
        ],
      };
    });
  },

  removeItem: (menuItemId) => {
    set((state) => ({
      items: state.items.filter((i) => i.menuItem.id !== menuItemId),
    }));
  },

  updateQuantity: (menuItemId, quantity) => {
    if (quantity < 1) {
      get().removeItem(menuItemId);
      return;
    }
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItem.id === menuItemId ? { ...i, quantity } : i
      ),
    }));
  },

  updateInstructions: (menuItemId, specialInstructions) => {
    set((state) => ({
      items: state.items.map((i) =>
        i.menuItem.id === menuItemId ? { ...i, specialInstructions } : i
      ),
    }));
  },

  clearCart: () => set({ items: [] }),

  getTotalItems: () => {
    return get().items.reduce((acc, curr) => acc + curr.quantity, 0);
  },

  getSubtotal: () => {
    return get().items.reduce(
      (acc, curr) => acc + curr.menuItem.price * curr.quantity,
      0
    );
  },

  getTax: () => {
    return Math.round(get().getSubtotal() * 0.05 * 100) / 100;
  },

  getGrandTotal: () => {
    return get().getSubtotal() + get().getTax();
  },
}));

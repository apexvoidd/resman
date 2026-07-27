"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import {
  Category,
  createCategory,
  fetchCategories,
  toggleCategoryStatus,
  updateCategory,
} from "@/services/menu";

export default function CategoryListPage() {
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const isStaffAuthorized = hasRole("admin") || hasRole("manager");

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const data = await fetchCategories(token);
      setCategories(data);
      setErrorMsg(null);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to load categories.");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoading || !isStaffAuthorized) return;
    Promise.resolve().then(() => loadCategories());
  }, [isLoading, isStaffAuthorized, loadCategories]);

  const openCreateModal = () => {
    setEditingCategory(null);
    setName("");
    setDescription("");
    setDisplayOrder(categories.length);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setName(cat.name);
    setDescription(cat.description || "");
    setDisplayOrder(cat.display_order);
    setIsActive(cat.is_active);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const token = await getToken();
      if (!token) return;

      if (editingCategory) {
        await updateCategory(token, editingCategory.id, {
          name,
          description: description.trim() || undefined,
          display_order: displayOrder,
          is_active: isActive,
        });
      } else {
        await createCategory(token, {
          name,
          description: description.trim() || undefined,
          display_order: displayOrder,
          is_active: isActive,
        });
      }

      setIsModalOpen(false);
      await loadCategories();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to save category.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (cat: Category) => {
    try {
      const token = await getToken();
      if (!token) return;
      await toggleCategoryStatus(token, cat.id, !cat.is_active);
      await loadCategories();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to toggle status.");
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Menu Categories...</p>
        </div>
      </div>
    );
  }

  if (!isStaffAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-4 text-white">
        <div className="max-w-md rounded-2xl border border-red-500/20 bg-gray-900 p-6 text-center">
          <span className="text-4xl">⚠️</span>
          <h2 className="mt-3 text-lg font-bold text-red-400">Access Restricted</h2>
          <p className="mt-1 text-sm text-gray-400">
            Only Administrators and Managers can manage menu categories.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-800 pb-5">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Menu Category Management</h1>
            <p className="text-xs text-gray-400">Organize appetizers, main courses, desserts, and beverages</p>
          </div>
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-gray-950 hover:bg-amber-400 transition"
          >
            + Add Category
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Categories Table / List */}
        <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="border-b border-gray-800 bg-gray-950 text-xs uppercase tracking-wider text-gray-400">
              <tr>
                <th className="px-6 py-4">Order</th>
                <th className="px-6 py-4">Category Name</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    No categories found. Click &quot;Add Category&quot; to create your first category.
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-gray-800/50 transition">
                    <td className="px-6 py-4 font-mono text-xs text-gray-400">#{cat.display_order}</td>
                    <td className="px-6 py-4 font-semibold text-white">{cat.name}</td>
                    <td className="px-6 py-4 text-xs text-gray-400">{cat.description || "—"}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          cat.is_active
                            ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20"
                            : "bg-red-500/10 text-red-400 ring-red-500/20"
                        }`}
                      >
                        {cat.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(cat)}
                        className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(cat)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          cat.is_active
                            ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        {cat.is_active ? "Disable" : "Enable"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleSave}
            className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl space-y-4"
          >
            <h2 className="text-lg font-bold text-white">
              {editingCategory ? "Edit Category" : "Add New Category"}
            </h2>

            <div>
              <label className="block text-xs font-medium text-gray-300">Category Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Appetizers"
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of category items..."
                rows={3}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm text-white placeholder-gray-500 ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300">Display Order</label>
              <input
                type="number"
                min={0}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-2.5 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="is_active" className="text-xs font-medium text-gray-300">
                Active Category
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl bg-gray-800 px-4 py-2 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-gray-950 hover:bg-amber-400 transition disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

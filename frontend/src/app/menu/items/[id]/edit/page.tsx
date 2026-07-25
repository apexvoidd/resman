"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useRBAC } from "@/hooks/use-rbac";
import {
  Category,
  fetchCategories,
  fetchMenuItemById,
  updateMenuItem,
  uploadMenuItemImage,
} from "@/services/menu";

export default function EditMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const itemId = resolvedParams.id;

  const router = useRouter();
  const { getToken } = useAuth();
  const { isLoading, hasRole } = useRBAC();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form Fields
  const [name, setName] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  const [preparationTime, setPreparationTime] = useState<number>(15);
  const [description, setDescription] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [isFeatured, setIsFeatured] = useState<boolean>(false);
  const [isVegetarian, setIsVegetarian] = useState<boolean>(false);
  const [isVegan, setIsVegan] = useState<boolean>(false);
  const [isJain, setIsJain] = useState<boolean>(false);
  const [spicyLevel, setSpicyLevel] = useState<number>(0);
  const [displayOrder, setDisplayOrder] = useState<number>(0);

  const isStaffAuthorized = hasRole("admin") || hasRole("manager");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;

        const [cats, item] = await Promise.all([
          fetchCategories(token),
          fetchMenuItemById(token, itemId),
        ]);

        setCategories(cats);
        setName(item.name);
        setCategoryId(item.category_id);
        setPrice(item.price);
        setPreparationTime(item.preparation_time_minutes);
        setDescription(item.description || "");
        setImageUrl(item.image_url || "");
        setIsAvailable(item.is_available);
        setIsFeatured(item.is_featured);
        setIsVegetarian(item.is_vegetarian);
        setIsVegan(item.is_vegan);
        setIsJain(item.is_jain);
        setSpicyLevel(item.spicy_level);
        setDisplayOrder(item.display_order);
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e.message || "Failed to load menu item details.");
      } finally {
        setLoading(false);
      }
    }

    if (!isLoading && isStaffAuthorized) {
      load();
    }
  }, [isLoading, isStaffAuthorized, itemId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setErrorMsg(null);
      const token = await getToken();
      if (!token) return;

      const url = await uploadMenuItemImage(token, file);
      setImageUrl(url);
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to upload dish image.");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      setErrorMsg(null);
      const token = await getToken();
      if (!token) return;

      await updateMenuItem(token, itemId, {
        name,
        category_id: categoryId,
        price,
        preparation_time_minutes: preparationTime,
        description: description.trim() || undefined,
        image_url: imageUrl.trim() || undefined,
        is_available: isAvailable,
        is_featured: isFeatured,
        is_vegetarian: isVegetarian,
        is_vegan: isVegan,
        is_jain: isJain,
        spicy_level: spicyLevel,
        display_order: displayOrder,
      });

      router.push("/menu/items");
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to update menu item.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-sm text-gray-400">Loading Edit Form...</p>
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
          <p className="mt-1 text-sm text-gray-400">Only Administrators and Managers can edit menu items.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="border-b border-gray-800 pb-5">
          <h1 className="text-2xl font-bold text-white tracking-tight">Edit Menu Item</h1>
          <p className="text-xs text-gray-400">Update dish details, price, preparation time, and image</p>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-xl">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-300">Dish Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300">Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-300">Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300">Preparation Time (Minutes)</label>
              <input
                type="number"
                min="1"
                max="240"
                value={preparationTime}
                onChange={(e) => setPreparationTime(parseInt(e.target.value) || 15)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300">Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          {/* R2 Image Upload */}
          <div>
            <label className="block text-xs font-medium text-gray-300">Dish Image (Cloudflare R2 Upload)</label>
            <div className="mt-2 flex flex-col sm:flex-row items-center gap-4">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleImageUpload}
                disabled={uploadingImage}
                className="block w-full text-xs text-gray-400 file:mr-4 file:rounded-xl file:border-0 file:bg-gray-800 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-white hover:file:bg-gray-700"
              />
              {uploadingImage && <span className="text-xs text-amber-400 animate-pulse">Uploading to R2...</span>}
            </div>

            {imageUrl && (
              <div className="mt-3 flex items-center gap-3">
                <img src={imageUrl} alt="Dish preview" className="h-20 w-20 rounded-xl object-cover border border-gray-700" />
                <span className="text-xs text-emerald-400 font-semibold">✓ Image set</span>
              </div>
            )}
          </div>

          {/* Toggles & Options */}
          <div className="grid gap-4 sm:grid-cols-2 border-t border-gray-800 pt-5">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_available"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="is_available" className="text-xs font-medium text-gray-300">
                Currently Available for Ordering
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="is_featured"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="is_featured" className="text-xs font-medium text-gray-300">
                Mark as Chef Special / Featured
              </label>
            </div>
          </div>

          {/* Dietary Flags */}
          <div className="border-t border-gray-800 pt-5 space-y-3">
            <label className="block text-xs font-bold uppercase text-gray-400">Dietary Preferences</label>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={isVegetarian}
                  onChange={(e) => setIsVegetarian(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-emerald-500"
                />
                🌱 Vegetarian
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={isVegan}
                  onChange={(e) => setIsVegan(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-teal-500"
                />
                🌿 Vegan
              </label>

              <label className="flex items-center gap-2 text-xs text-gray-300">
                <input
                  type="checkbox"
                  checked={isJain}
                  onChange={(e) => setIsJain(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-950 text-orange-500"
                />
                🪷 Jain
              </label>
            </div>
          </div>

          {/* Spicy Level & Display Order */}
          <div className="grid gap-4 sm:grid-cols-2 border-t border-gray-800 pt-5">
            <div>
              <label className="block text-xs font-medium text-gray-300">Spicy Level (0 - 5)</label>
              <input
                type="number"
                min="0"
                max="5"
                value={spicyLevel}
                onChange={(e) => setSpicyLevel(parseInt(e.target.value) || 0)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300">Display Order</label>
              <input
                type="number"
                min="0"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="mt-1.5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm text-white ring-1 ring-white/10 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={() => router.push("/menu/items")}
              className="rounded-xl bg-gray-800 px-5 py-3 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-amber-500 px-6 py-3 text-xs font-bold text-gray-950 hover:bg-amber-400 transition disabled:opacity-50"
            >
              {submitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

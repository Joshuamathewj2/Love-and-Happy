"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Package, Search, Plus, Pencil, Trash2, X, Check, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ProductFormData {
  name: string;
  description?: string;
  sku: string;
  category: string;
  price: string | number;
  stock: string | number;
  image_url: string;
  is_active: boolean;
}

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    sku: "",
    category: "",
    price: "",
    stock: "",
    image_url: "",
    is_active: true,
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (err: any) {
      console.error("[Inventory] Error fetching products:", err);
      setFeedback({ type: "error", message: err.message || "Failed to load products" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle Edit Trigger & Form State Population
  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name || "",
      description: product.description || "",
      sku: product.sku || "",
      category: product.category || "General",
      price: product.price ?? product.selling_price ?? 0,
      stock: product.stock_quantity ?? 0,
      image_url: product.image_url || "",
      is_active: product.is_active !== false,
    });
    setIsEditOpen(true);
    setFeedback(null);
  };

  const handleCloseModal = () => {
    setIsEditOpen(false);
    setSelectedProduct(null);
  };

  // Submit Handler with Type Checking & Fallback Columns
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    if (!formData.name.trim()) {
      setFeedback({ type: "error", message: "Product name is required" });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    const numericPrice = parseFloat(String(formData.price)) || 0;
    const numericStock = parseInt(String(formData.stock), 10) || 0;
    const categoryName = formData.category?.trim() || "General";
    const descValue = formData.description?.trim() || null;

    try {
      // Primary sanitized payload: only known database columns, parsed numeric price and null/trimmed description
      const updatePayload: Record<string, any> = {
        name: formData.name.trim(),
        description: descValue,
        category: categoryName,
        selling_price: numericPrice,
        price: numericPrice,
        sku: formData.sku?.trim() || null,
        stock_quantity: numericStock,
        is_active: Boolean(formData.is_active),
      };

      const { data, error } = await supabase
        .from("products")
        .update(updatePayload)
        .eq("id", selectedProduct.id)
        .select();

      if (error) {
        console.error("Supabase Update Error Details:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        // Fallback if specific schema columns differ (e.g. extra fields not present)
        const fallbackPayload: Record<string, any> = {
          name: formData.name.trim(),
          description: descValue,
          category: categoryName,
          selling_price: numericPrice,
          price: numericPrice,
          sku: formData.sku?.trim() || null,
          is_active: Boolean(formData.is_active),
        };
        const { error: retryErr } = await supabase
          .from("products")
          .update(fallbackPayload)
          .eq("id", selectedProduct.id);

        if (retryErr) {
          console.error("Supabase Update Error Details:", {
            code: retryErr.code,
            message: retryErr.message,
            details: retryErr.details,
            hint: retryErr.hint,
          });
          const alertMsg = `Could not save product: ${retryErr.message || retryErr.details || 'Check console for details'}`;
          setFeedback({ type: "error", message: alertMsg });
          alert(alertMsg);
          return;
        }
      }

      // Sync to catalog_items if table exists
      try {
        await supabase
          .from("catalog_items")
          .update({
            name: formData.name.trim(),
            category: categoryName,
            regular_price: numericPrice,
            details: descValue,
          })
          .eq("id", selectedProduct.id);
      } catch (_) {}

      // Update local state immediately so table reflects changes without reload
      setProducts((prev) =>
        prev.map((p) =>
          p.id === selectedProduct.id
            ? {
                ...p,
                name: formData.name.trim(),
                description: descValue,
                sku: formData.sku?.trim() || undefined,
                category: categoryName,
                price: numericPrice,
                selling_price: numericPrice,
                stock_quantity: numericStock,
                image_url: formData.image_url?.trim() || null,
                is_active: formData.is_active,
              }
            : p
        )
      );

      setFeedback({ type: "success", message: `Successfully updated "${formData.name.trim()}"` });
      setIsEditOpen(false);
      setSelectedProduct(null);
    } catch (err: any) {
      console.error("Supabase Update Error Details:", {
        code: err?.code,
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
      });
      const alertMsg = `Could not save product: ${err?.message || err?.details || 'Check console for details'}`;
      setFeedback({ type: "error", message: alertMsg });
      alert(alertMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/pos/admin/secure/control-panel/love-and-happy"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to POS Control Panel
              </Link>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-teal-600" />
              Inventory &amp; Product Management
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit product details, manage stock levels, update pricing, and catalog categories.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchProducts()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link
              href="/pos/admin/secure/control-panel/love-and-happy"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Open POS Register
            </Link>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between border ${
              feedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-rose-50 text-rose-800 border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Search & Actions Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 sm:gap-4">
          <div className="relative flex-1 min-w-[140px] w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0 pointer-events-none" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium shrink-0">
            Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span> products
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50/80">
                <th className="w-[30%] text-left px-5 py-3.5">Product</th>
                <th className="w-[15%] text-left px-4 py-3.5">Category</th>
                <th className="w-[15%] text-left px-4 py-3.5">SKU</th>
                <th className="w-[15%] text-right px-4 py-3.5">Price</th>
                <th className="w-[12%] text-center px-4 py-3.5">Stock</th>
                <th className="w-[13%] text-right pr-5 py-3.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-xs font-semibold text-slate-400">
                    Loading inventory products...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-xs font-bold text-slate-500">
                    No products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const displayPrice = Number(product.price ?? product.selling_price) || 0;
                  const displayStock = product.stock_quantity ?? 0;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 text-teal-600 font-bold text-xs">
                              {product.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{product.name}</p>
                            {product.description && (
                              <p className="text-[11px] text-slate-400 truncate">{product.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 align-middle font-medium text-slate-700">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-semibold text-slate-600">
                          {product.category || "General"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 align-middle font-mono text-slate-500 text-[11px]">
                        {product.sku || "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right font-black text-slate-900 font-mono">
                        ₹{displayPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono ${
                            displayStock > 10
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : displayStock > 0
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
                          }`}
                        >
                          {displayStock}
                        </span>
                      </td>
                      <td className="pr-5 py-3.5 text-right align-middle">
                        <button
                          onClick={() => handleEditProduct(product)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 font-bold text-xs rounded-lg transition-colors border border-teal-200"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Product Modal / Drawer */}
      {isEditOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Pencil className="w-4 h-4 text-teal-600" />
                Edit Product
              </h2>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Premium Hair Spa"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional product or service details..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SKU / Item Code</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    placeholder="e.g. SKU-1001"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Category"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Image URL</label>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <label htmlFor="is_active" className="font-semibold text-slate-700 cursor-pointer">
                  Active (available in POS register)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

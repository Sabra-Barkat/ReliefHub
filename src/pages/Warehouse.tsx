import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { InventoryItem, InventoryCategory } from '../types';
import { ContextualAIPill } from '../components/ai/ContextualAIPill';
import {
  Warehouse as WarehouseIcon,
  Search,
  Plus,
  Filter,
  Download,
  AlertTriangle,
  Edit2,
  Trash2,
  X,
  Package,
  Layers,
} from 'lucide-react';

const CATEGORIES: InventoryCategory[] = [
  'Food & Nutrition',
  'Water & Sanitation',
  'Shelter & NFIs',
  'Medical Supplies',
  'Hygiene Kits',
  'Other',
];

export const Warehouse: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { refreshData, addToast, userRole } = useApp();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(
    searchParams.get('low_stock') === 'true'
  );

  // Form Modal
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Water & Sanitation' as InventoryCategory,
    unit: 'units',
    stock: 100,
    reorder_level: 50,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const fetchInventory = async () => {
    setIsLoading(true);
    try {
      const data = await api.getInventory({
        category: categoryFilter,
        low_stock: lowStockOnly,
        search: search.trim() || undefined,
      });
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [categoryFilter, lowStockOnly, search]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'Water & Sanitation',
      unit: 'units',
      stock: 100,
      reorder_level: 50,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      unit: item.unit,
      stock: item.stock,
      reorder_level: item.reorder_level,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const s = Number(formData.stock);
    const r = Number(formData.reorder_level);

    if (!formData.name.trim()) {
      setFormError('Item name is required.');
      return;
    }
    if (isNaN(s) || s < 0) {
      setFormError('Available stock cannot be negative.');
      return;
    }
    if (isNaN(r) || r < 0) {
      setFormError('Reorder level cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingItem) {
        await api.updateInventoryItem(editingItem.id, formData);
        addToast({
          type: 'success',
          title: 'Stock Updated',
          message: `Inventory item "${formData.name}" updated successfully.`,
        });
      } else {
        await api.createInventoryItem(formData);
        addToast({
          type: 'success',
          title: 'Item Registered',
          message: `Item "${formData.name}" added to warehouse catalogue.`,
        });
      }
      setIsFormOpen(false);
      await fetchInventory();
      await refreshData();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!window.confirm(`Delete "${item.name}" from warehouse records?`)) return;

    try {
      await api.deleteInventoryItem(item.id);
      addToast({
        type: 'success',
        title: 'Item Deleted',
        message: `Item "${item.name}" deleted.`,
      });
      await fetchInventory();
      await refreshData();
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Cannot Delete Item',
        message: err.message || 'Failed to delete item.',
      });
    }
  };

  const handleExportCSV = () => {
    if (items.length === 0) return;
    const headers = ['ID', 'Name', 'Category', 'Unit', 'Available Stock', 'Reorder Level', 'Status'];
    const rows = items.map((i) => [
      i.id,
      `"${i.name}"`,
      `"${i.category}"`,
      `"${i.unit}"`,
      i.stock,
      i.reorder_level,
      i.stock <= i.reorder_level ? 'LOW STOCK' : 'ADEQUATE',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reliefhub-warehouse-inventory-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-copper">
            <WarehouseIcon className="w-3.5 h-3.5" />
            <span>Central Relief Depot · Sukkur</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-ink mt-1">
            Warehouse & Inventory
          </h1>
          <p className="text-xs text-ink-muted mt-0.5">
            Real-time physical stock counts. Available stock reflects immediately confirmed reservations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <ContextualAIPill
            prompt="Find items that cannot cover current unallocated camp needs and calculate allocation feasibility."
            label="Stock Gap Analysis"
            agentType="supply_planning"
          />
          <ContextualAIPill
            prompt="Review replenishment requirements for all low-stock items in the central warehouse."
            label="Replenishment Audit"
            agentType="supply_planning"
          />
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface hover:bg-canvas border border-border rounded-md text-xs font-semibold text-ink transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-ink-muted" />
            <span>Export CSV</span>
          </button>

          {userRole === 'Operations Coordinator' && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-copper hover:bg-copper-hover text-white rounded-md text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Stock Item</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-surface p-4 rounded-lg border border-border shadow-card flex flex-wrap items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-ink-muted absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search items by name or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-canvas/40 border border-border rounded text-xs text-ink focus:border-copper focus:ring-1 focus:ring-copper"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-ink-muted" />
            <span className="text-ink-muted font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-canvas/50 border border-border rounded px-2.5 py-1 text-xs font-semibold text-ink cursor-pointer focus:outline-none"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <label className="flex items-center gap-2 cursor-pointer bg-canvas/40 border border-border px-3 py-1 rounded">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => {
                setLowStockOnly(e.target.checked);
                setSearchParams(e.target.checked ? { low_stock: 'true' } : {});
              }}
              className="rounded text-copper focus:ring-copper"
            />
            <span className="font-semibold text-ink text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-critical" />
              Low Stock Only
            </span>
          </label>

          {(search || categoryFilter !== 'all' || lowStockOnly) && (
            <button
              onClick={() => {
                setSearch('');
                setCategoryFilter('all');
                setLowStockOnly(false);
                setSearchParams({});
              }}
              className="text-[11px] text-copper hover:underline font-semibold"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-surface rounded-lg border border-border shadow-card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-ink-muted">
            <span className="w-6 h-6 border-2 border-copper/30 border-t-copper rounded-full animate-spin inline-block mb-2"></span>
            <p>Loading warehouse inventory...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-8 h-8 text-ink-faint mx-auto mb-2" />
            <h3 className="text-sm font-bold text-ink">No inventory items matched</h3>
            <p className="text-xs text-ink-muted mt-1">Try modifying your category or search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border bg-canvas/40 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Available Stock</th>
                  <th className="py-3 px-4 text-right">Reorder Threshold</th>
                  <th className="py-3 px-4 text-center">Inventory Health</th>
                  {userRole === 'Operations Coordinator' && (
                    <th className="py-3 px-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => {
                  const isLow = Number(item.stock) <= Number(item.reorder_level);

                  return (
                    <tr key={item.id} className="hover:bg-canvas/50 transition">
                      {/* Name */}
                      <td className="py-3.5 px-4 font-semibold text-ink">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-copper shrink-0" />
                          <span>{item.name}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4 text-ink-muted">
                        <span className="px-2 py-0.5 rounded bg-canvas border border-border text-[11px] font-medium">
                          {item.category}
                        </span>
                      </td>

                      {/* Available Stock */}
                      <td className="py-3.5 px-4 text-right font-bold tabular-nums text-sm">
                        <span className={isLow ? 'text-critical' : 'text-teal'}>
                          {item.stock.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-ink-muted ml-1 font-normal">{item.unit}</span>
                      </td>

                      {/* Reorder Threshold */}
                      <td className="py-3.5 px-4 text-right tabular-nums text-ink-muted">
                        <span>{item.reorder_level.toLocaleString()}</span>
                        <span className="text-[11px] ml-1">{item.unit}</span>
                      </td>

                      {/* Health Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-critical-light text-critical border border-critical-border">
                            <AlertTriangle className="w-3 h-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-light text-teal border border-teal-border/60">
                            Adequate
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      {userRole === 'Operations Coordinator' && (
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 text-ink-muted hover:text-ink hover:bg-canvas rounded transition"
                              title="Adjust stock or details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item)}
                              className="p-1.5 text-ink-muted hover:text-critical hover:bg-critical-light rounded transition"
                              title="Delete item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Item Modal (Create / Edit) */}
      {isFormOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-surface w-full max-w-md rounded-lg border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
              <h2 className="text-lg font-serif font-bold text-ink">
                {editingItem ? 'Adjust Inventory Stock' : 'Add New Inventory Item'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 rounded text-ink-muted hover:text-ink"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-critical-light border border-critical-border text-critical rounded font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-ink mb-1">Item Description / Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Water containers (20L)"
                  className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as InventoryCategory })
                    }
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Unit of Measure</label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="units, L, tents, packs..."
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink focus:border-copper"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink mb-1">Available Warehouse Stock</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink text-right font-semibold tabular-nums focus:border-copper"
                  />
                  <span className="text-[10px] text-ink-muted mt-0.5 block">Excludes active dispatches</span>
                </div>

                <div>
                  <label className="block font-semibold text-ink mb-1">Reorder Level Threshold</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.reorder_level}
                    onChange={(e) => setFormData({ ...formData, reorder_level: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-canvas/30 border border-border rounded text-ink text-right font-semibold tabular-nums focus:border-copper"
                  />
                  <span className="text-[10px] text-ink-muted mt-0.5 block">Triggers low stock alert</span>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 border border-border rounded text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-copper hover:bg-copper-hover text-white font-semibold rounded shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingItem ? 'Save Stock Adjustments' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

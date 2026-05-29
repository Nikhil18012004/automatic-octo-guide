/**
 * Reusable Store Item Search Dropdown Component
 * Consolidates duplicate item search logic from 5 store pages
 * 
 * Used in: StoreReceive, StoreIssue, StoreReturn, StoreAdjust, StoreGateRequest
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, X, Image } from 'lucide-react';
import { supabase } from '../supabase';

export function StoreItemSearchDropdown({
  value = null,
  onChange = () => {},
  onSelect = () => {},
  placeholder = 'Search items…',
  disabled = false,
  allowNew = false,
  onNewItem = null,
}) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(true);

  const searchInputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Fetch all active store items on mount
  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_items')
        .select('id, name, unit, item_image_url, category')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error('Error fetching items:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items by search term
  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  // Handle item selection
  const handleSelectItem = (item) => {
    onSelect(item);
    setSearch(item.name);
    setShowDropdown(false);
  };

  // Handle item clear
  const handleClear = () => {
    setSearch('');
    onChange('');
    setShowDropdown(false);
  };

  // Handle search input change
  const handleSearchChange = (e) => {
    const newSearch = e.target.value;
    setSearch(newSearch);
    onChange(newSearch);
    setShowDropdown(!!newSearch);
  };

  return (
    <div className="relative">
      {value ? (
        // Selected item display
        <div className="flex items-center gap-3 p-3 border border-brand-200 bg-brand-50 rounded-lg">
          {value.item_image_url ? (
            <img
              src={value.item_image_url}
              alt={value.name}
              className="w-10 h-10 rounded object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
              <Image size={16} className="text-gray-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{value.name}</p>
            <p className="text-xs text-gray-500">
              {value.category} · {value.unit}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="p-1 hover:bg-white rounded disabled:opacity-50"
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>
      ) : (
        // Search input
        <>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text"
              disabled={disabled || loading}
              placeholder={loading ? 'Loading items…' : placeholder}
              value={search}
              onChange={handleSearchChange}
              onFocus={() => setShowDropdown(!!search)}
              className="input pl-9 disabled:opacity-50"
            />
          </div>

          {/* Dropdown menu */}
          {showDropdown && search && (
            <div
              ref={dropdownRef}
              className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto"
            >
              {filteredItems.length === 0 ? (
                <div className="p-3 text-sm text-gray-400">
                  No items found
                  {allowNew && onNewItem && (
                    <button
                      type="button"
                      onClick={() => {
                        onNewItem(search);
                        setSearch('');
                        setShowDropdown(false);
                      }}
                      className="block mt-2 text-brand-600 hover:underline"
                    >
                      Create "{search}" as new item
                    </button>
                  )}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2 transition-colors"
                  >
                    {item.item_image_url ? (
                      <img
                        src={item.item_image_url}
                        alt={item.name}
                        className="w-6 h-6 rounded object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center">
                        <Image size={12} className="text-gray-400" />
                      </div>
                    )}
                    <span className="flex-1">
                      {item.name}
                      <span className="text-gray-400 text-xs ml-1">({item.unit})</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default StoreItemSearchDropdown;

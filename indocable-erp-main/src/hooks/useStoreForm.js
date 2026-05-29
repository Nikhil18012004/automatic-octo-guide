/**
 * useStoreForm Hook
 * Centralized form state management for all store operations
 * Used in: StoreReceive, StoreIssue, StoreReturn, StoreAdjust, StoreGateRequest
 */

import { useState, useCallback } from 'react';

/**
 * Manage form state with standardized update/reset patterns
 * @param {object} initialState - Initial form state
 * @returns {object} { form, setForm, updateForm, resetForm, saving, setSaving }
 */
export function useStoreForm(initialState = {}) {
  const [form, setForm] = useState(initialState);
  const [saving, setSaving] = useState(false);

  /**
   * Batch update form fields
   * @param {object} updates - Fields to update
   */
  const updateForm = useCallback((updates) => {
    setForm((prevForm) => ({ ...prevForm, ...updates }));
  }, []);

  /**
   * Update single form field
   * @param {string} field - Field name
   * @param {any} value - New value
   */
  const updateField = useCallback((field, value) => {
    setForm((prevForm) => ({ ...prevForm, [field]: value }));
  }, []);

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setForm(initialState);
  }, [initialState]);

  /**
   * Clear a specific field
   * @param {string} field - Field name
   */
  const clearField = useCallback((field) => {
    setForm((prevForm) => ({ ...prevForm, [field]: initialState[field] || '' }));
  }, [initialState]);

  return {
    form,
    setForm,
    updateForm,
    updateField,
    resetForm,
    clearField,
    saving,
    setSaving,
  };
}

/**
 * Validate required fields in form
 * @param {object} form - Form object
 * @param {array} requiredFields - Array of field names to check
 * @returns {object} { valid: boolean, errors: { fieldName: errorMessage } }
 */
export function validateFormFields(form, requiredFields) {
  const errors = {};
  let valid = true;

  requiredFields.forEach((field) => {
    const value = form[field];
    if (value === undefined || value === null || value === '') {
      errors[field] = `${field} is required`;
      valid = false;
    }
  });

  return { valid, errors };
}

/**
 * Validate quantity within acceptable range
 * @param {number} quantity - Quantity to validate
 * @param {number} min - Minimum allowed (default 0.01)
 * @param {number} max - Maximum allowed (default 999999)
 * @returns {object} { valid: boolean, error: string }
 */
export function validateQuantity(quantity, min = 0.01, max = 999999) {
  const num = Number(quantity);

  if (isNaN(num)) {
    return { valid: false, error: 'Quantity must be a number' };
  }

  if (num < min) {
    return { valid: false, error: `Quantity must be at least ${min}` };
  }

  if (num > max) {
    return { valid: false, error: `Quantity cannot exceed ${max}` };
  }

  return { valid: true, error: null };
}

/**
 * Validate unit price
 * @param {number} price - Price to validate
 * @returns {object} { valid: boolean, error: string }
 */
export function validatePrice(price) {
  const num = Number(price);

  if (isNaN(num)) {
    return { valid: false, error: 'Price must be a number' };
  }

  if (num < 0) {
    return { valid: false, error: 'Price cannot be negative' };
  }

  return { valid: true, error: null };
}

import { supabase } from './database.js';
import { Tables, Category } from '../types/database.js';

/**
 * Category management service
 */

/**
 * Get all categories available for a hostel (global + hostel-specific)
 */
export async function getCategoriesForHostel(hostelId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from(Tables.CATEGORIES)
    .select('*')
    .or(`is_global.eq.true,hostel_id.eq.${hostelId}`)
    .order('display_order');

  if (error) {
    console.error('Error fetching categories:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get all global categories
 */
export async function getGlobalCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from(Tables.CATEGORIES)
    .select('*')
    .eq('is_global', true)
    .order('display_order');

  if (error) {
    console.error('Error fetching global categories:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get hostel-specific categories
 */
export async function getHostelCategories(hostelId: string): Promise<Category[]> {
  const { data, error } = await supabase
    .from(Tables.CATEGORIES)
    .select('*')
    .eq('hostel_id', hostelId)
    .eq('is_global', false)
    .order('display_order');

  if (error) {
    console.error('Error fetching hostel categories:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get a category by ID
 */
export async function getCategoryById(categoryId: string): Promise<Category | null> {
  const { data, error } = await supabase
    .from(Tables.CATEGORIES)
    .select('*')
    .eq('id', categoryId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching category:', error);
    throw error;
  }

  return data;
}

/**
 * Create a new category for a hostel
 */
export async function createCategory(
  hostelId: string,
  name: string,
  icon: string,
  displayOrder?: number
): Promise<Category> {
  // Get max display order if not provided
  let order = displayOrder;
  if (order === undefined) {
    const { data: maxOrder } = await supabase
      .from(Tables.CATEGORIES)
      .select('display_order')
      .or(`is_global.eq.true,hostel_id.eq.${hostelId}`)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    order = (maxOrder?.display_order || 0) + 1;
  }

  const { data, error } = await supabase
    .from(Tables.CATEGORIES)
    .insert({
      hostel_id: hostelId,
      name,
      icon,
      is_global: false,
      display_order: order,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    throw error;
  }

  return data;
}

/**
 * Update a category
 */
export async function updateCategory(
  categoryId: string,
  updates: {
    name?: string;
    icon?: string;
    display_order?: number;
  }
): Promise<Category> {
  const { data, error } = await supabase
    .from(Tables.CATEGORIES)
    .update(updates)
    .eq('id', categoryId)
    .select()
    .single();

  if (error) {
    console.error('Error updating category:', error);
    throw error;
  }

  return data;
}

/**
 * Delete a category
 * Note: Resources will have their category_id set to null (ON DELETE SET NULL)
 */
export async function deleteCategory(categoryId: string): Promise<void> {
  // Check if it's a global category (can't delete those)
  const { data: category, error: checkError } = await supabase
    .from(Tables.CATEGORIES)
    .select('is_global')
    .eq('id', categoryId)
    .single();

  if (checkError) {
    console.error('Error checking category:', checkError);
    throw checkError;
  }

  if (category?.is_global) {
    throw new Error('Cannot delete global categories');
  }

  const { error } = await supabase
    .from(Tables.CATEGORIES)
    .delete()
    .eq('id', categoryId);

  if (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
}

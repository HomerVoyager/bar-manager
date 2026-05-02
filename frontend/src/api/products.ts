// バー管理システム - 商品API
// 商品・ドリンクメニューに関するAPI呼び出しを定義します

import { apiClient } from './client';
import type { Product } from '../types';

// 商品一覧を取得（在庫情報含む）
export const fetchProducts = async (): Promise<Product[]> => {
  const response = await apiClient.get<Product[]>('/products');
  return response.data;
};

// カテゴリ別商品一覧を取得
export const fetchProductsByCategory = async (category: string): Promise<Product[]> => {
  const response = await apiClient.get<Product[]>(`/products?category=${category}`);
  return response.data;
};

// 商品詳細を取得
export const fetchProductById = async (id: number): Promise<Product> => {
  const response = await apiClient.get<Product>(`/products/${id}`);
  return response.data;
};

// 商品を新規作成
export const createProduct = async (data: Omit<Product, 'id' | 'is_low_stock'>): Promise<Product> => {
  const response = await apiClient.post<Product>('/products', data);
  return response.data;
};

// 商品情報を更新
export const updateProduct = async (id: number, data: Partial<Product>): Promise<Product> => {
  const response = await apiClient.put<Product>(`/products/${id}`, data);
  return response.data;
};

// 在庫不足商品一覧を取得
export const fetchLowStockProducts = async (): Promise<Product[]> => {
  const response = await apiClient.get<Product[]>('/products/low-stock');
  return response.data;
};

// 商品カテゴリ一覧を取得
export const fetchCategories = async (): Promise<string[]> => {
  const response = await apiClient.get<string[]>('/products/categories');
  return response.data;
};

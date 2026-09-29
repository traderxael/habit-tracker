import type { Category, Debt, FinanceSummary, Goal, GoalContribution, Transaction } from "../types";

const TOKEN_KEY = "ht_token";

// En dev, vacío: las llamadas van a /api y el proxy de Vite las lleva al backend.
// En producción con backend separado, definir VITE_API_BASE (p. ej. https://api.midominio.com).
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    method: opts.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data && typeof data === "object" && "error" in data ? String(data.error) : res.statusText;
    throw new ApiError(res.status, message);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export const financeApi = {
  listCategories: () => api.get<{ categories: Category[] }>("/categories"),
  createCategory: (body: { name: string; icon?: string; type: "income" | "expense"; color?: string }) =>
    api.post<{ category: Category }>("/categories", body),
  deleteCategory: (id: number) => api.del<void>(`/categories/${id}`),

  listTransactions: (month: string) => api.get<{ transactions: Transaction[] }>(`/transactions?month=${month}`),
  createTransaction: (body: {
    type: "income" | "expense";
    amount_cents: number;
    date: string;
    category_id?: number | null;
    note?: string;
  }) => api.post<{ transaction: Transaction }>("/transactions", body),
  updateTransaction: (id: number, body: { amount_cents?: number; note?: string; date?: string }) =>
    api.put<{ transaction: Transaction }>(`/transactions/${id}`, body),
  deleteTransaction: (id: number) => api.del<void>(`/transactions/${id}`),
  summary: (month: string) => api.get<FinanceSummary>(`/finance/summary?month=${month}`),

  listDebts: () => api.get<{ debts: Debt[] }>("/debts"),
  createDebt: (body: { name: string; total_cents: number; due_date?: string | null }) =>
    api.post<{ debt: Debt }>("/debts", body),
  updateDebt: (id: number, body: { name?: string; total_cents?: number; due_date?: string | null }) =>
    api.put<{ debt: Debt }>(`/debts/${id}`, body),
  deleteDebt: (id: number) => api.del<void>(`/debts/${id}`),
  payDebt: (id: number, body: { amount_cents: number; date?: string; note?: string }) =>
    api.post<{ debt: Debt; transactionId: number }>(`/debts/${id}/payments`, body),

  listGoals: () => api.get<{ goals: Goal[] }>("/goals"),
  createGoal: (body: { name: string; icon?: string; target_cents: number; deadline?: string | null }) =>
    api.post<{ goal: Goal }>("/goals", body),
  updateGoal: (
    id: number,
    body: { name?: string; icon?: string | null; target_cents?: number; deadline?: string | null },
  ) => api.put<{ goal: Goal }>(`/goals/${id}`, body),
  deleteGoal: (id: number) => api.del<void>(`/goals/${id}`),
  contribute: (goalId: number, body: { amount_cents: number; date?: string }) =>
    api.post<{ contribution: GoalContribution }>(`/goals/${goalId}/contributions`, body),
  deleteContribution: (goalId: number, contributionId: number) =>
    api.del<void>(`/goals/${goalId}/contributions/${contributionId}`),
};

export interface User {
  id: number;
  email: string;
}

export interface Schedule {
  type?: "daily" | "weekdays";
  days?: number[]; // 0=domingo .. 6=sábado
}

export interface HabitStats {
  currentStreak: number;
  bestStreak: number;
  last30Pct: number;
}

export interface Habit {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
  schedule: Schedule;
  archived: boolean;
  goalId: number | null;
  goalAmountCents: number | null;
  createdAt: string;
  stats?: HabitStats;
}

export interface Completion {
  habit_id: number;
  date: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  type: "income" | "expense";
  color: string | null;
  createdAt: string;
}

export interface Transaction {
  id: number;
  type: "income" | "expense";
  amountCents: number;
  note: string | null;
  date: string;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  debtId: number | null;
  createdAt: string;
}

export interface CategorySummary {
  categoryId: number;
  name: string;
  icon: string | null;
  color: string | null;
  total: number;
}

export interface FinanceSummary {
  income: number;
  expense: number;
  balance: number;
  byCategory: CategorySummary[];
}

export interface Debt {
  id: number;
  name: string;
  totalCents: number;
  paidCents: number;
  remainingCents: number;
  dueDate: string | null;
  createdAt: string;
}

export interface Goal {
  id: number;
  name: string;
  icon: string | null;
  targetCents: number;
  savedCents: number;
  deadline: string | null;
  createdAt: string;
}

export interface GoalContribution {
  id: number;
  goalId: number;
  amountCents: number;
  habitId: number | null;
  date: string;
  createdAt: string;
}

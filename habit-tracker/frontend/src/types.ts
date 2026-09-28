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
  createdAt: string;
  stats?: HabitStats;
}

export interface Completion {
  habit_id: number;
  date: string;
}

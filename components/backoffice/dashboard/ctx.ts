import type { Dashboard, DashMember, DashSum, Metric, Range, SegKey } from "@/lib/dashboard";
import type { Ingredient } from "@/lib/types";

export type Drill = { type: "segment"; seg: SegKey } | { type: "member"; m: DashMember } | { type: "refunds" } | { type: "lowstock" };

// What every dashboard tab gets from the shell
export type DashCtx = {
  D: Dashboard;
  r: Range;
  cur: DashSum;
  prev: DashSum;
  compare: boolean;
  narrow: boolean;
  now: Date;
  segs: Record<SegKey, DashMember[]>;
  low: Ingredient[];
  age: number;
  drill: (d: Drill) => void;
  go: (path: string) => void;
  setTab: (t: DashTab) => void;
  metric: Metric;
  setMetric: (m: Metric) => void;
};

export type DashTab = "overview" | "sales" | "menu" | "customers" | "rewards" | "stock";

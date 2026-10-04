"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { ShiftReport } from "./types";

// Under the ["cash-session"] prefix so sign-out's removeQueries clears it too.
export const reportKey = (id: string) => ["cash-session", id, "report"] as const;

// GET /cash-session/:id/report — a closed shift's report never changes (refunds need an open session).
export function useShiftReport(id: string, closed: boolean) {
  return useQuery({
    queryKey: reportKey(id),
    queryFn: () => api.get<ShiftReport>(`/cash-session/${id}/report`),
    staleTime: closed ? Infinity : 0,
  });
}

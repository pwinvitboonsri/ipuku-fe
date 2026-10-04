import { Suspense } from "react";
import { ShiftOrders } from "@/components/counter/shift-orders";

export default function OrdersPage() {
  // ShiftOrders reads ?status= via useSearchParams
  return (
    <Suspense>
      <ShiftOrders />
    </Suspense>
  );
}

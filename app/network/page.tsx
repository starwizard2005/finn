import { Suspense } from "react";
import { NetworkView } from "@/components/network-view";

export default function NetworkPage() {
  return (
    <Suspense>
      <NetworkView />
    </Suspense>
  );
}

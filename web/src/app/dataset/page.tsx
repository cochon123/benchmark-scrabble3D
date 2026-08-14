import { DatasetExplorer } from "@/components/DatasetExplorer";
import { getPositions } from "@/lib/data";

export const dynamic = "force-dynamic";

export default function DatasetPage() {
  return <DatasetExplorer positions={getPositions()} />;
}

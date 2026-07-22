import { Loader2 } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="container py-24 flex items-center justify-center">
      <Loader2 className="size-6 text-muted-foreground animate-spin" />
    </div>
  );
}

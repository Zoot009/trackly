"use client";

import { useScreenshots } from "@/hooks/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { ScreenshotPreview } from "@/components/screenshot-preview";

export function RecentScreenshots() {
  const { data, isLoading } = useScreenshots({ page: 1 });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No screenshots captured yet.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {data.data.slice(0, 6).map((shot) => (
        <ScreenshotPreview key={shot.id} shot={shot} />
      ))}
    </div>
  );
}

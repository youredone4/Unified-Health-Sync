import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ListSkeletonProps {
  rows?: number;
  testId?: string;
}

/**
 * ListSkeleton — shimmer placeholder for list-shaped data while it loads.
 * Roughly matches the visual weight of a row in the priority list / inbox
 * so the layout doesn't jump when real data arrives.
 */
export function ListSkeleton({ rows = 5, testId = "list-skeleton" }: ListSkeletonProps) {
  return (
    <Card data-testid={testId} aria-busy="true" aria-label="Loading">
      <CardContent className="py-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="w-2.5 h-2.5 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

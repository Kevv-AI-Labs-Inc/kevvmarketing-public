"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ShareLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Agent header: avatar + name/subtitle */}
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>

        {/* Page title */}
        <Skeleton className="h-7 w-3/4 mb-6" />

        {/* Listing cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="mb-6 rounded-xl border border-gray-100 overflow-hidden"
          >
            {/* Image placeholder */}
            <Skeleton className="aspect-video w-full rounded-none" />

            {/* Card body */}
            <div className="p-4 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />

              {/* Badge row */}
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-6 w-16 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-14 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

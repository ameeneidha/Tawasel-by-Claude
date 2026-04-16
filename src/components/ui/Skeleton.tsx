import React from 'react';

type SkeletonProps = {
  className?: string;
};

type SkeletonTableProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

/** Base skeleton primitive -- pass any Tailwind sizing classes via `className`. */
export const Skeleton: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={`animate-pulse rounded-xl bg-gray-200 dark:bg-slate-700 ${className || ''}`}
    />
  );
};

/** Card-shaped skeleton with a few inner placeholder lines. */
export const SkeletonCard: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={`rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 ${className || ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-3 w-36" />
        </div>
        <Skeleton className="h-11 w-11 rounded-2xl" />
      </div>
    </div>
  );
};

/** Small metric card skeleton -- icon circle + two text lines. */
export const SkeletonMetric: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={`rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 ${className || ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-10 w-10 rounded-full" />
      </div>
    </div>
  );
};

/** Chart / section card skeleton -- tall card with horizontal bars inside. */
export const SkeletonChartCard: React.FC<SkeletonProps> = ({ className }) => {
  return (
    <div
      className={`rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 ${className || ''}`}
    >
      <div className="space-y-3 mb-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
        <Skeleton className="h-3 w-3/6" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    </div>
  );
};

/** Table rows skeleton -- header bar + N row skeletons. */
export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  rows = 6,
  columns = 6,
  className,
}) => {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${className || ''}`}
    >
      {/* Header */}
      <div className="flex gap-4 bg-gray-50 dark:bg-slate-950/50 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton
            key={`header-${i}`}
            className={`h-3 ${i === 0 ? 'w-8' : 'w-24'}`}
          />
        ))}
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton
                key={`cell-${rowIndex}-${colIndex}`}
                className={`h-4 ${colIndex === 0 ? 'w-4' : colIndex === 1 ? 'w-28' : 'w-20'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

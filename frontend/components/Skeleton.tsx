"use client";

type SkeletonBlockProps = {
  className?: string;
  style?: React.CSSProperties;
};

export function SkeletonBlock({ className = "", style }: SkeletonBlockProps) {
  return <div className={`skeleton ${className}`.trim()} style={style} aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <SkeletonBlock className="skeleton--title" />
      <SkeletonBlock className="skeleton--line" />
      <SkeletonBlock className="skeleton--line skeleton--line-short" />
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonKpiGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton-kpi" aria-hidden="true">
          <SkeletonBlock className="skeleton--label" />
          <SkeletonBlock className="skeleton--value" />
          <SkeletonBlock className="skeleton--line skeleton--line-short" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table-wrap" aria-hidden="true">
      <div className="skeleton-table-head">
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBlock key={i} className="skeleton--th" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="skeleton-table-row">
          {Array.from({ length: cols }, (_, col) => (
            <SkeletonBlock key={col} className="skeleton--td" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard" aria-hidden="true">
      <SkeletonKpiGrid count={4} />
      <div className="skeleton-dashboard-panels">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <SkeletonTable rows={4} cols={6} />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="skeleton-chart" aria-hidden="true">
      <SkeletonBlock className="skeleton--title" />
      <div className="skeleton-chart-bars">
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonBlock key={i} className="skeleton--bar" style={{ height: `${40 + (i % 3) * 20}%` }} />
        ))}
      </div>
    </div>
  );
}

"use client";

export function SkeletonCard() {
  return (
    <div
      style={{
        background: "rgba(26, 35, 50, 0.6)",
        border: "1px solid rgba(0, 180, 216, 0.1)",
        borderRadius: "12px",
        padding: "1.5rem",
        display: "grid",
        gap: "1rem",
      }}
    >
      <div
        style={{
          height: "24px",
          background: "linear-gradient(90deg, rgba(0,180,216,0.1), rgba(0,180,216,0.05))",
          borderRadius: "4px",
          animation: "pulse 1.5s ease-in-out infinite",
        }}
      />
      <div
        style={{
          height: "16px",
          background: "linear-gradient(90deg, rgba(0,180,216,0.1), rgba(0,180,216,0.05))",
          borderRadius: "4px",
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: "0.2s",
        }}
      />
      <div
        style={{
          height: "16px",
          width: "70%",
          background: "linear-gradient(90deg, rgba(0,180,216,0.1), rgba(0,180,216,0.05))",
          borderRadius: "4px",
          animation: "pulse 1.5s ease-in-out infinite",
          animationDelay: "0.4s",
        }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
        gap: "1.5rem",
      }}
    >
      {Array(count)
        .fill(0)
        .map((_, i) => (
          <SkeletonCard key={i} />
        ))}
    </div>
  );
}

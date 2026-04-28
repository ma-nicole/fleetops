type KpiCardProps = {
  label: string;
  value: string | number;
};

export default function KpiCard({ label, value }: KpiCardProps) {
  return (
    <div className="card" style={{ display: "grid", gap: "0.25rem" }}>
      <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>{label}</span>
      <strong style={{ fontSize: "1.35rem" }}>{value}</strong>
    </div>
  );
}

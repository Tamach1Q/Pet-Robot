type RatingSelectorProps = {
  labels: string[];
  selectedLabel?: string | null;
  onSelect?: (label: string) => void;
};

export function RatingSelector({
  labels,
  selectedLabel = null,
  onSelect,
}: RatingSelectorProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${labels.length}, 1fr)`,
        gap: "10px",
      }}
    >
      {labels.map((label) => (
        <button
          key={label}
          type="button"
          onClick={() => onSelect?.(label)}
          style={{
            minHeight: "52px",
            borderRadius: "16px",
            border: selectedLabel === label ? "2px solid var(--accent)" : "1px solid var(--line)",
            background: selectedLabel === label ? "#f7e6d7" : "#fff",
            fontSize: "18px",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

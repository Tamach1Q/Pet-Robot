type SecondaryButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
};

export function SecondaryButton({
  children,
  onClick,
  type = "button",
  disabled = false,
}: SecondaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        borderRadius: "18px",
        border: "1px solid var(--line)",
        background: "var(--soft)",
        color: "var(--ink)",
        padding: "16px 18px",
        fontSize: "18px",
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}

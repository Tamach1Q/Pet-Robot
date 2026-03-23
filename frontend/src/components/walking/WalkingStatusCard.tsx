export function WalkingStatusCard() {
  return (
    <div style={{ display: "grid", gap: "16px" }}>
      <section
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "22px",
          padding: "20px",
        }}
      >
        <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>のこり時間</p>
        <h2 style={{ margin: "10px 0 0", fontSize: "34px", lineHeight: 1.1 }}>4分くらい</h2>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid var(--line)",
          borderRadius: "22px",
          padding: "20px",
        }}
      >
        <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "14px" }}>いまのようす</p>
        <p style={{ margin: 0, fontSize: "22px", lineHeight: 1.6 }}>いまは ゆっくり歩いています</p>
      </section>

      <section
        style={{
          background: "linear-gradient(180deg, #f3eadc 0%, #ebdcc8 100%)",
          borderRadius: "22px",
          padding: "22px",
        }}
      >
        <div
          style={{
            height: "18px",
            borderRadius: "999px",
            background: "rgba(120, 93, 63, 0.12)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: "58%",
              height: "100%",
              background: "var(--accent)",
            }}
          />
        </div>
        <p style={{ margin: "14px 0 0", color: "var(--muted)", lineHeight: 1.7 }}>
          操作はリードで行う想定です。
          この画面では、いまの状態だけを表示します。
        </p>
      </section>
    </div>
  );
}

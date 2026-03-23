type ScreenShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function ScreenShell({ title, description, children }: ScreenShellProps) {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "440px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "28px",
          padding: "24px",
          boxShadow: "0 20px 60px rgba(88, 57, 33, 0.08)",
        }}
      >
        <header style={{ marginBottom: "20px" }}>
          <p
            style={{
              margin: 0,
              color: "var(--muted)",
              fontSize: "14px",
              letterSpacing: "0.04em",
            }}
          >
            PET ROBOT
          </p>
          <h1
            style={{
              margin: "10px 0 8px",
              fontSize: "32px",
              lineHeight: 1.2,
            }}
          >
            {title}
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--muted)",
              fontSize: "16px",
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        </header>
        {children}
      </section>
    </main>
  );
}

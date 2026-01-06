export default function Landing({ onUser, onWorker }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f6f7fb",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "white",
          borderRadius: 24,
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          padding: 24,
          display: "grid",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Micro Fixer</h1>
          <p style={{ marginTop: 8, opacity: 0.8 }}>
            Small jobs. Fast help.
          </p>
        </div>

        <p style={{ fontSize: 14, opacity: 0.85 }}>
          Post a task in minutes. Nearby workers accept, start, and complete
          jobs—all from your phone.
        </p>

        <button
          onClick={onUser}
          style={{
            padding: 14,
            borderRadius: 14,
            border: "none",
            fontWeight: 800,
            background: "#111",
            color: "white",
            cursor: "pointer",
          }}
        >
          I need help
        </button>

        <button
          onClick={onWorker}
          style={{
            padding: 14,
            borderRadius: 14,
            border: "1px solid #111",
            fontWeight: 800,
            background: "white",
            color: "#111",
            cursor: "pointer",
          }}
        >
          I want to work
        </button>

        <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
          Transparent pricing · Local workers · Mobile-first
        </div>
      </div>
    </div>
  );
}

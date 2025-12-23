import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3000";

/* ------------------ UI Helpers ------------------ */

function Input({ label, ...props }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>{label}</div>
      <input
        {...props}
        style={{
          padding: 12,
          borderRadius: 12,
          border: "1px solid #ddd",
          fontSize: 14,
        }}
      />
    </label>
  );
}

function Button({ children, style, ...props }) {
  return (
    <button
      {...props}
      style={{
        padding: 12,
        borderRadius: 12,
        border: "none",
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function badge(status) {
  const map = {
    requested: "#e5e7eb",
    assigned: "#bae6fd",
    in_progress: "#fed7aa",
    completed: "#bbf7d0",
  };
  return {
    background: map[status] || "#e5e7eb",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 800,
    width: "fit-content",
  };
}

const dollars = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;

/* ------------------ APP ------------------ */

export default function App() {
  const [tab, setTab] = useState("login"); // login | tasks | create
  const [mode, setMode] = useState("user"); // user | worker
  const [workerView, setWorkerView] = useState("available"); // available | assigned | history

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refreshToken") || ""
  );

  const authed = useMemo(() => !!token, [token]);
  const isWorker = mode === "worker";

  const [email, setEmail] = useState("testuser2@example.com");
  const [password, setPassword] = useState("Pass123!");
  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [address, setAddress] = useState("");

  /* ------------------ API ------------------ */

  async function api(path, options = {}, retry = false) {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json().catch(() => ({}));

    if (
      !retry &&
      refreshToken &&
      String(data?.error || "").toLowerCase().includes("token")
    ) {
      const r = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const rd = await r.json().catch(() => ({}));
      if (rd?.token) {
        localStorage.setItem("token", rd.token);
        setToken(rd.token);
        return api(path, options, true);
      }
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data?.error || "Request failed");
    }
    return data;
  }

  /* ------------------ AUTH ------------------ */

  async function login(e) {
    e.preventDefault();
    const d = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem("token", d.token);
    localStorage.setItem("refreshToken", d.refreshToken);
    setToken(d.token);
    setRefreshToken(d.refreshToken);
    setTab("tasks");
    setMsg("Logged in");
  }

  function logout() {
    localStorage.clear();
    setToken("");
    setTasks([]);
    setTab("login");
  }

  /* ------------------ LOADERS ------------------ */

  const loadMine = async () =>
    setTasks((await api("/api/tasks/mine")).tasks || []);

  const loadAvailable = async () =>
    setTasks((await api("/api/tasks/available")).tasks || []);

  const loadAssigned = async () =>
    setTasks((await api("/api/tasks/assigned")).tasks || []);

  const loadHistory = async () =>
    setTasks((await api("/api/tasks/history")).tasks || []);

  /* ------------------ ACTIONS ------------------ */

  const accept = async (id) => {
    await api(`/api/tasks/${id}/accept`, { method: "POST" });
    setWorkerView("assigned");
    loadAssigned();
  };

  const start = async (id) => {
    await api(`/api/tasks/${id}/start`, { method: "POST" });
    loadAssigned();
  };

  const complete = async (id) => {
    await api(`/api/tasks/${id}/complete`, { method: "POST" });
    workerView === "history" ? loadHistory() : loadAssigned();
  };

  const create = async (e) => {
    e.preventDefault();
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        title,
        description,
        category,
        price_cents: Number(price),
        lat: 33.4484,
        lng: -112.074,
        address,
      }),
    });
    setTab("tasks");
    loadMine();
  };

  /* ------------------ AUTO LOAD ------------------ */

  useEffect(() => {
    if (!authed || tab !== "tasks") return;
    if (!isWorker) loadMine();
    else if (workerView === "available") loadAvailable();
    else if (workerView === "assigned") loadAssigned();
    else loadHistory();
  }, [authed, tab, mode, workerView]);

  /* ------------------ UI ------------------ */

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <div style={{ width: 420, background: "#fff", borderRadius: 24 }}>
        <div style={{ padding: 16, fontWeight: 900 }}>Micro Fixer</div>

        <div style={{ padding: 16 }}>
          {msg && <div style={{ fontSize: 13 }}>{msg}</div>}

          {!authed ? (
            <form onSubmit={login} style={{ display: "grid", gap: 10 }}>
              <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button style={{ background: "#111", color: "#fff" }}>Login</Button>
            </form>
          ) : tab === "create" ? (
            <form onSubmit={create} style={{ display: "grid", gap: 10 }}>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <Input label="Price (cents)" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Button style={{ background: "#111", color: "#fff" }}>Create</Button>
            </form>
          ) : (
            <>
              {isWorker && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {["available", "assigned", "history"].map((v) => (
                    <Button
                      key={v}
                      onClick={() => setWorkerView(v)}
                      style={{
                        background: workerView === v ? "#111" : "#666",
                        color: "#fff",
                      }}
                    >
                      {v}
                    </Button>
                  ))}
                </div>
              )}

              {tasks.map((t) => (
                <div key={t.id} style={{ border: "1px solid #eee", padding: 10, marginTop: 10 }}>
                  <div style={badge(t.status)}>{t.status}</div>
                  <b>{t.title}</b>
                  <div>{dollars(t.price_cents)}</div>

                  {isWorker && workerView === "available" && (
                    <Button onClick={() => accept(t.id)} style={{ background: "#111", color: "#fff" }}>
                      Accept
                    </Button>
                  )}
                  {isWorker && workerView === "assigned" && t.status === "assigned" && (
                    <Button onClick={() => start(t.id)} style={{ background: "#111", color: "#fff" }}>
                      Start
                    </Button>
                  )}
                  {isWorker && workerView !== "available" && t.status !== "completed" && (
                    <Button onClick={() => complete(t.id)} style={{ background: "#111", color: "#fff" }}>
                      Complete
                    </Button>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
          <button onClick={() => { setMode("user"); setTab("tasks"); setEmail("testuser2@example.com"); }}>Tasks</button>
          <button onClick={() => setTab("create")}>Create</button>
          <button onClick={() => { setMode("worker"); setTab("tasks"); setEmail("worker1@example.com"); }}>Worker</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";

const API = "http://localhost:3000";

/* ---------------- UI bits ---------------- */

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

function Button({ children, style, disabled, ...props }) {
  return (
    <button
      {...props}
      disabled={disabled}
      style={{
        padding: 12,
        borderRadius: 12,
        border: "none",
        fontSize: 14,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: active ? "#111" : "white",
        color: active ? "white" : "#111",
        fontSize: 12,
        fontWeight: 900,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function statusStyle(status) {
  const base = {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 900,
    padding: "6px 10px",
    borderRadius: 999,
    width: "fit-content",
    letterSpacing: 0.3,
  };
  switch (status) {
    case "requested":
      return { ...base, background: "#f3f4f6", color: "#374151" };
    case "assigned":
      return { ...base, background: "#e0f2fe", color: "#075985" };
    case "in_progress":
      return { ...base, background: "#ffedd5", color: "#9a3412" };
    case "completed":
      return { ...base, background: "#dcfce7", color: "#166534" };
    case "cancelled":
      return { ...base, background: "#fee2e2", color: "#991b1b" };
    default:
      return { ...base, background: "#f3f4f6", color: "#374151" };
  }
}

const dollars = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;

/* ---------------- App ---------------- */

export default function App() {
  const [tab, setTab] = useState("login"); // login | tasks | create
  const [mode, setMode] = useState("user"); // user | worker
  const isWorker = mode === "worker";

  // Worker tabs inside Tasks
  const [workerView, setWorkerView] = useState("available"); // available | assigned | history
  const [historyFilter, setHistoryFilter] = useState("completed"); // completed | cancelled | all

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [refreshToken, setRefreshToken] = useState(
    localStorage.getItem("refreshToken") || ""
  );
  const authed = useMemo(() => !!token, [token]);

  const [email, setEmail] = useState("testuser2@example.com");
  const [password, setPassword] = useState("Pass123!");

  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState(""); // banner message
  const [busy, setBusy] = useState(false); // prevents double clicks

  // Create task fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [address, setAddress] = useState("");

  function flash(text) {
    setMsg(text);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setMsg(""), 3000);
  }

  /* -------- API with auto refresh -------- */

  async function api(path, options = {}, retry = false) {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    const errText = String(data?.error || "").toLowerCase();

    // refresh once if token bad
    if (!retry && refreshToken && (errText.includes("expired") || errText.includes("invalid"))) {
      const r = await fetch(`${API}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const rd = await r.json().catch(() => ({}));
      if (r.ok && rd.ok && rd.token) {
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

  /* -------- AUTH -------- */

  async function doLogin(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const d = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", d.token);
      localStorage.setItem("refreshToken", d.refreshToken || "");
      setToken(d.token);
      setRefreshToken(d.refreshToken || "");

      setTab("tasks");
      flash("Logged in ✅");
    } catch (err) {
      flash(`Login failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setToken("");
    setRefreshToken("");
    setTasks([]);
    setTab("login");
    flash("Logged out");
  }

  /* -------- LOADERS -------- */

  async function loadMine() {
    const d = await api("/api/tasks/mine");
    return d.tasks || [];
  }
  async function loadAvailable() {
    const d = await api("/api/tasks/available");
    return d.tasks || [];
  }
  async function loadAssigned() {
    const d = await api("/api/tasks/assigned");
    return d.tasks || [];
  }
  async function loadHistory() {
    // must exist in backend: GET /api/tasks/history
    const d = await api("/api/tasks/history");
    return d.tasks || [];
  }

  /* -------- ACTIONS -------- */

  async function acceptTask(t) {
    if (busy) return;
    const ok = window.confirm(`Accept this job for ${dollars(t.price_cents)}?\n\n${t.title}`);
    if (!ok) return;

    setBusy(true);
    try {
      await api(`/api/tasks/${t.id}/accept`, { method: "POST" });
      flash("Accepted ✅");
      setWorkerView("assigned");
    } catch (err) {
      flash(`Accept failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function startTask(t) {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/api/tasks/${t.id}/start`, { method: "POST" });
      flash("Started ✅");
    } catch (err) {
      flash(`Start failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function completeTask(t) {
    if (busy) return;
    const ok = window.confirm(`Mark complete?\n\n${t.title}`);
    if (!ok) return;

    setBusy(true);
    try {
      await api(`/api/tasks/${t.id}/complete`, { method: "POST" });
      flash("Completed ✅");
    } catch (err) {
      flash(`Complete failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function createTask(e) {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    try {
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
      flash("Task created ✅");
      setTab("tasks");
      setTitle("");
      setDescription("");
      setCategory("");
      setPrice("");
      setAddress("");
    } catch (err) {
      flash(`Create failed: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  /* -------- AUTO LOAD -------- */

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!authed || tab !== "tasks") return;
      setBusy(true);
      try {
        let list = [];
        if (!isWorker) {
          list = await loadMine();
        } else if (workerView === "available") {
          list = await loadAvailable();
        } else if (workerView === "assigned") {
          list = await loadAssigned();
        } else {
          list = await loadHistory();
        }

        // frontend-only history filter polish
        if (isWorker && workerView === "history") {
          if (historyFilter === "completed") {
            list = list.filter((t) => t.status === "completed");
          } else if (historyFilter === "cancelled") {
            list = list.filter((t) => t.status === "cancelled");
          } // all = no filter
        }

        if (alive) setTasks(list);
      } catch (err) {
        if (alive) flash(`Load failed: ${err.message}`);
      } finally {
        if (alive) setBusy(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab, mode, workerView, historyFilter]);

  /* -------- UI -------- */

  const subtitle = !authed
    ? "Please log in"
    : !isWorker
    ? "User Mode"
    : workerView === "available"
    ? "Worker • Available Jobs"
    : workerView === "assigned"
    ? "Worker • My Jobs"
    : "Worker • History";

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "white", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ padding: 18, borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Micro Fixer</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>
        </div>

        <div style={{ padding: 18, display: "grid", gap: 12 }}>
          {msg ? (
            <div style={{ padding: 12, borderRadius: 14, background: "#f2f5ff", fontSize: 13 }}>
              {msg}
            </div>
          ) : null}

          {!authed || tab === "login" ? (
            <form onSubmit={doLogin} style={{ display: "grid", gap: 12 }}>
              <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button disabled={busy} type="submit" style={{ background: "#111", color: "white" }}>
                {busy ? "Logging in..." : "Login"}
              </Button>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Worker login: <b>worker1@example.com</b>
              </div>
            </form>
          ) : tab === "create" ? (
            <form onSubmit={createTask} style={{ display: "grid", gap: 12 }}>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <Input label="Price (cents)" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Button disabled={busy} type="submit" style={{ background: "#111", color: "white" }}>
                {busy ? "Creating..." : "Create Task"}
              </Button>
            </form>
          ) : (
            <>
              {/* Worker top tabs */}
              {isWorker ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <Button
                    disabled={busy}
                    onClick={() => setWorkerView("available")}
                    style={{ background: workerView === "available" ? "#111" : "#444", color: "white" }}
                  >
                    Available
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => setWorkerView("assigned")}
                    style={{ background: workerView === "assigned" ? "#111" : "#444", color: "white" }}
                  >
                    My Jobs
                  </Button>
                  <Button
                    disabled={busy}
                    onClick={() => setWorkerView("history")}
                    style={{ background: workerView === "history" ? "#111" : "#444", color: "white" }}
                  >
                    History
                  </Button>
                </div>
              ) : (
                <Button disabled={busy} onClick={() => {}} style={{ background: "#111", color: "white" }}>
                  {busy ? "Loading..." : "My Tasks"}
                </Button>
              )}

              {/* History filters */}
              {isWorker && workerView === "history" ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Chip active={historyFilter === "completed"} onClick={() => setHistoryFilter("completed")}>
                    Completed
                  </Chip>
                  <Chip active={historyFilter === "cancelled"} onClick={() => setHistoryFilter("cancelled")}>
                    Cancelled
                  </Chip>
                  <Chip active={historyFilter === "all"} onClick={() => setHistoryFilter("all")}>
                    All
                  </Chip>
                </div>
              ) : null}

              {/* List */}
              {busy && tasks.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>Loading...</div>
              ) : tasks.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>No tasks.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {tasks.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 16,
                        padding: 12,
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div style={statusStyle(t.status)}>{String(t.status).toUpperCase()}</div>

                      <div style={{ display: "grid", gap: 4 }}>
                        <div style={{ fontSize: 14, fontWeight: 900 }}>{t.title}</div>
                        <div style={{ fontSize: 12, opacity: 0.9 }}>{t.description}</div>
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span>
                          Price: <b>{dollars(t.price_cents)}</b>
                        </span>
                        {typeof t.distance_km === "number" && t.distance_km !== 9999 ? (
                          <span>{t.distance_km.toFixed(1)} km</span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.85 }}>{t.address}</div>

                      {/* Actions */}
                      {isWorker && workerView === "available" && t.status === "requested" ? (
                        <Button disabled={busy} onClick={() => acceptTask(t)} style={{ background: "#111", color: "white" }}>
                          Accept
                        </Button>
                      ) : null}

                      {isWorker && workerView === "assigned" && t.status === "assigned" ? (
                        <Button disabled={busy} onClick={() => startTask(t)} style={{ background: "#111", color: "white" }}>
                          Start
                        </Button>
                      ) : null}

                      {isWorker && workerView === "assigned" && t.status === "in_progress" ? (
                        <Button disabled={busy} onClick={() => completeTask(t)} style={{ background: "#111", color: "white" }}>
                          Complete
                        </Button>
                      ) : null}

                      {/* User can see completed tasks and just read them */}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom nav */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", borderTop: "1px solid #eee" }}>
          <button
            onClick={() => {
              setMode("user");
              setWorkerView("available");
              setTab("tasks");
              setEmail("testuser2@example.com");
            }}
            style={{ padding: 14 }}
          >
            Tasks
          </button>
          <button
            onClick={() => {
              setMode("user");
              setTab("create");
              setEmail("testuser2@example.com");
            }}
            style={{ padding: 14 }}
          >
            Create
          </button>
          <button
            onClick={() => {
              setMode("worker");
              setWorkerView("available");
              setTab("tasks");
              setEmail("worker1@example.com");
            }}
            style={{ padding: 14 }}
          >
            Worker
          </button>
          <button onClick={logout} style={{ padding: 14 }}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

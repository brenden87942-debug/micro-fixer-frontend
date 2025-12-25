import { useEffect, useMemo, useState } from "react";

const API = "micro-fixer-backend-production.up.railway.app";

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

function Button({ children, ...props }) {
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
        ...(props.style || {}),
      }}
    >
      {children}
    </button>
  );
}

function statusBadgeStyle(status) {
  const base = {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 800,
    padding: "6px 10px",
    borderRadius: 999,
    letterSpacing: 0.3,
    width: "fit-content",
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

function centsToDollars(cents) {
  const n = Number(cents || 0);
  return `$${(n / 100).toFixed(2)}`;
}

export default function App() {
  const [tab, setTab] = useState("login"); // login | tasks | create
  const [mode, setMode] = useState("user"); // user | worker
  const [workerView, setWorkerView] = useState("available"); // available | assigned | history

  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem("refreshToken") || "");
  const authed = useMemo(() => !!token, [token]);

  const [email, setEmail] = useState("testuser2@example.com");
  const [password, setPassword] = useState("Pass123!");

  const [tasks, setTasks] = useState([]);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("Fix leaky faucet");
  const [description, setDescription] = useState("Kitchen sink dripping");
  const [category, setCategory] = useState("plumbing");
  const [price, setPrice] = useState("2500");
  const [address, setAddress] = useState("Phoenix, AZ");

  const [totalEarnedCents, setTotalEarnedCents] = useState(0);

  const isWorker = mode === "worker";

  // API helper with auto-refresh retry
  async function api(path, options = {}, _retry = false) {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const data = await res.json().catch(() => ({}));
    const errText = String(data?.error || "").toLowerCase();

    if ((errText.includes("expired") || errText.includes("invalid")) && !_retry && refreshToken) {
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

    if (!res.ok || data.ok === false) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function doLogin(e) {
    e.preventDefault();
    setMsg("");
    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      setToken(data.token);
      setRefreshToken(data.refreshToken);

      setTab("tasks");
      setMsg("Logged in ✅");
    } catch (err) {
      setMsg(`Login failed: ${err.message}`);
    }
  }

  async function loadMine() {
    setMsg("");
    try {
      const data = await api("/api/tasks/mine");
      setTasks(data.tasks || []);
      setMsg(`Loaded ${data.tasks?.length || 0} tasks ✅`);
    } catch (err) {
      setMsg(`Load failed: ${err.message}`);
    }
  }

  async function loadAvailable() {
    setMsg("");
    try {
      const data = await api("/api/tasks/available");
      setTasks(data.tasks || []);
      setMsg(`Loaded ${data.tasks?.length || 0} available jobs ✅`);
    } catch (err) {
      setMsg(`Load failed: ${err.message}`);
    }
  }

  async function loadAssigned() {
    setMsg("");
    try {
      const data = await api("/api/tasks/assigned");
      setTasks(data.tasks || []);
      setMsg(`Loaded ${data.tasks?.length || 0} my jobs ✅`);
    } catch (err) {
      setMsg(`Load failed: ${err.message}`);
    }
  }

  async function loadHistory() {
    setMsg("");
    try {
      const data = await api("/api/tasks/history");
      setTasks(data.tasks || []);
      setTotalEarnedCents(Number(data.totalEarnedCents || 0));
      setMsg(`Loaded ${data.tasks?.length || 0} history items ✅`);
    } catch (err) {
      setMsg(`Load failed: ${err.message}`);
    }
  }

  async function acceptTask(task) {
    const ok = window.confirm(`Accept this job for ${centsToDollars(task.price_cents)}?\n\n${task.title}`);
    if (!ok) return;

    setMsg("");
    try {
      const data = await api(`/api/tasks/${task.id}/accept`, { method: "POST" });
      setMsg(`Accepted job #${data.task.id} ✅`);
      setWorkerView("assigned");
      await loadAssigned();
    } catch (err) {
      setMsg(`Accept failed: ${err.message}`);
    }
  }

  async function startTask(id) {
    setMsg("");
    try {
      const data = await api(`/api/tasks/${id}/start`, { method: "POST" });
      setMsg(`Started job #${data.task.id} ✅`);
      await loadAssigned();
    } catch (err) {
      setMsg(`Start failed: ${err.message}`);
    }
  }

  async function completeTask(id) {
    setMsg("");
    try {
      const data = await api(`/api/tasks/${id}/complete`, { method: "POST" });
      setMsg(`Completed job #${data.task.id} ✅`);
      await loadAssigned();
    } catch (err) {
      setMsg(`Complete failed: ${err.message}`);
    }
  }

  async function createTask(e) {
    e.preventDefault();
    setMsg("");
    try {
      const body = {
        title,
        description,
        category,
        price_cents: Number(price),
        lat: 33.4484,
        lng: -112.074,
        address,
      };
      const data = await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMsg(`Created task #${data.task.id} ✅`);
      setTab("tasks");
      await loadMine();
    } catch (err) {
      setMsg(`Create failed: ${err.message}`);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setToken("");
    setRefreshToken("");
    setTasks([]);
    setTotalEarnedCents(0);
    setTab("login");
    setMsg("Logged out");
  }

  // Auto-load list on tab/mode/view changes
  useEffect(() => {
    if (!authed) return;
    if (tab !== "tasks") return;

    if (isWorker) {
      if (workerView === "assigned") loadAssigned();
      else if (workerView === "history") loadHistory();
      else loadAvailable();
    } else {
      loadMine();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed, tab, mode, workerView]);

  const headerSubtitle = isWorker
    ? workerView === "available"
      ? "Worker Mode • Available Jobs"
      : workerView === "assigned"
      ? "Worker Mode • My Jobs"
      : "Worker Mode • History"
    : "User Mode • Mobile-first web app";

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "white", borderRadius: 24, boxShadow: "0 10px 30px rgba(0,0,0,0.08)", overflow: "hidden" }}>
        <div style={{ padding: 18, borderBottom: "1px solid #eee" }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>Micro Fixer</div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{headerSubtitle}</div>
        </div>

        <div style={{ padding: 18, display: "grid", gap: 14 }}>
          {msg && (
            <div style={{ padding: 12, borderRadius: 14, background: "#f2f5ff", fontSize: 13 }}>
              {msg}
            </div>
          )}

          {!authed || tab === "login" ? (
            <form onSubmit={doLogin} style={{ display: "grid", gap: 12 }}>
              <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="submit" style={{ background: "#111", color: "white" }}>Login</Button>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Tip: use <b>worker1@example.com</b> in Worker mode.
              </div>
            </form>
          ) : tab === "create" ? (
            <form onSubmit={createTask} style={{ display: "grid", gap: 12 }}>
              <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Input label="Category" value={category} onChange={(e) => setCategory(e.target.value)} />
              <Input label="Price (cents)" value={price} onChange={(e) => setPrice(e.target.value)} />
              <Input label="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
              <Button type="submit" style={{ background: "#111", color: "white" }}>Create Task</Button>
            </form>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {/* Worker segmented controls */}
              {isWorker ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <Button
                      onClick={() => setWorkerView("available")}
                      style={{ background: workerView === "available" ? "#111" : "#444", color: "white" }}
                    >
                      Available
                    </Button>
                    <Button
                      onClick={() => setWorkerView("assigned")}
                      style={{ background: workerView === "assigned" ? "#111" : "#444", color: "white" }}
                    >
                      My Jobs
                    </Button>
                    <Button
                      onClick={() => setWorkerView("history")}
                      style={{ background: workerView === "history" ? "#111" : "#444", color: "white" }}
                    >
                      History
                    </Button>
                  </div>

                  {workerView === "history" && (
                    <div style={{ padding: 12, borderRadius: 16, border: "1px solid #eee", fontSize: 13 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Total Earned</div>
                      <div style={{ fontSize: 20, fontWeight: 900 }}>{centsToDollars(totalEarnedCents)}</div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Sum of completed jobs</div>
                    </div>
                  )}
                </>
              ) : (
                <Button onClick={loadMine} style={{ background: "#111", color: "white" }}>
                  Refresh My Tasks
                </Button>
              )}

              {tasks.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.7 }}>No tasks yet.</div>
              ) : (
                <>
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
                      <div style={statusBadgeStyle(t.status)}>{String(t.status).toUpperCase()}</div>

                      <div style={{ display: "grid", gap: 4 }}>
                        <b style={{ fontSize: 14 }}>{t.title}</b>
                        <div style={{ fontSize: 12, opacity: 0.9 }}>{t.description}</div>
                      </div>

                      <div style={{ fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                        <span>
                          Price: <b>{centsToDollars(t.price_cents)}</b>
                        </span>
                        {typeof t.distance_km === "number" && t.distance_km !== 9999 ? (
                          <span>{t.distance_km.toFixed(1)} km</span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: 12, opacity: 0.85 }}>{t.address}</div>

                      {/* Worker actions */}
                      {isWorker && workerView === "available" && t.status === "requested" && (
                        <Button onClick={() => acceptTask(t)} style={{ background: "#111", color: "white" }}>
                          Accept
                        </Button>
                      )}

                      {isWorker && workerView === "assigned" && t.status === "assigned" && (
                        <Button onClick={() => startTask(t.id)} style={{ background: "#111", color: "white" }}>
                          Start
                        </Button>
                      )}

                      {isWorker && workerView === "assigned" && t.status === "in_progress" && (
                        <Button onClick={() => completeTask(t.id)} style={{ background: "#111", color: "white" }}>
                          Complete
                        </Button>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Bottom navigation */}
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

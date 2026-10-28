import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BarChart3,
  Bell,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  createCompany,
  createEligibility,
  createNotification,
  createNotice,
  createStudent,
  deleteNotice,
  downloadOverallReport,
  getAnalytics,
  getCompanies,
  getEligibility,
  getEligibilityOptions,
  getEligibilityRecord,
  getCompany,
  getDashboardOverview,
  getNotice,
  getNotifications,
  getRecruiter,
  getRecruiterVerificationDocument,
  getRecruiters,
  getRecruitmentJobs,
  getJobAnalyses,
  getRecruitmentAnalysis,
  getNotices,
  getStudent,
  getStudents,
  publishNotice,
  updateCompany,
  updateEligibility,
  updateNotice,
  updateRecruiterValidation,
  updateStudent,
} from "./lib/adminApi";
import { Modal, Pagination, SearchField, Status, Table } from "./components/ui";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuth } from "./auth/AuthContext";
import { changePassword } from "./lib/authApi";
import { DEPARTMENTS } from "./lib/departments";

const nav = [
  ["Overview", "/admin", LayoutDashboard],
  ["Recruiter validation", "/admin/recruiters", ShieldCheck],
  ["Notice board", "/admin/notices", FileText],
  ["Student management", "/admin/students", Users],
  ["Company management", "/admin/companies", Building2],
  ["Recruitment jobs", "/admin/jobs", BriefcaseBusiness],
  ["Eligibility tracking", "/admin/eligibility", ClipboardCheck],
  ["Analytics", "/admin/analytics", BarChart3],
  ["Notifications", "/admin/notifications", Bell],
];
function AdminLoading() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div
        className="flex items-center gap-3 text-sm font-medium text-slate-600"
        role="status"
      >
        <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        Verifying your session…
      </div>
    </div>
  );
}
function ProtectedAdmin({ children }) {
  const { user, isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();
  if (isInitializing) return <AdminLoading />;
  if (!isAuthenticated)
    return <Navigate to="/login" replace state={{ from: location }} />;
  if (!['tpo', 'super_admin'].includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return children;
}
function Shell({ children }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const current =
    nav.find(([, path]) => location.pathname === path)?.[0] || "Admin portal";
  return (
    <div className="min-h-screen bg-slate-50">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-ink px-4 py-5 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-9 flex items-center gap-3 px-3">
          <div className="grid size-9 place-items-center rounded-xl bg-brand-500 font-bold text-white">
            H
          </div>
          <div>
            <p className="font-semibold text-white">HireSense AI</p>
            <p className="text-xs text-slate-400">Placement Intelligence</p>
          </div>
          <button
            className="ml-auto text-slate-300 lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Administration
        </p>
        <nav className="space-y-1">
          {nav.map(([label, path, Icon]) => (
            <NavLink
              end={path === "/admin"}
              key={path}
              to={path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-brand-500 text-white shadow-lg shadow-blue-950/20" : "text-slate-300 hover:bg-white/10 hover:text-white"}`
              }
            >
              <Icon className="size-[18px]" />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Signed in as</p>
          <p className="mt-1 text-sm font-medium text-white">Admin / TPO</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Training & Placement Office
          </p>
        </div>
      </aside>
      {open && (
        <button
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-[73px] items-center justify-between border-b border-slate-200 bg-white/90 px-5 backdrop-blur lg:px-8">
          <div className="flex items-center gap-3">
            <button
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              onClick={() => setOpen(true)}
            >
              <Menu className="size-5" />
            </button>
            <div>
              <p className="text-xs font-medium text-slate-400">
                Admin / TPO portal
              </p>
              <h1 className="text-lg font-semibold text-ink">{current}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/notifications")}
              className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Open notifications"
            >
              <BellRing className="size-5" />
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <div className="relative">
            <button
              type="button"
              onClick={() => setAccountOpen((value) => !value)}
              aria-expanded={accountOpen}
              aria-haspopup="menu"
              className="flex items-center gap-2 rounded-xl border border-slate-200 py-1.5 pl-2 pr-3 text-sm font-medium text-slate-700"
            >
              <span className="grid size-7 place-items-center rounded-lg bg-brand-100 text-xs font-bold text-brand-700">
                TPO
              </span>
              <span className="hidden sm:block">{user?.full_name || "TPO"}</span>
              <ChevronDown className="size-4 text-slate-400" />
            </button>
            {accountOpen && <div className="absolute right-0 top-full z-30 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg" role="menu">
              <button type="button" role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setAccountOpen(false); navigate("/admin/profile"); }}>View Profile</button>
              <button type="button" role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50" onClick={() => { setAccountOpen(false); navigate("/admin/change-password"); }}>Change Password</button>
              <button type="button" role="menuitem" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50" onClick={() => { setAccountOpen(false); logout(); }}>Logout</button>
            </div>}
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-[1600px] p-5 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
const PageTitle = ({ eyebrow, title, text, action }) => (
  <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight text-ink">
        {title}
      </h2>
      {text && <p className="mt-1.5 text-sm text-slate-500">{text}</p>}
    </div>
    {action}
  </div>
);
const Stat = ({ icon: Icon, label, value, detail, tone = "blue" }) => (
  <div className="panel p-5">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {value}
        </p>
        <p className="mt-2 text-xs text-slate-500">{detail}</p>
      </div>
      <div
        className={`rounded-xl p-2.5 ${tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "amber" ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand-600"}`}
      >
        <Icon className="size-5" />
      </div>
    </div>
  </div>
);
const Filter = ({ children, ...props }) => (
  <select className="input w-auto min-w-[140px] py-2.5" {...props}>
    {children}
  </select>
);
const RetryButton = ({ onClick }) => (
  <button type="button" className="btn-secondary mt-3" onClick={onClick}>
    Try again
  </button>
);

function Overview() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getDashboardOverview()
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch(() => {
        if (active)
          setError("Dashboard data could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retryKey]);
  const pageTitle = (
    <PageTitle
      eyebrow="Placement control center"
      title="Welcome, TPO"
      text="Here’s what needs your attention across HireSense today."
    />
  );
  if (loading)
    return (
      <>
        {pageTitle}
        <div className="panel grid min-h-64 place-items-center p-6">
          <div
            className="flex items-center gap-3 text-sm font-medium text-slate-600"
            role="status"
          >
            <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Loading dashboard data…
          </div>
        </div>
      </>
    );
  if (error)
    return (
      <>
        {pageTitle}
        <div className="panel p-6" role="alert">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <RetryButton onClick={() => setRetryKey((value) => value + 1)} />
        </div>
      </>
    );
  if (!dashboard) return null;
  const o = dashboard;
  const queue = [
    [
      o.pending_recruiters,
      "Recruiter applications pending validation",
      "Review",
      "/admin/recruiters",
    ],
    [o.eligibility_reviews, "Students need eligibility review", "Open", "/admin/eligibility"],
    [
      o.notices_expiring_this_week,
      "Notices scheduled to expire this week",
      "Manage",
      "/admin/notices",
    ],
  ];
  return (
    <>
      {pageTitle}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Users}
          label="Active students"
          value={o.students.toLocaleString()}
          detail={`${o.applications.toLocaleString()} total applications`}
        />
        <Stat
          icon={ShieldCheck}
          label="Verified recruiters"
          value={`${o.verified_recruiters}/${o.recruiters}`}
          detail={`${o.pending_recruiters} pending review`}
          tone="green"
        />
        <Stat
          icon={Building2}
          label="Active companies"
          value={o.companies}
          detail={`${o.jobs} total job postings`}
        />
        <Stat
          icon={ClipboardCheck}
          label="Eligible assessments"
          value={o.eligible_records}
          detail={
            o.eligibility_assessments === 0
              ? "No eligibility assessments yet"
              : `${o.eligibility_rate}% of ${o.eligibility_assessments.toLocaleString()} assessed student–role records`
          }
          tone="amber"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="panel p-5 xl:col-span-3">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-ink">Application momentum</h3>
              <p className="mt-1 text-sm text-slate-500">
                Applications received over the last six months
              </p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={o.application_trend}>
                <defs>
                  <linearGradient id="fillApps" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity=".24" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0" }}
                />
                <Area
                  type="monotone"
                  dataKey="applications"
                  stroke="#2563eb"
                  strokeWidth={3}
                  fill="url(#fillApps)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-5 xl:col-span-2">
          <h3 className="font-semibold text-ink">Action queue</h3>
          <p className="mt-1 text-sm text-slate-500">
            Tasks requiring TPO attention
          </p>
          <div className="mt-5 divide-y divide-slate-100">
            {queue.map(([count, label, action, path]) => (
              <div className="flex items-center gap-3 py-4" key={label}>
                <span className="grid size-9 place-items-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700">
                  {count}
                </span>
                <p className="flex-1 text-sm font-medium text-slate-700">
                  {label}
                </p>
                <button onClick={() => navigate(path)} className="text-xs font-semibold text-brand-600">
                  {action}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-5">
        <section className="panel p-5 xl:col-span-3">
          <h3 className="font-semibold text-ink">
            Recent recruiter applications
          </h3>
          <div className="mt-4">
            <Table
              columns={["Company", "Contact", "Openings", "Status", ""]}
              rows={o.recent_recruiters}
              empty="No recruiter applications yet."
              render={(r) => (
                <tr key={r.id}>
                  <td className="px-5 py-4 font-medium text-ink">
                    {r.company}
                  </td>
                  <td className="px-5 py-4 text-slate-500">{r.contact}</td>
                  <td className="px-5 py-4">{r.jobs}</td>
                  <td className="px-5 py-4">
                    <Status value={r.status} />
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => navigate("/admin/recruiters")}
                      className="text-sm font-semibold text-brand-600"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              )}
            />
          </div>
        </section>
        <section className="panel p-5 xl:col-span-2">
          <h3 className="font-semibold text-ink">Placement distribution</h3>
          <p className="mt-1 text-sm text-slate-500">
            Students placed by department (%)
          </p>
          <div className="mt-3 h-48">
            <ResponsiveContainer>
              <BarChart
                data={o.placement_distribution}
                layout="vertical"
                margin={{ left: 15 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={115}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 11 }}
                />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {o.placement_distribution.length === 0 && (
            <p className="text-sm text-slate-500">
              No placed application data yet.
            </p>
          )}
        </section>
      </div>
    </>
  );
}

function ResourcePage({
  type,
  title,
  text,
  columns,
  source,
  formFields = [],
  createLabel,
}) {
  const [items, setItems] = useState(source);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({});
  const filtered = useMemo(
    () =>
      items.filter((item) =>
        Object.values(item)
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const add = (e) => {
    e.preventDefault();
    setItems([
      {
        id: Date.now(),
        ...form,
        status:
          form.status ||
          (type === "notice"
            ? "Published"
            : type === "company"
              ? "Active"
              : "Pending"),
      },
      ...items,
    ]);
    setForm({});
    setModal(false);
  };
  const keyFor = (c) =>
    ({
      Company: "company",
      Student: "student",
      Notice: "title",
      "Roll no.": "roll",
      Department: "dept",
      Updated: "updated",
      Published: "published",
      Audience: "audience",
      Openings: "openings",
      Eligibility: "eligibility",
      Status: "status",
      Name: "name",
      Sector: "sector",
      Website: "website",
      Email: "email",
      Year: "year",
      Role: "role",
      Title: "title",
      Message: "message",
      Time: "time",
    })[c] || c.toLowerCase();
  return (
    <>
      <PageTitle
        eyebrow="Admin / TPO"
        title={title}
        text={text}
        action={
          <button className="btn-primary" onClick={() => setModal(true)}>
            <Plus className="size-4" />
            {createLabel}
          </button>
        }
      />
      <div className="panel">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder={`Search ${title.toLowerCase()}...`}
          />
          <div className="flex gap-2">
            <Filter>
              <option>All statuses</option>
              <option>Active</option>
              <option>Pending</option>
            </Filter>
            <button className="btn-secondary">Export</button>
          </div>
        </div>
        <Table
          columns={columns}
          rows={filtered}
          empty={`No ${title.toLowerCase()} match your filters.`}
          render={(row) => (
            <tr key={row.id}>
              {columns.slice(0, -1).map((column) => {
                const val = row[keyFor(column)];
                return (
                  <td className="whitespace-nowrap px-5 py-4" key={column}>
                    {column === "Status" || column === "Eligibility" ? (
                      <Status value={val} />
                    ) : (
                      <span
                        className={
                          column === columns[0]
                            ? "font-medium text-ink"
                            : "text-slate-500"
                        }
                      >
                        {val}
                      </span>
                    )}
                  </td>
                );
              })}
              <td className="px-5 py-4 text-right">
                <button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                  <MoreHorizontal className="size-5" />
                </button>
              </td>
            </tr>
          )}
        />
        <Pagination total={filtered.length} />
      </div>
      {modal && (
        <Modal title={createLabel} onClose={() => setModal(false)}>
          <form onSubmit={add} className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {formFields.map(({ name, label, options }) => (
                <label
                  key={name}
                  className={
                    name === "message" || name === "content"
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    {label}
                  </span>
                  {options ? (
                    <select
                      className="input"
                      required
                      onChange={(e) =>
                        setForm({ ...form, [name]: e.target.value })
                      }
                    >
                      <option value="">Select {label}</option>
                      {options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : name === "content" || name === "message" ? (
                    <textarea
                      required
                      className="input min-h-28"
                      onChange={(e) =>
                        setForm({ ...form, [name]: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      required
                      className="input"
                      onChange={(e) =>
                        setForm({ ...form, [name]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setModal(false)}
              >
                Cancel
              </button>
              <button className="btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Students() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [eligibilityFilter, setEligibilityFilter] = useState("");
  const [applicationFilter, setApplicationFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState(null);
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getStudents({ page, page_size: 10, search: query, department, eligibility_status: eligibilityFilter, application_status: applicationFilter })
      .then((data) => {
        if (active) {
          setRows(data.items);
          setTotal(data.total);
        }
      })
      .catch(() => {
        if (active)
          setError("Student records could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, department, eligibilityFilter, applicationFilter, reload]);
  const departments = DEPARTMENTS;
  const eligibility = (student) =>
    student.eligibility_status
      ? student.eligibility_status.replace(/\b\w/g, (letter) =>
          letter.toUpperCase(),
        )
      : "Not assessed";
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        full_name: form.full_name.trim(),
        student_id: form.student_id.trim() || null,
        department: form.department.trim() || null,
        graduation_year: form.graduation_year
          ? Number(form.graduation_year)
          : null,
        headline: form.headline.trim() || null,
        location: form.location.trim() || null,
      };
      if (form.id) {
        await updateStudent(form.id, payload);
        setReload((value) => value + 1);
        setFeedback("Student record updated.");
      } else {
        const created = await createStudent({
          ...payload,
          email: form.email.trim(),
          password: form.password,
        });
        setPage(1);
        setReload((value) => value + 1);
        setFeedback(`Student ${created.full_name} added.`);
      }
      setForm(null);
    } catch {
      setError(
        "The student record could not be saved. Please review the required fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const view = async (studentId) => {
    setDetails({ loading: true });
    try {
      setDetails(await getStudent(studentId));
    } catch {
      setDetails(null);
      setError("Student details could not be loaded. Please try again.");
    }
  };
  const emptyForm = {
    full_name: "",
    email: "",
    password: "",
    student_id: "",
    department: "",
    graduation_year: "",
    headline: "",
    location: "",
  };
  const content = loading && !rows.length ? (
    <div className="panel grid min-h-64 place-items-center p-6">
      <div
        className="flex items-center gap-3 text-sm font-medium text-slate-600"
        role="status"
      >
        <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        Loading student records…
      </div>
    </div>
  ) : error && !rows.length ? (
    <div className="panel p-6" role="alert">
      <p className="text-sm font-medium text-slate-700">{error}</p>
      <RetryButton onClick={() => setReload((value) => value + 1)} />
    </div>
  ) : (
    <div className="panel">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Search student management..."
        />
        <div className="flex gap-2">
          <Filter
            value={department}
            onChange={(event) => {
              setDepartment(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All departments</option>
            {departments.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </Filter>
          <Filter value={eligibilityFilter} onChange={(event) => { setEligibilityFilter(event.target.value); setPage(1); }}>
            <option value="">All eligibility</option><option value="eligible">Eligible</option><option value="review">Review</option><option value="not eligible">Not eligible</option>
          </Filter>
          <Filter value={applicationFilter} onChange={(event) => { setApplicationFilter(event.target.value); setPage(1); }}>
            <option value="">All applications</option><option value="submitted">Submitted</option><option value="shortlisted">Shortlisted</option><option value="placed">Placed</option>
          </Filter>
        </div>
      </div>
      <Table
        columns={[
          "Name",
          "Email",
          "Roll no.",
          "Department",
          "Year",
          "Eligibility",
          "",
        ]}
        rows={rows}
        empty="No student records match your filters."
        render={(student) => (
          <tr key={student.id}>
            <td className="px-5 py-4 font-medium text-ink">
              {student.full_name}
            </td>
            <td className="px-5 py-4 text-slate-500">{student.email}</td>
            <td className="px-5 py-4 text-slate-500">
              {student.student_id || "—"}
            </td>
            <td className="px-5 py-4 text-slate-500">
              {student.department || "—"}
            </td>
            <td className="px-5 py-4 text-slate-500">
              {student.graduation_year || "—"}
            </td>
            <td className="px-5 py-4">
              <Status value={eligibility(student)} />
            </td>
            <td className="px-5 py-4 text-right">
              <button
                onClick={() => view(student.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={`View ${student.full_name}`}
              >
                <MoreHorizontal className="size-5" />
              </button>
            </td>
          </tr>
        )}
      />
      <Pagination
        page={page}
        pageSize={10}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow="Admin / TPO"
        title="Student management"
        text="Maintain the placement-ready student directory and academic profile data."
        action={
          <button className="btn-primary" onClick={() => setForm(emptyForm)}>
            <Plus className="size-4" />
            Add student
          </button>
        }
      />
      {feedback && (
        <p className="mb-4 text-sm font-medium text-emerald-700" role="status">
          {feedback}
        </p>
      )}
      {error && rows.length > 0 && (
        <div className="mb-4" role="alert">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <RetryButton onClick={() => setReload((value) => value + 1)} />
        </div>
      )}
      {content}
      {form && (
        <Modal
          title={form.id ? "Edit student" : "Add student"}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save} className="space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Full name
                </span>
                <input
                  required
                  value={form.full_name}
                  className="input"
                  onChange={(event) =>
                    setForm({ ...form, full_name: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  College email
                </span>
                <input
                  required
                  type="email"
                  disabled={Boolean(form.id)}
                  value={form.email}
                  className="input disabled:bg-slate-50"
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </label>
              {!form.id && (
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Temporary password
                  </span>
                  <input
                    required
                    minLength="8"
                    type="password"
                    value={form.password}
                    className="input"
                    onChange={(event) =>
                      setForm({ ...form, password: event.target.value })
                    }
                  />
                </label>
              )}
              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Roll number
                </span>
                <input
                  value={form.student_id}
                  className="input"
                  onChange={(event) =>
                    setForm({ ...form, student_id: event.target.value })
                  }
                />
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department
                </span>
              <select value={form.department} className="input" onChange={(event) => setForm({ ...form, department: event.target.value })}>
                <option value="">Select department</option>
                {DEPARTMENTS.map((value) => <option key={value}>{value}</option>)}
              </select>
              </label>
              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Graduation year
                </span>
                <input
                  type="number"
                  value={form.graduation_year}
                  className="input"
                  onChange={(event) =>
                    setForm({ ...form, graduation_year: event.target.value })
                  }
                />
              </label>
            </div>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Headline
              </span>
              <input
                value={form.headline}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, headline: event.target.value })
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Location
              </span>
              <input
                value={form.location}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, location: event.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {details && (
        <Modal title="Student details" onClose={() => setDetails(null)}>
          {details.loading ? (
            <div className="p-6 text-sm text-slate-500" role="status">
              Loading student details…
            </div>
          ) : (
            <div className="space-y-4 p-6 text-sm">
              <div>
                <p className="text-slate-500">Email</p>
                <p className="mt-1 font-medium text-ink">{details.email}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-slate-500">Department</p>
                  <p className="mt-1 font-medium text-ink">{details.department || "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">CGPA</p>
                  <p className="mt-1 font-medium text-ink">{details.cgpa ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Backlogs</p>
                  <p className="mt-1 font-medium text-ink">{details.backlog_count ?? "—"}</p>
                </div>
                <div>
                  <p className="text-slate-500">Graduation year</p>
                  <p className="mt-1 font-medium text-ink">{details.graduation_year || "—"}</p>
                </div>
              </div>
              <div>
                <p className="text-slate-500">Skills</p>
                <p className="mt-1 font-medium text-ink">{details.skills || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Placement status</p>
                <p className="mt-1 font-medium text-ink">{details.placement_status || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Latest eligibility</p>
                <div className="mt-1">
                  <Status value={eligibility(details)} />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setForm({ ...details, password: "" });
                    setDetails(null);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function Companies() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);
  const [details, setDetails] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getCompanies({ page, page_size: 10, search: query })
      .then((data) => {
        if (active) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch(
        () =>
          active &&
          setError("Company records could not be loaded. Please try again."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, query, reload]);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        sector: form.sector.trim() || null,
        website: form.website.trim() || null,
        description: form.description.trim() || null,
      };
      if (form.id) await updateCompany(form.id, payload);
      else await createCompany(payload);
      setPage(1);
      setReload((value) => value + 1);
      setForm(null);
    } catch (requestError) {
      setError(
        requestError?.status === 409
          ? "A company with this name already exists."
          : "The company record could not be saved. Please review the required fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const view = async (id) => {
    setDetails({ loading: true });
    try {
      setDetails(await getCompany(id));
    } catch {
      setDetails(null);
      setError("Company details could not be loaded. Please try again.");
    }
  };
  const blank = { name: "", sector: "", website: "", description: "" };
  return (
    <>
      <PageTitle
        eyebrow="Admin / TPO"
        title="Company management"
        text="Maintain employer partner records and campus hiring activity."
        action={
          <button className="btn-primary" onClick={() => setForm(blank)}>
            <Plus className="size-4" />
            Add company
          </button>
        }
      />
      {error && (
        <div className="mb-4" role="alert">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <RetryButton onClick={() => setReload((value) => value + 1)} />
        </div>
      )}
      {loading && !items.length ? (
        <div className="panel grid min-h-64 place-items-center p-6">
          <div
            className="flex items-center gap-3 text-sm font-medium text-slate-600"
            role="status"
          >
            <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Loading company records…
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="flex border-b border-slate-100 p-4">
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Search company management..."
            />
          </div>
          <Table
            columns={["Name", "Sector", "Website", "Openings", "Status", ""]}
            rows={items}
            empty="No company records match your filters."
            render={(item) => (
              <tr key={item.id}>
                <td className="px-5 py-4 font-medium text-ink">{item.name}</td>
                <td className="px-5 py-4 text-slate-500">
                  {item.sector || "—"}
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {item.website || "—"}
                </td>
                <td className="px-5 py-4">{item.job_count}</td>
                <td className="px-5 py-4 text-slate-500">—</td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => view(item.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`View ${item.name}`}
                  >
                    <MoreHorizontal className="size-5" />
                  </button>
                </td>
              </tr>
            )}
          />
          <Pagination
            page={page}
            pageSize={10}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
      {form && (
        <Modal
          title={form.id ? "Edit company" : "Add company"}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save} className="space-y-4 p-6">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Company name
              </span>
              <input
                required
                value={form.name}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Sector
              </span>
              <input
                value={form.sector}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, sector: event.target.value })
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Website
              </span>
              <input
                value={form.website}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, website: event.target.value })
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                value={form.description}
                className="input min-h-28"
                onChange={(event) =>
                  setForm({ ...form, description: event.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {details && (
        <Modal title="Company details" onClose={() => setDetails(null)}>
          {details.loading ? (
            <div className="p-6 text-sm text-slate-500">
              Loading company details…
            </div>
          ) : (
            <div className="space-y-4 p-6 text-sm">
              <div>
                <p className="text-slate-500">Sector</p>
                <p className="mt-1 font-medium text-ink">
                  {details.sector || "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {details.description || "—"}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setForm(details);
                    setDetails(null);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function Eligibility() {
  const [items, setItems] = useState([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState(""),
    [reload, setReload] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [options, setOptions] = useState(null),
    [form, setForm] = useState(null),
    [details, setDetails] = useState(null),
    [busy, setBusy] = useState(false);
  const load = () => {
    setLoading(true);
    setError("");
    return getEligibility({
      page,
      page_size: 10,
      search: query,
      status_filter: filter,
    })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() =>
        setError("Eligibility records could not be loaded. Please try again."),
      )
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, [page, query, filter, reload]);
  const openForm = async (record) => {
    setError("");
    if (!options) {
      try {
        setOptions(await getEligibilityOptions());
      } catch {
        setError("Eligibility form data could not be loaded.");
        return;
      }
    }
    setForm(
      record || { candidate_id: "", job_id: "", status: "eligible", notes: "" },
    );
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (form.id)
        await updateEligibility(form.id, {
          status: form.status,
          notes: form.notes || null,
        });
      else
        await createEligibility({
          candidate_id: Number(form.candidate_id),
          job_id: Number(form.job_id),
          status: form.status,
          notes: form.notes || null,
        });
      setForm(null);
      load();
    } catch {
      setError(
        "The eligibility record could not be saved. Please review the fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const view = async (id) => {
    setDetails({ loading: true });
    try {
      setDetails(await getEligibilityRecord(id));
    } catch {
      setDetails(null);
      setError("Eligibility details could not be loaded. Please try again.");
    }
  };
  const label = (value) =>
    value === "eligible"
      ? "Eligible"
      : value === "review"
        ? "Review"
        : value === "not eligible"
          ? "Not eligible"
          : value;
  return (
    <>
      <PageTitle
        eyebrow="Admin / TPO"
        title="Eligibility tracking"
        text="Track candidate eligibility against available company opportunities."
        action={
          <button className="btn-primary" onClick={() => openForm()}>
            <Plus className="size-4" />
            Add eligibility record
          </button>
        }
      />
      {error && (
        <div className="mb-4" role="alert">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <RetryButton onClick={() => setReload((value) => value + 1)} />
        </div>
      )}
      {loading && !items.length ? (
        <div className="panel grid min-h-64 place-items-center p-6">
          <div
            className="flex items-center gap-3 text-sm font-medium text-slate-600"
            role="status"
          >
            <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Loading eligibility records…
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:justify-between">
            <SearchField
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Search eligibility tracking..."
            />
            <Filter
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All statuses</option>
              <option value="eligible">Eligible</option>
              <option value="review">Review</option>
              <option value="not eligible">Not eligible</option>
            </Filter>
          </div>
          <Table
            columns={["Student", "Company", "Role", "Status", "Updated", ""]}
            rows={items}
            empty="No eligibility records match your filters."
            render={(item) => (
              <tr key={item.id}>
                <td className="px-5 py-4 font-medium text-ink">
                  {item.student_name}
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {item.company_name}
                </td>
                <td className="px-5 py-4 text-slate-500">{item.job_title}</td>
                <td className="px-5 py-4">
                  <Status value={label(item.status)} />
                </td>
                <td className="px-5 py-4 text-slate-500">
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                  }).format(new Date(item.updated_at))}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => view(item.id)}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={`View ${item.student_name}`}
                  >
                    <MoreHorizontal className="size-5" />
                  </button>
                </td>
              </tr>
            )}
          />
          <Pagination
            page={page}
            pageSize={10}
            total={total}
            onPageChange={setPage}
          />
        </div>
      )}
      {form && (
        <Modal
          title={form.id ? "Update eligibility" : "Add eligibility record"}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save} className="space-y-4 p-6">
            {!form.id && (
              <>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Student
                  </span>
                  <select
                    required
                    className="input"
                    value={form.candidate_id}
                    onChange={(event) =>
                      setForm({ ...form, candidate_id: event.target.value })
                    }
                  >
                    <option value="">Select Student</option>
                    {options.students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.full_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-slate-700">
                    Company / role
                  </span>
                  <select
                    required
                    className="input"
                    value={form.job_id}
                    onChange={(event) =>
                      setForm({ ...form, job_id: event.target.value })
                    }
                  >
                    <option value="">Select role</option>
                    {options.jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.company_name} — {job.title}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Decision
              </span>
              <select
                className="input"
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                <option value="eligible">Eligible</option>
                <option value="review">Review</option>
                <option value="not eligible">Not eligible</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Notes
              </span>
              <textarea
                className="input min-h-28"
                value={form.notes || ""}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {details && (
        <Modal title="Eligibility details" onClose={() => setDetails(null)}>
          {details.loading ? (
            <div className="p-6 text-sm text-slate-500">
              Loading eligibility details…
            </div>
          ) : (
            <div className="space-y-4 p-6 text-sm">
              <div>
                <p className="text-slate-500">Student</p>
                <p className="mt-1 font-medium text-ink">
                  {details.student_name}
                </p>
                <p className="text-slate-500">
                  {details.company_name} — {details.job_title}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Eligibility</p>
                <div className="mt-1">
                  <Status value={label(details.status)} />
                </div>
                {details.final_result && (
                  <p className="mt-2 font-medium text-ink">
                    Final result: {details.final_result}
                  </p>
                )}
              </div>
              {details.breakdown?.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-medium">Criterion</th>
                        <th className="px-3 py-2 font-medium">Student</th>
                        <th className="px-3 py-2 font-medium">Required</th>
                        <th className="px-3 py-2 font-medium">Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.breakdown.map((row) => (
                        <tr key={row.name} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                          <td className="px-3 py-2 text-slate-600">{row.student_value}</td>
                          <td className="px-3 py-2 text-slate-600">{row.required_value}</td>
                          <td className="px-3 py-2 text-slate-600">{row.result}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div>
                <p className="text-slate-500">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {details.notes || "—"}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setForm(details);
                    setDetails(null);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function NoticeBoard() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [form, setForm] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = () =>
    getNotices({
      page,
      page_size: 10,
      search: query,
      status_filter: filter === "All statuses" ? "" : filter.toLowerCase(),
    })
      .then((data) => {
        setRows(data.items);
        setTotal(data.total);
      })
      .catch(() => setError("Notices could not be loaded. Please try again."))
      .finally(() => setLoading(false));
  useEffect(() => {
    setLoading(true);
    setError("");
    load();
  }, [page, query, filter, refreshKey]);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = {
        title: form.title.trim(),
        content: form.content.trim(),
        audience: form.audience,
        expires_at: form.expires_at || null,
      };
      if (form.id) await updateNotice(form.id, payload);
      else await createNotice({ ...payload, status: "draft" });
      setPage(1);
      setRefreshKey((current) => current + 1);
      setFeedback(form.id ? "Notice updated." : "Draft saved.");
      setForm(null);
    } catch {
      setError(
        "The notice could not be saved. Please review the required fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const publish = async (id) => {
    setBusy(true);
    setError("");
    try {
      const updated = await publishNotice(id);
      setSelected(updated);
      setRefreshKey((current) => current + 1);
      setFeedback("Notice published.");
    } catch {
      setError("The notice could not be published. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id) => {
    setBusy(true);
    setError("");
    try {
      await deleteNotice(id);
      setSelected(null);
      setRefreshKey((current) => current + 1);
      setFeedback("Notice deleted.");
    } catch {
      setError("The notice could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  const openDetails = async (id) => {
    setSelected({ loading: true });
    try {
      setSelected(await getNotice(id));
    } catch {
      setSelected(null);
      setError("Notice details could not be loaded. Please try again.");
    }
  };
  const board = loading && !rows.length ? (
    <div className="panel grid min-h-64 place-items-center p-6">
      <div
        className="flex items-center gap-3 text-sm font-medium text-slate-600"
        role="status"
      >
        <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        Loading notices…
      </div>
    </div>
  ) : error && !rows.length ? (
    <div className="panel p-6" role="alert">
      <p className="text-sm font-medium text-slate-700">{error}</p>
      <RetryButton onClick={() => setRefreshKey((value) => value + 1)} />
    </div>
  ) : (
    <div className="panel">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchField
          value={query}
          onChange={(value) => { setQuery(value); setPage(1); }}
          placeholder="Search notice board..."
        />
        <div className="flex gap-2">
          <Filter
            value={filter}
            onChange={(event) => { setFilter(event.target.value); setPage(1); }}
          >
            <option>All statuses</option>
            <option>Published</option>
            <option>Draft</option>
          </Filter>
        </div>
      </div>
      <Table
        columns={["Notice", "Audience", "Published", "Status", ""]}
        rows={rows}
        empty="No notices match your filters."
        render={(notice) => (
          <tr key={notice.id}>
            <td className="px-5 py-4 font-medium text-ink">{notice.title}</td>
            <td className="px-5 py-4 text-slate-500">{notice.audience}</td>
            <td className="px-5 py-4 text-slate-500">
              {notice.status === "published"
                ? new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                  }).format(new Date(notice.published_at || notice.created_at))
                : "Draft"}
            </td>
            <td className="px-5 py-4">
              <Status
                value={notice.status === "published" ? "Published" : "Draft"}
              />
            </td>
            <td className="px-5 py-4 text-right">
              <button
                onClick={() => openDetails(notice.id)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={`Manage ${notice.title}`}
              >
                <MoreHorizontal className="size-5" />
              </button>
            </td>
          </tr>
        )}
      />
      <Pagination page={page} pageSize={10} total={total} onPageChange={setPage} />
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow="Admin / TPO"
        title="Notice board"
        text="Publish timely placement updates and student announcements."
        action={
          <button
            className="btn-primary"
            onClick={() => setForm({ title: "", audience: "", content: "", expires_at: "" })}
          >
            <Plus className="size-4" />
            Create notice
          </button>
        }
      />
      {feedback && (
        <p className="mb-4 text-sm font-medium text-emerald-700" role="status">
          {feedback}
        </p>
      )}
      {error && rows.length > 0 && (
        <div className="mb-4" role="alert">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <RetryButton onClick={() => setRefreshKey((value) => value + 1)} />
        </div>
      )}
      {board}
      {form && (
        <Modal
          title={form.id ? "Edit notice" : "Create notice"}
          onClose={() => setForm(null)}
        >
          <form onSubmit={save} className="space-y-4 p-6">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Notice title
              </span>
              <input
                required
                value={form.title}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Audience
              </span>
              <select
                required
                value={form.audience}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, audience: event.target.value })
                }
              >
                <option value="">Select Audience</option>
                <option>All students</option>
                <option>Final-year students</option>
                <option>Selected students</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Message
              </span>
              <textarea
                required
                value={form.content}
                className="input min-h-28"
                onChange={(event) =>
                  setForm({ ...form, content: event.target.value })
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Expiry date <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                type="datetime-local"
                value={form.expires_at || ""}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, expires_at: event.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {selected && (
        <Modal title="Notice details" onClose={() => setSelected(null)}>
          {selected.loading ? (
            <div className="p-6 text-sm text-slate-500" role="status">
              Loading notice details…
            </div>
          ) : (
            <div className="space-y-4 p-6 text-sm">
              <div>
                <p className="text-slate-500">Audience</p>
                <p className="mt-1 font-medium text-ink">{selected.audience}</p>
              </div>
              <div>
                <p className="text-slate-500">Message</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {selected.content}
                </p>
              </div>
              <div>
                <Status
                  value={
                    selected.status === "published" ? "Published" : "Draft"
                  }
                />
              </div>
              {selected.expires_at && (
                <div>
                  <p className="text-slate-500">Expires</p>
                  <p className="mt-1 font-medium text-ink">
                    {new Intl.DateTimeFormat(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(selected.expires_at))}
                  </p>
                </div>
              )}
              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setForm({
                      ...selected,
                      expires_at: selected.expires_at?.slice(0, 16) || "",
                    });
                    setSelected(null);
                  }}
                >
                  Edit
                </button>
                {selected.status === "draft" && (
                  <button
                    disabled={busy}
                    className="btn-primary"
                    onClick={() => publish(selected.id)}
                  >
                    {busy ? "Publishing…" : "Publish"}
                  </button>
                )}
                <button
                  disabled={busy}
                  className="text-sm font-semibold text-red-600"
                  onClick={() => remove(selected.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

function Recruiters() {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All applications");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [verifiedTotal, setVerifiedTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);
  const [details, setDetails] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);
  const [detailsError, setDetailsError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getRecruiters({
      page,
      page_size: 10,
      search: query,
      status_filter: filter === "All applications" ? "" : filter.toLowerCase(),
    })
      .then((data) => {
        if (active) {
          setRows(data.items);
          setTotal(data.total);
          setPendingTotal(data.pending_total);
          setVerifiedTotal(data.verified_total);
        }
      })
      .catch(() => {
        if (active)
          setError("Recruiter records could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, filter, refreshKey]);
  const verify = async (recruiterId) => {
    setError("");
    setUpdatingId(recruiterId);
    try {
      await updateRecruiterValidation(recruiterId, true);
      setRefreshKey((current) => current + 1);
    } catch {
      setError("The recruiter could not be verified. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };
  const reject = async (recruiterId) => {
    setError("");
    setUpdatingId(recruiterId);
    try {
      await updateRecruiterValidation(recruiterId, false);
      setDetails(null);
      setRefreshKey((current) => current + 1);
    } catch {
      setError("The recruiter could not be rejected. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };
  const view = async (recruiterId) => {
    setDetails({ loading: true });
    setDetailsError("");
    try {
      setDetails(await getRecruiter(recruiterId));
    } catch {
      setDetails(null);
      setDetailsError(
        "Recruiter details could not be loaded. Please try again.",
      );
    }
  };
  const previewDocument = async (recruiterId) => {
    setDetailsError("");
    try {
      const { blob, filename } = await getRecruiterVerificationDocument(recruiterId);
      setDocumentPreview({ url: URL.createObjectURL(blob), type: blob.type, filename });
    } catch {
      setDetailsError("The verification document could not be opened. Please try again.");
    }
  };
  const downloadDocument = async (recruiterId) => {
    setDetailsError("");
    try {
      const { blob, filename } = await getRecruiterVerificationDocument(recruiterId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setDetailsError("The verification document could not be downloaded. Please try again.");
    }
  };
  const body = loading && !rows.length ? (
    <div className="panel mt-6 grid min-h-64 place-items-center p-6">
      <div
        className="flex items-center gap-3 text-sm font-medium text-slate-600"
        role="status"
      >
        <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        Loading recruiter records…
      </div>
    </div>
  ) : error && !rows.length ? (
    <div className="panel mt-6 p-6" role="alert">
      <p className="text-sm font-medium text-slate-700">{error}</p>
      <RetryButton onClick={() => setRefreshKey((value) => value + 1)} />
    </div>
  ) : (
    <div className="panel mt-6">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:justify-between">
        <SearchField
          value={query}
          onChange={(value) => { setQuery(value); setPage(1); }}
          placeholder="Search companies or contacts..."
        />
        <Filter
          value={filter}
          onChange={(event) => { setFilter(event.target.value); setPage(1); }}
        >
          <option>All applications</option>
          <option>Pending</option>
          <option>Verified</option>
        </Filter>
      </div>
      <Table
        columns={[
          "Company",
          "Contact",
          "Email",
          "Openings",
          "Applied",
          "Status",
          "",
        ]}
        rows={rows}
        empty="No recruiter records match your filters."
        render={(r) => {
          const status = r.is_verified ? "Verified" : r.account_status === "rejected" ? "Rejected" : "Pending";
          return (
            <tr key={r.id}>
              <td className="px-5 py-4 font-medium text-ink">
                {r.company_name}
              </td>
              <td className="px-5 py-4">{r.full_name}</td>
              <td className="px-5 py-4 text-slate-500">{r.email}</td>
              <td className="px-5 py-4">{r.job_count}</td>
              <td className="px-5 py-4 text-slate-500">
                {new Intl.DateTimeFormat(undefined, {
                  dateStyle: "medium",
                }).format(new Date(r.created_at))}
              </td>
              <td className="px-5 py-4">
                <Status value={status} />
              </td>
              <td className="px-5 py-4 text-right">
                {r.account_status === "pending" ? (
                  <button
                    onClick={() => view(r.id)}
                    className="btn-secondary !px-3 !py-2"
                  >
                    Review
                  </button>
                ) : (
                  <button
                    onClick={() => view(r.id)}
                    className="btn-secondary !px-3 !py-2"
                  >
                    View
                  </button>
                )}
              </td>
            </tr>
          );
        }}
      />
      <Pagination page={page} pageSize={10} total={total} onPageChange={setPage} />
    </div>
  );
  return (
    <>
      <PageTitle
        eyebrow="Partner onboarding"
        title="Recruiter validation"
        text="Review organization details before recruiters can publish placement opportunities."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={ShieldCheck}
          label="Pending validation"
          value={loading ? "—" : pendingTotal}
          detail="Requires review"
          tone="amber"
        />
        <Stat
          icon={CheckCircle2}
          label="Verified recruiters"
          value={loading ? "—" : verifiedTotal}
          detail="Approved partners"
          tone="green"
        />
        <Stat
          icon={Building2}
          label="Total partners"
          value={loading ? "—" : pendingTotal + verifiedTotal}
          detail={`${verifiedTotal} currently verified`}
        />
      </div>
      {body}
      {detailsError && (
        <div className="mt-4 text-sm font-medium text-slate-700" role="alert">
          {detailsError}
        </div>
      )}
      {details && (
        <Modal title="Recruiter details" onClose={() => setDetails(null)}>
          {details.loading ? (
            <div className="p-6 text-sm text-slate-500" role="status">
              Loading recruiter details…
            </div>
          ) : (
            <div className="space-y-3 p-6 text-sm">
              <div>
                <p className="text-slate-500">Company</p>
                <p className="mt-1 font-medium text-ink">
                  {details.company_name}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Contact</p>
                <p className="mt-1 font-medium text-ink">{details.full_name}</p>
              </div>
              <div>
                <p className="text-slate-500">Email</p>
                <p className="mt-1 font-medium text-ink">{details.email}</p>
              </div>
              <div>
                <p className="text-slate-500">Phone / designation</p>
                <p className="mt-1 font-medium text-ink">{details.phone || "Not provided"}{details.designation ? ` · ${details.designation}` : ""}</p>
              </div>
              <div>
                <p className="text-slate-500">Submitted</p>
                <p className="mt-1 font-medium text-ink">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(details.created_at))}</p>
              </div>
              <div>
                <p className="text-slate-500">Website</p>
                <p className="mt-1 font-medium text-ink">
                  {details.company_website || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Company contact</p>
                <p className="mt-1 font-medium text-ink">{details.company_email || "Not provided"}{details.company_phone ? ` · ${details.company_phone}` : ""}</p>
              </div>
              <div>
                <p className="text-slate-500">Company address</p>
                <p className="mt-1 font-medium text-ink">{details.company_address || "Not provided"}</p>
              </div>
              <div>
                <p className="text-slate-500">Openings</p>
                <p className="mt-1 font-medium text-ink">{details.job_count}</p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <div className="mt-1">
                  <Status
                    value={details.is_verified ? "Verified" : details.account_status === "rejected" ? "Rejected" : "Pending"}
                  />
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-500">Verification document</p>
                {details.verification_document ? <><p className="mt-1 font-medium text-ink">{details.verification_document.original_filename}</p><p className="mt-1 text-xs text-slate-500">{details.verification_document.content_type} · {(details.verification_document.file_size / 1024 / 1024).toFixed(2)} MB</p><div className="mt-3 flex gap-4"><button className="text-sm font-semibold text-brand-600" onClick={() => previewDocument(details.id)}>Open document</button><button className="text-sm font-semibold text-brand-600" onClick={() => downloadDocument(details.id)}>Download</button></div></> : <p className="mt-1 text-sm text-slate-500">No verification document was submitted.</p>}
              </div>
              {details.account_status === "pending" && <div className="flex justify-end gap-3 border-t border-slate-100 pt-4"><button disabled={updatingId === details.id} className="text-sm font-semibold text-red-600" onClick={() => reject(details.id)}>Reject</button><button disabled={updatingId === details.id} className="btn-primary" onClick={() => verify(details.id)}>{updatingId === details.id ? "Updating…" : "Verify Recruiter"}</button></div>}
            </div>
          )}
        </Modal>
      )}
      {documentPreview && (
        <Modal title={documentPreview.filename} onClose={() => { URL.revokeObjectURL(documentPreview.url); setDocumentPreview(null); }}>
          <div className="p-4">
            {documentPreview.type === "application/pdf" ? <iframe title="Recruiter verification document" src={documentPreview.url} className="h-[60vh] w-full rounded-lg border border-slate-200" /> : <img src={documentPreview.url} alt="Recruiter verification document" className="max-h-[60vh] w-full object-contain" />}
          </div>
        </Modal>
      )}
    </>
  );
}

function Notifications() {
  const [items, setItems] = useState([]),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [refreshKey, setRefreshKey] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [form, setForm] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getNotifications({ page, page_size: 10, search: query })
      .then((data) => {
        if (active) {
          setItems(data.items);
          setTotal(data.total);
        }
      })
      .catch(
        () =>
          active &&
          setError("Notifications could not be loaded. Please try again."),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page, query, refreshKey]);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await createNotification({
        title: form.title.trim(),
        message: form.message.trim(),
        audience: form.audience,
      });
      setPage(1);
      setRefreshKey((current) => current + 1);
      setForm(null);
    } catch {
      setError(
        "The alert could not be saved. Please review the required fields and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="Admin / TPO"
        title="Notifications & alerts"
        text="Create targeted in-app alerts for students, recruiters, and the placement team."
        action={
          <button
            className="btn-primary"
            onClick={() => setForm({ title: "", audience: "", message: "" })}
          >
            <Plus className="size-4" />
            Create alert
          </button>
        }
      />
      {error && (
        <div className="mb-4" role="alert">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <RetryButton onClick={() => setRefreshKey((value) => value + 1)} />
        </div>
      )}
      {loading && !items.length ? (
        <div className="panel grid min-h-64 place-items-center p-6">
          <div
            className="flex items-center gap-3 text-sm font-medium text-slate-600"
            role="status"
          >
            <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Loading alerts…
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="border-b border-slate-100 p-4">
            <SearchField
              value={query}
              onChange={(value) => { setQuery(value); setPage(1); }}
              placeholder="Search notifications & alerts..."
            />
          </div>
          <Table
            columns={["Title", "Message", "Audience", "Time", ""]}
            rows={items}
            empty="No notifications match your search."
            render={(item) => (
              <tr key={item.id}>
                <td className="px-5 py-4 font-medium text-ink">{item.title}</td>
                <td className="px-5 py-4 text-slate-500">{item.message}</td>
                <td className="px-5 py-4 text-slate-500">{item.audience}</td>
                <td className="px-5 py-4 text-slate-500">
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(item.created_at))}
                </td>
                <td className="px-5 py-4" />
              </tr>
            )}
          />
          <Pagination page={page} pageSize={10} total={total} onPageChange={setPage} />
        </div>
      )}
      {form && (
        <Modal title="Create alert" onClose={() => setForm(null)}>
          <form onSubmit={save} className="space-y-4 p-6">
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Alert title
              </span>
              <input
                required
                value={form.title}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, title: event.target.value })
                }
              />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Audience
              </span>
              <select
                required
                value={form.audience}
                className="input"
                onChange={(event) =>
                  setForm({ ...form, audience: event.target.value })
                }
              >
                <option value="">Select Audience</option>
                <option>All students</option>
                <option>Eligible students</option>
                <option>Recruiters</option>
                <option>Placement team</option>
              </select>
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-slate-700">
                Message
              </span>
              <textarea
                required
                value={form.message}
                className="input min-h-28"
                onChange={(event) =>
                  setForm({ ...form, message: event.target.value })
                }
              />
            </label>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm(null)}
              >
                Cancel
              </button>
              <button disabled={busy} className="btn-primary">
                {busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAnalytics()
      .then((data) => {
        if (active) setAnalytics(data);
      })
      .catch(() => {
        if (active)
          setError("Analytics could not be loaded. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [retryKey]);
  const download = async () => {
    setExporting(true);
    setError("");
    try {
      const { blob, filename } = await downloadOverallReport();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Overall report could not be generated. Please try again.");
    } finally {
      setExporting(false);
    }
  };
  const title = (
    <PageTitle
      eyebrow="Placement insights"
      title="Analytics"
      text="Monitor outcomes, partner activity, and placement pipeline health."
      action={
        <button
          disabled={exporting}
          onClick={download}
          className="btn-secondary"
        >
          {exporting ? "Generating…" : "Generate Report"}
        </button>
      }
    />
  );
  if (loading)
    return (
      <>
        {title}
        <div className="panel grid min-h-64 place-items-center p-6">
          <div
            className="flex items-center gap-3 text-sm font-medium text-slate-600"
            role="status"
          >
            <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            Loading analytics…
          </div>
        </div>
      </>
    );
  if (error)
    return (
      <>
        {title}
        <div className="panel p-6" role="alert">
          <p className="text-sm font-medium text-slate-700">{error}</p>
          <RetryButton onClick={() => setRetryKey((value) => value + 1)} />
        </div>
      </>
    );
  if (!analytics) return null;
  const o = analytics;
  return (
    <>
      {title}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={Users}
          label="Applications"
          value={o.applications.toLocaleString()}
          detail={`Across ${o.jobs.toLocaleString()} job postings`}
        />
        <Stat
          icon={CheckCircle2}
          label="Eligible assessments"
          value={o.eligible_records}
          detail={
            o.eligibility_assessments
              ? `${o.eligibility_assessments.toLocaleString()} student–role assessments tracked`
              : "No eligibility assessments yet"
          }
          tone="green"
        />
        <Stat
          icon={Building2}
          label="Company engagement"
          value={`${o.company_engagement_rate}%`}
          detail={`${o.companies_with_openings.toLocaleString()} of ${o.companies.toLocaleString()} companies with openings`}
        />
        <Stat
          icon={BarChart3}
          label="Conversion rate"
          value={`${o.conversion_rate}%`}
          detail={
            o.shortlisted_applications
              ? `${o.shortlisted_applications.toLocaleString()} shortlisted applications`
              : "No shortlisted applications yet"
          }
          tone="amber"
        />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="panel p-5">
          <h3 className="font-semibold text-ink">Application trend</h3>
          <p className="text-sm text-slate-500">Monthly applications</p>
          <div className="mt-5 h-72">
            <ResponsiveContainer>
              <AreaChart data={o.application_trend}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Area
                  dataKey="applications"
                  type="monotone"
                  stroke="#2563eb"
                  fill="#dbeafe"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel p-5">
          <h3 className="font-semibold text-ink">Application Status Distribution</h3>
          <p className="text-sm text-slate-500">
            Applications by current recruitment status
          </p>
          {o.application_status_distribution.length ? (
            <div className="mt-5 h-72">
              <ResponsiveContainer>
                <BarChart data={o.application_status_distribution}>
                  <CartesianGrid vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#2563eb" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="grid h-72 place-items-center text-sm text-slate-500">
              No application data available yet.
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Unauthorized() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="panel max-w-md p-8 text-center">
        <ShieldCheck className="mx-auto size-10 text-red-500" />
        <h1 className="mt-4 text-xl font-semibold text-ink">
          Admin access required
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          This area is limited to authenticated Admin/TPO users.
        </p>
      </div>
    </div>
  );
}
function Profile() {
  const { user } = useAuth();
  return <>
    <PageTitle eyebrow="Account" title="Profile" text="Your HireSense account information." />
    <section className="panel max-w-2xl p-6">
      <dl className="divide-y divide-slate-100 text-sm">
        {[["Name", user?.full_name], ["Email", user?.email], ["Role", ['tpo', 'super_admin'].includes(user?.role) ? "Admin / TPO" : user?.role]].map(([label, value]) => <div className="grid gap-1 py-4 sm:grid-cols-3" key={label}><dt className="font-medium text-slate-500">{label}</dt><dd className="font-medium text-ink sm:col-span-2">{value || "—"}</dd></div>)}
      </dl>
    </section>
  </>;
}
function ChangePassword() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError(""); setSuccess("");
    if (form.newPassword.length < 8) return setError("Use at least 8 characters for your new password.");
    if (form.newPassword !== form.confirmPassword) return setError("New passwords do not match.");
    setBusy(true);
    try {
      await changePassword({ current_password: form.currentPassword, new_password: form.newPassword });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Password updated successfully.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Password could not be updated. Please try again.");
    } finally { setBusy(false); }
  };
  return <>
    <PageTitle eyebrow="Account" title="Change password" text="Choose a new password for your HireSense account." />
    <form className="panel max-w-2xl space-y-4 p-6" onSubmit={submit}>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Current password</span><input required type="password" autoComplete="current-password" value={form.currentPassword} className="input" onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">New password</span><input required minLength="8" type="password" autoComplete="new-password" value={form.newPassword} className="input" onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
      <label className="block"><span className="mb-1.5 block text-sm font-medium text-slate-700">Confirm new password</span><input required minLength="8" type="password" autoComplete="new-password" value={form.confirmPassword} className="input" onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
      {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
      {success && <p className="text-sm font-medium text-emerald-700" role="status">{success}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
    </form>
  </>;
}
function RecruitmentJobs() {
  const [jobs, setJobs] = useState([]);
  const [error, setError] = useState("");
  const [analyses, setAnalyses] = useState([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  useEffect(() => { getRecruitmentJobs().then(setJobs).catch((e) => setError(e.message || "Could not load recruitment jobs.")); }, []);
  const loadAnalyses = async (job) => {setSelectedJob(job.id);setSelectedAnalysis(null);try{setAnalyses(await getJobAnalyses(job.id))}catch(e){setError(e.message||"Could not load job analyses.")}};
  const loadAnalysis = async (id) => {try{setSelectedAnalysis(await getRecruitmentAnalysis(id))}catch(e){setError(e.message||"Could not load analysis.")}};
  return <section className="space-y-5"><header><h1 className="text-2xl font-semibold text-slate-900">Recruitment jobs</h1><p className="mt-1 text-sm text-slate-500">Shared jobs and analysis batches from the recruiter workflow.</p></header>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="overflow-hidden rounded-xl border border-slate-200 bg-white"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Job</th><th className="p-3">Company / Owner</th><th className="p-3">Status</th><th className="p-3">Auto shortlist threshold</th><th className="p-3">Analyses</th></tr></thead><tbody>{jobs.map((job)=><tr key={job.id} className="border-t border-slate-100"><td className="p-3"><strong>{job.title}</strong><div className="text-xs text-slate-500">{job.department || ""} · {job.location || ""}</div></td><td className="p-3">{job.company_name || "—"}<div className="text-xs text-slate-500">{job.owner_name || ""}</div></td><td className="p-3">{job.status}</td><td className="p-3">{job.shortlist_threshold ?? 75}%</td><td className="p-3"><button className="font-semibold text-brand-700" onClick={()=>loadAnalyses(job)}>{job.analysis_count} · View batches</button></td></tr>)}{jobs.length===0&&<tr><td className="p-4 text-slate-500" colSpan={5}>No recruitment jobs are available.</td></tr>}</tbody></table></div>{selectedJob&&<div className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="font-semibold">Analysis batches</h2><div className="mt-3 flex flex-wrap gap-2">{analyses.map(item=><button key={item.id} onClick={()=>loadAnalysis(item.id)} className="rounded-lg border px-3 py-2 text-left text-sm">{item.id.slice(0,8)} · {item.status} · {item.candidate_count} candidates</button>)}{analyses.length===0&&<p className="text-sm text-slate-500">No analysis batches for this job.</p>}</div>{selectedAnalysis&&<div className="mt-4 border-t pt-4"><h3 className="font-medium">Candidates and saved shortlist state</h3><div className="mt-2 divide-y">{selectedAnalysis.candidates.map(candidate=><div key={candidate.id} className="flex justify-between py-2 text-sm"><span>{candidate.name} · {candidate.overall_score}</span><span className="flex items-center gap-2">{candidate.is_shortlisted?'Shortlisted':'Not shortlisted'}<span className="text-xs text-slate-500">· {candidate.shortlist_source || 'automatic'}</span></span></div>)}</div></div>}</div>}</section>;
}

function AdminRoutes() {
  return (
    <Shell>
      <Routes>
        <Route index element={<Overview />} />
        <Route path="recruiters" element={<Recruiters />} />
        <Route path="notices" element={<NoticeBoard />} />
        <Route path="students" element={<Students />} />
        <Route path="companies" element={<Companies />} />
        <Route path="jobs" element={<RecruitmentJobs />} />
        <Route path="eligibility" element={<Eligibility />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<Profile />} />
        <Route path="change-password" element={<ChangePassword />} />
      </Routes>
    </Shell>
  );
}
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route
        path="/admin/*"
        element={
          <ProtectedAdmin>
            <AdminRoutes />
          </ProtectedAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

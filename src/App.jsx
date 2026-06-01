import { useState, useEffect, useCallback, useRef } from "react";

// ─── Utility ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (h, m) => `${pad(h)}:${pad(m)}`;

const CATEGORIES = [
  { id: "work", label: "Travail", emoji: "💼", color: "#6366f1" },
  { id: "sport", label: "Sport", emoji: "🏃", color: "#10b981" },
  { id: "study", label: "Études", emoji: "📚", color: "#f59e0b" },
  { id: "personal", label: "Personnel", emoji: "🌟", color: "#ec4899" },
  { id: "health", label: "Santé", emoji: "🧘", color: "#14b8a6" },
  { id: "other", label: "Autre", emoji: "📌", color: "#8b5cf6" },
];

const PRIORITIES = [
  { id: "low", label: "Faible", color: "#22c55e", bg: "#dcfce7" },
  { id: "medium", label: "Moyenne", color: "#f59e0b", bg: "#fef3c7" },
  { id: "high", label: "Élevée", color: "#ef4444", bg: "#fee2e2" },
];

const REMINDER_OPTIONS = [
  { value: 0, label: "À l'heure exacte" },
  { value: 5, label: "5 min avant" },
  { value: 15, label: "15 min avant" },
  { value: 30, label: "30 min avant" },
  { value: 60, label: "1 heure avant" },
];

const VIEWS = ["Jour", "Semaine", "Mois", "Stats"];

const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTHS_FR = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const greetings = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
};

const getCat = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[5];
const getPri = (id) => PRIORITIES.find((p) => p.id === id) || PRIORITIES[0];

// ─── Notification ────────────────────────────────────────────────────────────
const requestNotifPermission = async () => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const res = await Notification.requestPermission();
  return res === "granted";
};

const scheduleNotif = (task) => {
  if (!task.startTime || !task.date) return;
  const [h, m] = task.startTime.split(":").map(Number);
  const taskDate = new Date(task.date);
  taskDate.setHours(h, m, 0, 0);
  const reminder = task.reminder ?? 0;
  const fireAt = new Date(taskDate.getTime() - reminder * 60000);
  const delay = fireAt.getTime() - Date.now();
  if (delay <= 0) return;
  setTimeout(() => {
    if (Notification.permission === "granted") {
      new Notification(`⏰ ${task.title}`, {
        body: reminder === 0 ? "C'est l'heure !" : `Dans ${reminder} minutes`,
        icon: "https://cdn.jsdelivr.net/npm/lucide-static@0.383.0/icons/check-square.svg",
      });
    }
  }, delay);
};

// ─── Storage ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "taskflow_v1";

// Safe storage — works on Safari private mode too
const safeGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key, val) => { try { localStorage.setItem(key, val); } catch {} };

const loadData = () => {
  try {
    const raw = safeGet(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { tasks: [], userName: "" };
  } catch { return { tasks: [], userName: "" }; }
};
const saveData = (data) => {
  try { safeSet(STORAGE_KEY, JSON.stringify(data)); } catch {}
};

// ─── Icons (inline SVG) ──────────────────────────────────────────────────────
const Icon = ({ name, size = 18, color = "currentColor" }) => {
  const icons = {
    plus: <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2" strokeLinecap="round"/>,
    check: <path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>,
    trash: <><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    edit: <><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke={color} strokeWidth="2" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke={color} strokeWidth="2" strokeLinecap="round"/></>,
    sun: <><circle cx="12" cy="12" r="5" stroke={color} strokeWidth="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke={color} strokeWidth="2" strokeLinecap="round"/></>,
    moon: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    bell: <><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke={color} strokeWidth="2" strokeLinecap="round"/></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke={color} strokeWidth="2" strokeLinecap="round"/></>,
    chart: <><path d="M18 20V10M12 20V4M6 20v-6" stroke={color} strokeWidth="2.5" strokeLinecap="round"/></>,
    search: <><circle cx="11" cy="11" r="8" stroke={color} strokeWidth="2"/><path d="M21 21l-4.35-4.35" stroke={color} strokeWidth="2" strokeLinecap="round"/></>,
    x: <path d="M18 6L6 18M6 6l12 12" stroke={color} strokeWidth="2" strokeLinecap="round"/>,
    star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    clock: <><circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2"/><path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round"/></>,
    fire: <path d="M12 2c0 0-5 4-5 9a5 5 0 0010 0c0-2-1-4-2-5 0 2-1 3-3 3s-2-2-2-3c0-2 2-4 2-4z" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    chevLeft: <path d="M15 18l-6-6 6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    chevRight: <path d="M9 18l6-6-6-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
    drag: <path d="M9 5h2M9 12h2M9 19h2M13 5h2M13 12h2M13 19h2" stroke={color} strokeWidth="2" strokeLinecap="round"/>,
    export: <><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
    repeat: <><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {icons[name]}
    </svg>
  );
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const CSS = `
  

  :root {
    --bg: #f8f7f4;
    --surface: #ffffff;
    --surface2: #f2f0ec;
    --border: #e8e5df;
    --text: #1a1916;
    --text2: #6b6860;
    --text3: #9c9890;
    --accent: #2d6a4f;
    --accent2: #52b788;
    --accent-light: #d8f3dc;
    --danger: #ef4444;
    --shadow: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.10), 0 4px 8px rgba(0,0,0,0.06);
    --radius: 16px;
    --radius-sm: 10px;
    --font: 'Cabinet Grotesk', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
    --font-body: 'DM Sans', -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  }
  .dark {
    --bg: #111110;
    --surface: #1c1c1a;
    --surface2: #242422;
    --border: #2e2e2b;
    --text: #f0ede8;
    --text2: #a09d97;
    --text3: #6b6860;
    --accent: #52b788;
    --accent2: #74c69d;
    --accent-light: #1a3a2a;
    --shadow: 0 2px 8px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2);
    --shadow-lg: 0 12px 32px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.3);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { font-size: 16px; }
  body { font-family: var(--font-body); background: var(--bg); color: var(--text); transition: background 0.3s, color 0.3s; }

  .app { min-height: 100vh; display: flex; flex-direction: column; max-width: 430px; margin: 0 auto; position: relative; }
  @media (min-width: 768px) { .app { max-width: 100%; flex-direction: row; } }

  /* Sidebar */
  .sidebar { display: none; }
  @media (min-width: 768px) {
    .sidebar { display: flex; flex-direction: column; width: 260px; min-height: 100vh; background: var(--surface); border-right: 1px solid var(--border); padding: 28px 20px; position: sticky; top: 0; height: 100vh; overflow-y: auto; flex-shrink: 0; }
  }
  .sidebar-logo { font-family: var(--font); font-weight: 800; font-size: 22px; color: var(--accent); margin-bottom: 32px; display: flex; align-items: center; gap: 10px; }
  .sidebar-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .sidebar-item { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: var(--radius-sm); cursor: pointer; font-family: var(--font); font-weight: 600; font-size: 14px; color: var(--text2); transition: all 0.15s; border: none; background: none; width: 100%; text-align: left; }
  .sidebar-item:hover { background: var(--surface2); color: var(--text); }
  .sidebar-item.active { background: var(--accent-light); color: var(--accent); }
  .sidebar-cats { margin-top: 28px; }
  .sidebar-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--text3); text-transform: uppercase; margin-bottom: 10px; padding: 0 14px; }
  .cat-pill { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-radius: var(--radius-sm); cursor: pointer; font-size: 13px; font-weight: 500; color: var(--text2); transition: all 0.15s; }
  .cat-pill:hover { background: var(--surface2); }
  .cat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .sidebar-bottom { margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
  .avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--accent-light); display: flex; align-items: center; justify-content: center; font-family: var(--font); font-weight: 700; font-size: 14px; color: var(--accent); flex-shrink: 0; }

  /* Main */
  .main { flex: 1; overflow-y: auto; padding-bottom: 100px; }
  @media (min-width: 768px) { .main { padding-bottom: 40px; } }

  /* Header */
  .header { padding: 20px 20px 0; position: sticky; top: 0; z-index: 10; background: var(--bg); }
  @media (min-width: 768px) { .header { padding: 28px 32px 0; } }
  .header-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .header-greeting { font-family: var(--font); font-weight: 800; font-size: 22px; line-height: 1.2; }
  .header-date { font-size: 13px; color: var(--text2); margin-top: 2px; }
  .header-actions { display: flex; gap: 8px; }
  .icon-btn { width: 38px; height: 38px; border-radius: 50%; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text2); transition: all 0.15s; flex-shrink: 0; }
  .icon-btn:hover { background: var(--surface2); color: var(--text); }

  /* Search */
  .search-wrap { position: relative; margin-bottom: 20px; }
  .search-input { width: 100%; padding: 12px 16px 12px 44px; background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; color: var(--text); outline: none; transition: border 0.2s; }
  .search-input:focus { border-color: var(--accent2); }
  .search-input::placeholder { color: var(--text3); }
  .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text3); pointer-events: none; }

  /* Stats bar */
  .stats-bar { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 0 20px 20px; }
  @media (min-width: 768px) { .stats-bar { padding: 0 32px 24px; } }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 14px; }
  .stat-val { font-family: var(--font); font-weight: 800; font-size: 24px; color: var(--text); line-height: 1; }
  .stat-label { font-size: 11px; color: var(--text2); margin-top: 4px; font-weight: 500; }
  .stat-card.accent { background: var(--accent); border-color: var(--accent); }
  .stat-card.accent .stat-val, .stat-card.accent .stat-label { color: #fff; }

  /* Progress */
  .progress-wrap { padding: 0 20px 20px; }
  @media (min-width: 768px) { .progress-wrap { padding: 0 32px 24px; } }
  .progress-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; font-weight: 600; }
  .progress-bar { height: 8px; background: var(--surface2); border-radius: 99px; overflow: hidden; }
  .progress-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; transition: width 0.5s cubic-bezier(.4,0,.2,1); }

  /* Views nav */
  .views-nav { display: flex; gap: 4px; padding: 0 20px 16px; overflow-x: auto; scrollbar-width: none; }
  .views-nav::-webkit-scrollbar { display: none; }
  @media (min-width: 768px) { .views-nav { padding: 0 32px 20px; } }
  .view-tab { padding: 8px 16px; border-radius: 99px; font-family: var(--font); font-weight: 600; font-size: 13px; cursor: pointer; white-space: nowrap; border: 1.5px solid transparent; transition: all 0.15s; color: var(--text2); background: transparent; }
  .view-tab:hover { background: var(--surface); border-color: var(--border); }
  .view-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }

  /* Section */
  .section { padding: 0 20px; margin-bottom: 8px; }
  @media (min-width: 768px) { .section { padding: 0 32px; } }
  .section-title { font-family: var(--font); font-weight: 700; font-size: 15px; color: var(--text2); margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
  .badge { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 99px; background: var(--surface2); color: var(--text2); font-size: 11px; font-weight: 700; }

  /* Task card */
  .task-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 24px; }
  .task-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-sm); padding: 14px; display: flex; gap: 12px; align-items: flex-start; transition: all 0.2s; cursor: pointer; position: relative; overflow: hidden; }
  .task-card:hover { box-shadow: var(--shadow); border-color: var(--accent2); transform: translateY(-1px); }
  .task-card.done { opacity: 0.55; }
  .task-card.done .task-title { text-decoration: line-through; color: var(--text2); }
  .task-card-left { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .check-btn { width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--border); background: transparent; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; }
  .check-btn.checked { background: var(--accent); border-color: var(--accent); }
  .task-body { flex: 1; min-width: 0; }
  .task-title { font-family: var(--font); font-weight: 600; font-size: 15px; line-height: 1.3; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .task-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .task-time { font-size: 12px; color: var(--text2); display: flex; align-items: center; gap: 4px; }
  .pri-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 99px; }
  .cat-badge { font-size: 11px; font-weight: 500; color: var(--text2); display: flex; align-items: center; gap: 4px; }
  .task-actions { display: flex; gap: 6px; opacity: 0; transition: opacity 0.15s; }
  .task-card:hover .task-actions { opacity: 1; }
  .task-action-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text2); transition: all 0.15s; }
  .task-action-btn:hover { background: var(--surface2); color: var(--text); }
  .task-action-btn.danger:hover { background: #fee2e2; color: var(--danger); border-color: #fca5a5; }
  .priority-stripe { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; }

  /* Empty */
  .empty { text-align: center; padding: 48px 24px; color: var(--text3); }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }
  .empty p { font-size: 14px; line-height: 1.5; }

  /* FAB */
  .fab { position: fixed; bottom: 88px; right: 20px; width: 56px; height: 56px; border-radius: 50%; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(45,106,79,0.35); z-index: 50; transition: all 0.2s; color: white; }
  .fab:hover { transform: scale(1.08); box-shadow: 0 6px 28px rgba(45,106,79,0.45); }
  @media (min-width: 768px) { .fab { bottom: 40px; right: 40px; } }

  /* Bottom nav */
  .bottom-nav { position: fixed; bottom: 0; left: 0; right: 0; max-width: 430px; margin: 0 auto; background: var(--surface); border-top: 1px solid var(--border); display: flex; z-index: 40; padding: 8px 0 env(safe-area-inset-bottom, 8px); }
  @media (min-width: 768px) { .bottom-nav { display: none; } }
  .nav-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 0; cursor: pointer; color: var(--text3); font-size: 10px; font-weight: 600; font-family: var(--font); transition: color 0.15s; border: none; background: none; }
  .nav-item.active { color: var(--accent); }

  /* Modal */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: fadeIn 0.2s; }
  @media (min-width: 768px) { .modal-overlay { align-items: center; } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .modal { background: var(--surface); width: 100%; max-width: 560px; border-radius: 24px 24px 0 0; padding: 24px 24px 40px; max-height: 92vh; overflow-y: auto; animation: slideUp 0.3s cubic-bezier(.4,0,.2,1); }
  @media (min-width: 768px) { .modal { border-radius: 24px; } }
  @keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  .modal-handle { width: 40px; height: 4px; border-radius: 99px; background: var(--border); margin: 0 auto 20px; }
  @media (min-width: 768px) { .modal-handle { display: none; } }
  .modal-title { font-family: var(--font); font-weight: 800; font-size: 20px; margin-bottom: 20px; }

  /* Form */
  .form-group { margin-bottom: 16px; }
  .form-label { font-size: 12px; font-weight: 600; color: var(--text2); margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.05em; }
  .form-input, .form-textarea, .form-select { width: 100%; padding: 12px 14px; background: var(--surface2); border: 1.5px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; color: var(--text); outline: none; transition: border 0.2s; }
  .form-input:focus, .form-textarea:focus, .form-select:focus { border-color: var(--accent2); background: var(--surface); }
  .form-textarea { resize: vertical; min-height: 80px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pills { display: flex; flex-wrap: wrap; gap: 8px; }
  .pill { padding: 8px 14px; border-radius: 99px; border: 1.5px solid var(--border); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: var(--font); color: var(--text2); background: transparent; }
  .pill:hover { border-color: var(--accent2); color: var(--text); }
  .pill.selected { border-color: var(--accent); color: var(--accent); background: var(--accent-light); }
  .btn-row { display: flex; gap: 10px; margin-top: 20px; }
  .btn { flex: 1; padding: 14px; border-radius: var(--radius-sm); font-family: var(--font); font-weight: 700; font-size: 15px; cursor: pointer; border: none; transition: all 0.15s; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
  .btn-secondary { background: var(--surface2); color: var(--text); }
  .btn-secondary:hover { background: var(--border); }

  /* Calendar */
  .calendar { padding: 0 20px; }
  @media (min-width: 768px) { .calendar { padding: 0 32px; } }
  .cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .cal-month { font-family: var(--font); font-weight: 700; font-size: 17px; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
  .cal-day-label { text-align: center; font-size: 11px; font-weight: 600; color: var(--text3); padding: 4px 0; text-transform: uppercase; }
  .cal-day { aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; position: relative; transition: all 0.15s; color: var(--text2); }
  .cal-day:hover { background: var(--surface2); }
  .cal-day.today { font-weight: 800; color: var(--accent); background: var(--accent-light); }
  .cal-day.selected { background: var(--accent); color: #fff; }
  .cal-day.has-tasks::after { content: ''; position: absolute; bottom: 4px; width: 4px; height: 4px; border-radius: 50%; background: var(--accent2); }
  .cal-day.selected::after { background: rgba(255,255,255,0.7); }
  .cal-day.other-month { opacity: 0.3; }

  /* Week view */
  .week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; padding: 0 20px; }
  @media (min-width: 768px) { .week-grid { padding: 0 32px; } }
  .week-col { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 6px; min-height: 120px; }
  .week-col-header { text-align: center; margin-bottom: 8px; }
  .week-col-day { font-size: 10px; font-weight: 600; color: var(--text3); text-transform: uppercase; }
  .week-col-num { font-family: var(--font); font-weight: 800; font-size: 18px; color: var(--text); }
  .week-col.today .week-col-num { color: var(--accent); }
  .week-task { padding: 4px 6px; border-radius: 6px; margin-bottom: 4px; font-size: 10px; font-weight: 600; color: #fff; line-height: 1.3; }

  /* Stats */
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 20px; }
  @media (min-width: 768px) { .stats-grid { padding: 0 32px; grid-template-columns: repeat(4, 1fr); } }
  .stat-big { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 20px; }
  .stat-big-val { font-family: var(--font); font-weight: 800; font-size: 36px; line-height: 1; color: var(--accent); }
  .stat-big-label { font-size: 12px; color: var(--text2); margin-top: 4px; font-weight: 500; }
  .bar-chart { padding: 0 20px; margin-top: 20px; }
  @media (min-width: 768px) { .bar-chart { padding: 0 32px; } }
  .bar-chart-title { font-family: var(--font); font-weight: 700; font-size: 15px; margin-bottom: 16px; }
  .bars { display: flex; align-items: flex-end; gap: 8px; height: 100px; }
  .bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
  .bar { width: 100%; background: var(--accent); border-radius: 6px 6px 0 0; min-height: 4px; transition: height 0.5s cubic-bezier(.4,0,.2,1); }
  .bar-label { font-size: 10px; color: var(--text3); font-weight: 600; }
  .streak-card { margin: 16px 20px 0; padding: 20px; background: linear-gradient(135deg, var(--accent), var(--accent2)); border-radius: var(--radius-sm); color: white; display: flex; align-items: center; gap: 16px; }
  @media (min-width: 768px) { .streak-card { margin: 16px 32px 0; } }
  .streak-num { font-family: var(--font); font-weight: 800; font-size: 48px; line-height: 1; }
  .streak-label { font-size: 14px; opacity: 0.85; margin-top: 4px; }

  /* Name modal */
  .name-overlay { position: fixed; inset: 0; background: var(--bg); z-index: 200; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px; }
  .name-title { font-family: var(--font); font-weight: 800; font-size: 32px; text-align: center; margin-bottom: 8px; }
  .name-sub { color: var(--text2); text-align: center; margin-bottom: 32px; font-size: 15px; }
  .name-logo { font-size: 48px; margin-bottom: 24px; }

  /* Notif toast */
  .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 12px 20px; box-shadow: var(--shadow-lg); z-index: 300; font-size: 14px; font-weight: 600; animation: toastIn 0.3s; white-space: nowrap; display: flex; align-items: center; gap: 8px; }
  @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(-10px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

  /* Drag */
  .dragging { opacity: 0.4; }
  .drag-over { border-color: var(--accent2) !important; background: var(--accent-light) !important; }

  .filter-row { display: flex; gap: 8px; padding: 0 20px 16px; overflow-x: auto; scrollbar-width: none; }
  .filter-row::-webkit-scrollbar { display: none; }
  @media (min-width: 768px) { .filter-row { padding: 0 32px 16px; } }
  .filter-chip { padding: 6px 14px; border-radius: 99px; border: 1.5px solid var(--border); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; color: var(--text2); background: transparent; transition: all 0.15s; }
  .filter-chip:hover { border-color: var(--accent2); color: var(--text); }
  .filter-chip.active { background: var(--surface2); border-color: var(--accent); color: var(--accent); }

  .notif-perm { margin: 0 20px 16px; padding: 14px; background: linear-gradient(135deg, #f0fdf4, #dcfce7); border: 1px solid #86efac; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 12px; cursor: pointer; }
  .dark .notif-perm { background: linear-gradient(135deg, #14291e, #1a3a2a); border-color: #2d6a4f; }
  .notif-perm p { font-size: 13px; font-weight: 600; color: #166534; }
  .dark .notif-perm p { color: var(--accent2); }
  .notif-perm span { font-size: 11px; color: #15803d; opacity: 0.8; }
  .dark .notif-perm span { color: var(--text2); }
`;

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData] = useState(() => loadData());
  const [dark, setDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const [view, setView] = useState(0);
  const [selectedDate, setSelectedDate] = useState(today());
  const [calDate, setCalDate] = useState(new Date());
  const [modal, setModal] = useState(null); // null | 'add' | 'edit'
  const [editTask, setEditTask] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [filterPri, setFilterPri] = useState("all");
  const [toast, setToast] = useState(null);
  const [notifGranted, setNotifGranted] = useState(Notification?.permission === "granted");
  const [nameModal, setNameModal] = useState(!data.userName);
  const [nameInput, setNameInput] = useState("");
  const dragRef = useRef(null);

  const tasks = data.tasks;

  const showToast = (msg, emoji = "✅") => {
    setToast({ msg, emoji });
    setTimeout(() => setToast(null), 2500);
  };

  const save = (newData) => {
    setData(newData);
    saveData(newData);
  };

  const addTask = (task) => {
    const t = { ...task, id: uid(), done: false, createdAt: Date.now() };
    scheduleNotif(t);
    save({ ...data, tasks: [...tasks, t] });
    showToast("Tâche ajoutée !");
  };

  const updateTask = (updated) => {
    save({ ...data, tasks: tasks.map((t) => (t.id === updated.id ? updated : t)) });
    showToast("Tâche modifiée !");
  };

  const deleteTask = (id) => {
    save({ ...data, tasks: tasks.filter((t) => t.id !== id) });
    showToast("Tâche supprimée", "🗑️");
  };

  const toggleDone = (id) => {
    save({ ...data, tasks: tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) });
  };

  // Stats
  const todayTasks = tasks.filter((t) => t.date === selectedDate);
  const doneTasks = todayTasks.filter((t) => t.done);
  const remaining = todayTasks.length - doneTasks.length;
  const progress = todayTasks.length ? Math.round((doneTasks.length / todayTasks.length) * 100) : 0;

  // Filtered tasks for day view
  const filtered = todayTasks.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== "all" && t.category !== filterCat) return false;
    if (filterPri !== "all" && t.priority !== filterPri) return false;
    return true;
  });

  const highPriority = filtered.filter((t) => t.priority === "high" && !t.done);
  const others = filtered.filter((t) => !(t.priority === "high" && !t.done));

  // Week
  const getWeekDates = () => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const start = new Date(d);
    start.setDate(d.getDate() - day);
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(start);
      dd.setDate(start.getDate() + i);
      return dd.toISOString().slice(0, 10);
    });
  };

  // Calendar month
  const getCalDays = () => {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const days = [];
    for (let i = 0; i < first.getDay(); i++) {
      const d = new Date(year, month, -first.getDay() + i + 1);
      days.push({ date: d.toISOString().slice(0, 10), other: true });
    }
    for (let d = 1; d <= last.getDate(); d++) {
      days.push({ date: new Date(year, month, d).toISOString().slice(0, 10), other: false });
    }
    while (days.length % 7 !== 0) {
      const d = new Date(year, month + 1, days.length - last.getDate() - first.getDay() + 1);
      days.push({ date: d.toISOString().slice(0, 10), other: true });
    }
    return days;
  };

  // Streak
  const calcStreak = () => {
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      const dayTasks = tasks.filter((t) => t.date === key);
      if (dayTasks.length === 0 || !dayTasks.every((t) => t.done)) break;
      streak++;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  };

  // Weekly stats
  const weekStats = () => {
    const week = getWeekDates();
    return week.map((date) => {
      const dayTasks = tasks.filter((t) => t.date === date);
      return { date, done: dayTasks.filter((t) => t.done).length, total: dayTasks.length };
    });
  };

  // Drag & drop
  const handleDragStart = (e, id) => { dragRef.current = id; e.currentTarget.classList.add("dragging"); };
  const handleDragEnd = (e) => { e.currentTarget.classList.remove("dragging"); };
  const handleDragOver = (e, id) => { e.preventDefault(); };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (!dragRef.current || dragRef.current === targetId) return;
    const oldIndex = tasks.findIndex((t) => t.id === dragRef.current);
    const newIndex = tasks.findIndex((t) => t.id === targetId);
    const newTasks = [...tasks];
    const [moved] = newTasks.splice(oldIndex, 1);
    newTasks.splice(newIndex, 0, moved);
    save({ ...data, tasks: newTasks });
  };

  const requestNotif = async () => {
    const ok = await requestNotifPermission();
    setNotifGranted(ok);
    if (ok) showToast("Notifications activées !", "🔔");
  };

  const saveName = () => {
    if (!nameInput.trim()) return;
    save({ ...data, userName: nameInput.trim() });
    setNameModal(false);
  };

  const weekDates = getWeekDates();
  const ws = weekStats();
  const maxBar = Math.max(...ws.map((w) => w.total), 1);

  return (
    <>
      <style>{CSS}</style>
      <div className={dark ? "dark" : ""} style={{ minHeight: "100vh", background: "var(--bg)" }}>

        {/* Name modal */}
        {nameModal && (
          <div className="name-overlay">
            <div className="name-logo">✅</div>
            <div className="name-title">Bienvenue sur<br />TaskFlow</div>
            <div className="name-sub">Votre assistant productivité quotidien</div>
            <input
              className="form-input"
              style={{ maxWidth: 320, marginBottom: 12 }}
              placeholder="Votre prénom..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              autoFocus
            />
            <button className="btn btn-primary" style={{ maxWidth: 320, width: "100%" }} onClick={saveName}>
              Commencer →
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && <div className="toast">{toast.emoji} {toast.msg}</div>}

        <div className="app">
          {/* Sidebar (desktop) */}
          <aside className="sidebar">
            <div className="sidebar-logo">
              <span>✅</span> TaskFlow
            </div>
            <nav className="sidebar-nav">
              {["Jour", "Semaine", "Mois", "Stats"].map((v, i) => (
                <button key={v} className={`sidebar-item ${view === i ? "active" : ""}`} onClick={() => setView(i)}>
                  <Icon name={["calendar","chart","calendar","chart"][i]} size={16} />
                  {v}
                </button>
              ))}
            </nav>
            <div className="sidebar-cats">
              <div className="sidebar-label">Catégories</div>
              {CATEGORIES.map((c) => (
                <div key={c.id} className="cat-pill" onClick={() => setFilterCat(filterCat === c.id ? "all" : c.id)}>
                  <div className="cat-dot" style={{ background: c.color }} />
                  {c.emoji} {c.label}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)" }}>
                    {tasks.filter((t) => t.category === c.id && t.date === selectedDate).length}
                  </span>
                </div>
              ))}
            </div>
            <div className="sidebar-bottom">
              <div className="avatar">{data.userName?.[0]?.toUpperCase() || "?"}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{data.userName || "Utilisateur"}</div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>Productivité {progress}%</div>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="main">
            {/* Header */}
            <div className="header">
              <div className="header-top">
                <div>
                  <div className="header-greeting">
                    {greetings()}, {data.userName || "vous"} 👋
                  </div>
                  <div className="header-date">
                    {new Date(selectedDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                </div>
                <div className="header-actions">
                  <button className="icon-btn" onClick={() => setDark(!dark)} title="Thème">
                    <Icon name={dark ? "sun" : "moon"} size={16} />
                  </button>
                  <button className="icon-btn" onClick={requestNotif} title="Notifications">
                    <Icon name="bell" size={16} color={notifGranted ? "var(--accent)" : "currentColor"} />
                  </button>
                </div>
              </div>
              <div className="search-wrap">
                <span className="search-icon"><Icon name="search" size={16} /></span>
                <input
                  className="search-input"
                  placeholder="Rechercher une tâche..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Notif banner */}
            {!notifGranted && (
              <div className="notif-perm" onClick={requestNotif}>
                <span style={{ fontSize: 22 }}>🔔</span>
                <div>
                  <p>Activer les notifications</p>
                  <span>Recevez des rappels à l'heure exacte</span>
                </div>
              </div>
            )}

            {/* View tabs */}
            <div className="views-nav">
              {VIEWS.map((v, i) => (
                <button key={v} className={`view-tab ${view === i ? "active" : ""}`} onClick={() => setView(i)}>{v}</button>
              ))}
            </div>

            {/* ── DAY VIEW ── */}
            {view === 0 && (
              <>
                {/* Stats bar */}
                <div className="stats-bar">
                  <div className="stat-card accent">
                    <div className="stat-val">{todayTasks.length}</div>
                    <div className="stat-label">Total</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val" style={{ color: "var(--accent)" }}>{doneTasks.length}</div>
                    <div className="stat-label">Faites</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-val" style={{ color: "#ef4444" }}>{remaining}</div>
                    <div className="stat-label">Restantes</div>
                  </div>
                </div>

                {/* Progress */}
                <div className="progress-wrap">
                  <div className="progress-header">
                    <span style={{ fontFamily: "var(--font)", fontSize: 13 }}>Avancement du jour</span>
                    <span style={{ color: "var(--accent)", fontWeight: 700 }}>{progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Filters */}
                <div className="filter-row">
                  <button className={`filter-chip ${filterCat === "all" ? "active" : ""}`} onClick={() => setFilterCat("all")}>Tous</button>
                  {CATEGORIES.map((c) => (
                    <button key={c.id} className={`filter-chip ${filterCat === c.id ? "active" : ""}`} onClick={() => setFilterCat(c.id)}>
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>

                {/* High priority */}
                {highPriority.length > 0 && (
                  <div className="section">
                    <div className="section-title">
                      🔥 Prioritaires <span className="badge">{highPriority.length}</span>
                    </div>
                    <div className="task-list">
                      {highPriority.map((t) => <TaskCard key={t.id} task={t} onToggle={toggleDone} onEdit={(t) => { setEditTask(t); setModal("edit"); }} onDelete={deleteTask} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDrop={handleDrop} />)}
                    </div>
                  </div>
                )}

                {/* Others */}
                <div className="section">
                  <div className="section-title">
                    📋 Tâches du jour <span className="badge">{others.length}</span>
                  </div>
                  {others.length === 0 && todayTasks.length === 0 ? (
                    <div className="empty">
                      <div className="empty-icon">🌿</div>
                      <p>Aucune tâche pour aujourd'hui.<br />Profitez de votre journée ou ajoutez une tâche !</p>
                    </div>
                  ) : (
                    <div className="task-list">
                      {others.map((t) => <TaskCard key={t.id} task={t} onToggle={toggleDone} onEdit={(t) => { setEditTask(t); setModal("edit"); }} onDelete={deleteTask} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragOver={handleDragOver} onDrop={handleDrop} />)}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── WEEK VIEW ── */}
            {view === 1 && (
              <>
                <div style={{ padding: "0 20px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontFamily: "var(--font)", fontWeight: 700, fontSize: 15 }}>Semaine du {new Date(weekDates[0]).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="icon-btn" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d.toISOString().slice(0, 10)); }}><Icon name="chevLeft" size={14} /></button>
                    <button className="icon-btn" onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d.toISOString().slice(0, 10)); }}><Icon name="chevRight" size={14} /></button>
                  </div>
                </div>
                <div className="week-grid">
                  {weekDates.map((date, i) => {
                    const dayTasks = tasks.filter((t) => t.date === date);
                    const isToday = date === today();
                    return (
                      <div key={date} className={`week-col ${isToday ? "today" : ""}`} onClick={() => { setSelectedDate(date); setView(0); }} style={{ cursor: "pointer" }}>
                        <div className="week-col-header">
                          <div className="week-col-day">{DAYS_FR[i]}</div>
                          <div className="week-col-num">{new Date(date).getDate()}</div>
                        </div>
                        {dayTasks.slice(0, 3).map((t) => {
                          const cat = getCat(t.category);
                          return <div key={t.id} className="week-task" style={{ background: cat.color, opacity: t.done ? 0.5 : 1 }}>{t.title}</div>;
                        })}
                        {dayTasks.length > 3 && <div style={{ fontSize: 10, color: "var(--text3)", textAlign: "center" }}>+{dayTasks.length - 3}</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ── MONTH VIEW ── */}
            {view === 2 && (
              <div className="calendar">
                <div className="cal-header">
                  <button className="icon-btn" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1))}><Icon name="chevLeft" size={14} /></button>
                  <div className="cal-month">{MONTHS_FR[calDate.getMonth()]} {calDate.getFullYear()}</div>
                  <button className="icon-btn" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1))}><Icon name="chevRight" size={14} /></button>
                </div>
                <div className="cal-grid">
                  {DAYS_FR.map((d) => <div key={d} className="cal-day-label">{d}</div>)}
                  {getCalDays().map(({ date, other }) => {
                    const hasTasks = tasks.some((t) => t.date === date);
                    const isToday = date === today();
                    const isSelected = date === selectedDate;
                    return (
                      <div key={date} className={`cal-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${hasTasks ? "has-tasks" : ""} ${other ? "other-month" : ""}`}
                        onClick={() => { setSelectedDate(date); setView(0); }}>
                        {new Date(date).getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── STATS VIEW ── */}
            {view === 3 && (
              <>
                <div className="stats-grid">
                  {[
                    { val: tasks.filter((t) => t.done).length, label: "Tâches complétées" },
                    { val: tasks.length, label: "Tâches totales" },
                    { val: tasks.length ? Math.round(tasks.filter((t) => t.done).length / tasks.length * 100) + "%" : "0%", label: "Taux de réussite" },
                    { val: calcStreak(), label: "Jours consécutifs 🔥" },
                  ].map((s, i) => (
                    <div key={i} className="stat-big">
                      <div className="stat-big-val">{s.val}</div>
                      <div className="stat-big-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="streak-card">
                  <div>
                    <div className="streak-num">{calcStreak()}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>🔥 Série en cours</div>
                    <div className="streak-label">jours consécutifs accomplis</div>
                  </div>
                </div>

                <div className="bar-chart">
                  <div className="bar-chart-title">Tâches cette semaine</div>
                  <div className="bars">
                    {ws.map((w, i) => (
                      <div key={i} className="bar-col">
                        <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                          <div className="bar" style={{ height: `${(w.total / maxBar) * 100}%`, opacity: w.done === w.total && w.total > 0 ? 1 : 0.4 }} title={`${w.done}/${w.total}`} />
                        </div>
                        <div className="bar-label">{DAYS_FR[i]}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Category breakdown */}
                <div className="bar-chart" style={{ marginTop: 24 }}>
                  <div className="bar-chart-title">Par catégorie</div>
                  {CATEGORIES.map((c) => {
                    const count = tasks.filter((t) => t.category === c.id).length;
                    const done = tasks.filter((t) => t.category === c.id && t.done).length;
                    const pct = count ? Math.round(done / count * 100) : 0;
                    return (
                      <div key={c.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, fontWeight: 600 }}>
                          <span>{c.emoji} {c.label}</span>
                          <span style={{ color: "var(--text2)" }}>{done}/{count}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${pct}%`, background: c.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </main>
        </div>

        {/* FAB */}
        <button className="fab" onClick={() => setModal("add")}>
          <Icon name="plus" size={24} color="white" />
        </button>

        {/* Bottom nav */}
        <nav className="bottom-nav">
          {[["calendar","Jour"],["chart","Semaine"],["calendar","Mois"],["star","Stats"]].map(([icon, label], i) => (
            <button key={i} className={`nav-item ${view === i ? "active" : ""}`} onClick={() => setView(i)}>
              <Icon name={icon} size={20} />
              {label}
            </button>
          ))}
        </nav>

        {/* Add/Edit Modal */}
        {modal && (
          <TaskModal
            task={editTask}
            defaultDate={selectedDate}
            onClose={() => { setModal(null); setEditTask(null); }}
            onSave={(t) => { modal === "add" ? addTask(t) : updateTask(t); setModal(null); setEditTask(null); }}
          />
        )}
      </div>
    </>
  );
}

// ─── TaskCard ────────────────────────────────────────────────────────────────
function TaskCard({ task, onToggle, onEdit, onDelete, onDragStart, onDragEnd, onDragOver, onDrop }) {
  const cat = getCat(task.category);
  const pri = getPri(task.priority);
  return (
    <div
      className={`task-card ${task.done ? "done" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, task.id)}
      onDrop={(e) => onDrop(e, task.id)}
    >
      <div className="priority-stripe" style={{ background: pri.color }} />
      <div className="task-card-left">
        <button className={`check-btn ${task.done ? "checked" : ""}`} onClick={() => onToggle(task.id)}>
          {task.done && <Icon name="check" size={12} color="white" />}
        </button>
        <Icon name="drag" size={14} color="var(--text3)" />
      </div>
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        <div className="task-meta">
          {task.startTime && (
            <span className="task-time">
              <Icon name="clock" size={11} />
              {task.startTime}{task.endTime ? ` - ${task.endTime}` : ""}
            </span>
          )}
          <span className="pri-badge" style={{ background: pri.bg, color: pri.color }}>{pri.label}</span>
          <span className="cat-badge">{cat.emoji} {cat.label}</span>
        </div>
      </div>
      <div className="task-actions">
        <button className="task-action-btn" onClick={() => onEdit(task)}><Icon name="edit" size={13} /></button>
        <button className="task-action-btn danger" onClick={() => onDelete(task.id)}><Icon name="trash" size={13} /></button>
      </div>
    </div>
  );
}

// ─── TaskModal ───────────────────────────────────────────────────────────────
function TaskModal({ task, defaultDate, onClose, onSave }) {
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    category: task?.category || "work",
    priority: task?.priority || "medium",
    date: task?.date || defaultDate,
    startTime: task?.startTime || "",
    endTime: task?.endTime || "",
    reminder: task?.reminder ?? 15,
    repeat: task?.repeat || "none",
    ...(task ? { id: task.id, done: task.done, createdAt: task.createdAt } : {}),
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const valid = form.title.trim().length > 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-handle" />
        <div className="modal-title">{task ? "Modifier la tâche" : "Nouvelle tâche"}</div>

        <div className="form-group">
          <label className="form-label">Titre *</label>
          <input className="form-input" placeholder="Que voulez-vous faire ?" value={form.title} onChange={(e) => set("title", e.target.value)} autoFocus />
        </div>

        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-textarea" placeholder="Détails supplémentaires..." value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>

        <div className="form-group">
          <label className="form-label">Catégorie</label>
          <div className="pills">
            {CATEGORIES.map((c) => (
              <button key={c.id} className={`pill ${form.category === c.id ? "selected" : ""}`} onClick={() => set("category", c.id)}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Priorité</label>
          <div className="pills">
            {PRIORITIES.map((p) => (
              <button key={p.id} className={`pill ${form.priority === p.id ? "selected" : ""}`} onClick={() => set("priority", p.id)}
                style={form.priority === p.id ? { borderColor: p.color, color: p.color, background: p.bg } : {}}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Répétition</label>
            <select className="form-select" value={form.repeat} onChange={(e) => set("repeat", e.target.value)}>
              <option value="none">Aucune</option>
              <option value="daily">Quotidienne</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuelle</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Heure début</label>
            <input className="form-input" type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Heure fin</label>
            <input className="form-input" type="time" value={form.endTime} onChange={(e) => set("endTime", e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Rappel</label>
          <select className="form-select" value={form.reminder} onChange={(e) => set("reminder", Number(e.target.value))}>
            {REMINDER_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>

        <div className="btn-row">
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={() => valid && onSave(form)} style={{ opacity: valid ? 1 : 0.5 }}>
            {task ? "Modifier" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import QRScanner from "@/components/QRScanner";
import type { ElementType, FormEvent, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight,
  Bell, CalendarClock, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardCheck, ClipboardList, CloudOff, Download, FilePlus2, FileText,
  Filter, HeartPulse, Home, Info, Leaf, LogOut, MapPin, MoreHorizontal,
  PawPrint, Plus, RefreshCcw, Search, ShieldCheck, Sprout, Stethoscope,
  Syringe, Tractor, TrendingUp, UserRound, Wifi, X, Save, CircleHelp,
  CheckCheck, BookOpen, CalendarCheck, RotateCcw, ScanSearch, QrCode, ScanLine,
  Mic, Camera, Image as ImageIcon, FileSpreadsheet, Printer, Settings2,
  ClipboardList as ClipboardClock, MapPinned, CloudUpload, Shield, FileDown, BellRing, Pencil,
  LocateFixed, RefreshCw, SlidersHorizontal,
} from "lucide-react";
import { createSeedData } from "@/lib/seed";
import {
  createEmptyWorkspace, firebaseConfigured, getAuthenticatedRole, getFirebaseDisplayName, initializeWorkspaceIfEmpty,
  completeGoogleRedirectFirebase, loadFirebaseWorkspace, registerFirebase, resetFirebasePassword, saveFirebaseWorkspace,
  signInFirebase, signInWithGoogleFirebase, signOutFirebase, subscribeAuth, subscribeWorkspace, updateFirebaseProfile,
} from "@/lib/firebase";
import type { User as FirebaseUser } from "firebase/auth";
import { clearDemoData, loadDemoData, saveDemoData } from "@/lib/storage";
import type {
  Animal, AppData, CaseStatus, CropRotationPlan, DemoUser,
  HealthReport, Priority, Role, Severity, VeterinaryCase, Locale, Farm, Vaccination
} from "@/lib/types";
import { audit, applyQueuedReports, downloadCsv, processRemindersAndEscalations } from "@/lib/enhancements";
import { createReportInData, queueReport, updateCaseInData, type ReportInput } from "@/lib/workflow";
import { reportCoordinates } from "@/lib/geo";
import { translate } from "@/lib/translations";

const LeafletSurveillanceMap = dynamic(() => import("@/components/LeafletSurveillanceMap"), { ssr: false, loading: () => <div className="leaflet-loading">Loading area map…</div> });

interface PashuSpeechRecognitionAlternative {
  readonly transcript: string;
}
interface PashuSpeechRecognitionResult {
  readonly [index: number]: PashuSpeechRecognitionAlternative;
}
interface PashuSpeechRecognitionResultList {
  readonly [index: number]: PashuSpeechRecognitionResult;
}
interface PashuSpeechRecognitionResultEvent extends Event {
  readonly results: PashuSpeechRecognitionResultList;
}
interface PashuSpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: PashuSpeechRecognitionResultEvent) => void) | null;
  start(): void;
}
type PashuSpeechRecognitionConstructor = new () => PashuSpeechRecognitionInstance;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const pageMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.18, ease: "easeOut" as const }
};

const symptomsList = ["High temperature", "Loss of appetite", "Nasal discharge", "Coughing", "Diarrhoea", "Limping", "Skin irritation", "Difficulty breathing", "Unusual behaviour", "Swelling"];
const severityList: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const dateLabel = (value?: string) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";
const shortDate = (value?: string) => value ? new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";
const titleCase = (value: string) => value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (name: string) => name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();

function GoogleMark() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.9c-.58 2.96-2.27 5.47-4.78 7.16l7.73 6C44.36 37.96 46.98 31.9 46.98 24.55Z" />
    <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.2A23.9 23.9 0 0 0 0 24c0 3.88.93 7.56 2.56 10.78l7.97-6.19Z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.82l-7.73-6c-2.14 1.44-4.88 2.3-8.17 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
  </svg>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand-lockup"><div className="brand-mark"><HeartPulse size={compact ? 18 : 21} strokeWidth={2.2} /></div>{!compact && <div><strong>PashuCare</strong><span>Livestock health, connected</span></div>}</div>;
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "green" }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function PriorityPill({ priority }: { priority: Priority }) {
  return <Pill tone={priority === "PRIORITY" ? "warning" : "neutral"}>{priority === "PRIORITY" ? "Priority" : "Normal"}</Pill>;
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "CLOSED" || status === "COMPLETED" || status === "REVIEWED" || status === "HEALTHY" ? "success" : status === "OPEN" || status === "OVERDUE" || status === "CRITICAL" ? "danger" : status === "IN_PROGRESS" || status === "DUE" || status === "NEEDS_REVIEW" || status === "UNDER OBSERVATION" ? "warning" : "info";
  return <Pill tone={tone}>{titleCase(status)}</Pill>;
}

function StatCard({ label, value, note, icon: Icon, tone = "green", trend }: {
  label: string; value: string | number; note: string; icon: ElementType; tone?: string; trend?: string;
}) {
  return <motion.div className="stat-card" whileHover={{ y: -2 }} transition={{ duration: 0.16 }}>
    <div className={`stat-icon stat-${tone}`}><Icon size={19} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
    {trend && <span className="stat-trend"><TrendingUp size={13} />{trend}</span>}
  </motion.div>;
}

function SectionHeading({ eyebrow, title, subtitle, action }: { eyebrow?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>;
}

function EmptyState({ icon: Icon = ClipboardList, title, message, action }: { icon?: ElementType; title: string; message: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={23} /></div><strong>{title}</strong><p>{message}</p>{action}</div>;
}

function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <motion.div className={`modal ${wide ? "modal-wide" : ""}`} initial={{ opacity: 0, y: 14, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.985 }} transition={{ duration: 0.2 }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-header"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
      {children}
    </motion.div>
  </motion.div>;
}

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  return <div className="login-shell">
    <div className="login-visual">
      <div className="login-brand"><Brand /></div>
      <div className="login-hero-copy"><Pill tone="green">Livestock health, connected</Pill><h1>Better reporting.<br /><em>Earlier response.</em></h1><p>A connected workspace for livestock health reports, veterinary review and follow-up care.</p></div>
      <div className="login-feature-grid"><div><ShieldCheck size={18} /><strong>Role-specific workspaces</strong><span>Farmer and veterinary workflows</span></div><div><Activity size={18} /><strong>Early surveillance</strong><span>Transparent preliminary checks</span></div><div><HeartPulse size={18} /><strong>Connected care</strong><span>Reports, cases and follow-ups</span></div></div>
      <div className="login-footer">PashuCare · Local preview</div>
    </div>
    <div className="login-panel"><div className="login-panel-inner"><div className="mobile-login-brand"><Brand /></div><div className="eyebrow">LOCAL PREVIEW</div><h2>Explore PashuCare</h2><p className="muted">Firebase is not configured in this build environment. You can preview the synthetic sample workspace locally.</p>
      <button className="role-choice" onClick={() => onLogin("FARMER")}><div className="role-choice-icon farmer-icon"><Tractor size={21} /></div><div><strong>Continue as Farmer</strong><span>Manage livestock, submit health reports and view updates.</span></div><ChevronRight size={18} /></button>
      <button className="role-choice" onClick={() => onLogin("VETERINARIAN")}><div className="role-choice-icon vet-icon"><Stethoscope size={21} /></div><div><strong>Continue as Veterinarian</strong><span>Review cases, assess reports and manage follow-ups.</span></div><ChevronRight size={18} /></button>
      <div className="demo-note"><Info size={16} /><span><strong>Local preview mode</strong><br />Synthetic sample records are stored on this device only. Configure Firebase to enable real accounts, secure cloud data and cross-device sync.</span></div>
      <div className="login-meta"><span>Mobile and desktop</span><span>Version 2.1 · Google + Firebase</span></div>
    </div></div>
  </div>;
}

function friendlyFirebaseAuthError(value: unknown): string {
  const code = typeof value === "object" && value && "code" in value ? String((value as { code: unknown }).code) : "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Email or password is incorrect.";
  if (code.includes("email-already-in-use")) return "An account already exists for this email. Sign in instead.";
  if (code.includes("weak-password")) return "Choose a stronger password (at least 8 characters).";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("too-many-requests")) return "Too many attempts. Wait a little and try again.";
  if (code.includes("network-request-failed")) return "Network unavailable. Check your connection and try again.";
  if (code.includes("unauthorized-domain")) return "This deployment domain is not authorized in Firebase Authentication. Add it under Authentication → Settings → Authorized domains.";
  if (code.includes("operation-not-allowed")) return "Google sign-in is not enabled yet. Enable Google under Firebase Authentication → Sign-in method.";
  if (code.includes("account-exists-with-different-credential")) return "An account already exists with this email using another sign-in method. Sign in with that method first.";
  if (code.includes("web-storage-unsupported")) return "This browser blocks the storage needed for secure sign-in. Open PashuCare in your regular browser.";
  return value instanceof Error ? value.message : "Something went wrong. Please try again.";
}

function FirebaseAuthScreen({ initialError = "" }: { initialError?: string }) {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);
  useEffect(() => { if (initialError) setError(initialError); }, [initialError]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(""); setMessage("");
    if (!email.trim()) { setError("Enter your email address."); return; }
    if (mode !== "reset" && !password) { setError("Enter your password."); return; }
    if (mode === "signup" && (!name.trim() || password.length < 8)) { setError("Enter your name and choose a password with at least 8 characters."); return; }
    setBusy(true);
    try {
      if (mode === "signup") await registerFirebase(email, password, name);
      else if (mode === "reset") { await resetFirebasePassword(email); setMessage("Password reset email sent. Check your inbox."); }
      else await signInFirebase(email, password);
    } catch (cause) { setError(friendlyFirebaseAuthError(cause)); }
    finally { setBusy(false); }
  };
  const continueWithGoogle = async () => {
    setError(""); setMessage(""); setBusy(true);
    try { await signInWithGoogleFirebase(); }
    catch (cause) { setError(friendlyFirebaseAuthError(cause)); setBusy(false); }
  };
  return <div className="login-shell firebase-auth-shell">
    <div className="login-visual"><div className="login-brand"><Brand /></div><div className="login-hero-copy"><Pill tone="green">Secure livestock care workspace</Pill><h1>Better reporting.<br /><em>Earlier response.</em></h1><p>Manage livestock health records with account-based access, cloud persistence and offline-first sync.</p></div><div className="login-feature-grid"><div><ShieldCheck size={18}/><strong>Firebase Authentication</strong><span>Google and email sign-in</span></div><div><Activity size={18}/><strong>Cloud Firestore</strong><span>Per-account data and live sync</span></div><div><HeartPulse size={18}/><strong>Offline-first PWA</strong><span>Local cache and reconnect sync</span></div></div><div className="login-footer">PashuCare · Secure account access</div></div>
    <div className="login-panel"><div className="login-panel-inner"><div className="mobile-login-brand"><Brand /></div><div className="eyebrow">FIREBASE ACCOUNT</div><h2>{mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back"}</h2><p className="muted">{mode === "signup" ? "Create a Farmer account. Veterinarian access is provisioned by an administrator." : mode === "reset" ? "We’ll email you a secure password reset link." : "Sign in to access your saved workspace across devices."}</p>
      {mode !== "reset" && <>
        <button className="google-auth-button" type="button" onClick={continueWithGoogle} disabled={busy}>
          <GoogleMark /><span>{busy ? "Connecting securely…" : "Continue with Google"}</span>
        </button>
        <div className="auth-divider"><span>or continue with email</span></div>
      </>}
      <form className="firebase-auth-form" onSubmit={submit}>
        {mode === "signup" && <label className="form-field"><span>Full name</span><input autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required /></label>}
        <label className="form-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        {mode !== "reset" && <label className="form-field"><span>Password</span><input type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Your password"} minLength={mode === "signup" ? 8 : 1} required /></label>}
        {error && <div className="form-error" role="alert">{error}</div>}{message && <div className="auth-success" role="status">{message}</div>}
        <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : mode === "reset" ? "Send reset email" : "Sign in"}</button>
      </form>
      <div className="auth-mode-links">{mode === "signin" && <button type="button" onClick={() => { setMode("reset"); setError(""); setMessage(""); }}>Forgot password?</button>}{mode !== "signin" && <button type="button" onClick={() => { setMode("signin"); setError(""); setMessage(""); }}>Back to sign in</button>}{mode !== "signup" && <button type="button" onClick={() => { setMode("signup"); setError(""); setMessage(""); }}>Create account</button>}</div>
      <div className="auth-security-note"><ShieldCheck size={16}/><span>Google sign-in is handled by Firebase Authentication. Email passwords are never stored in PashuCare records. Your workspace records are stored in Firestore under your account.</span></div>
    </div></div>
  </div>;
}

function FirebaseSetupRequiredScreen() {
  return <div className="auth-loading firebase-setup-required">
    <div className="brand-mark"><HeartPulse size={22}/></div>
    <strong>Firebase setup required</strong>
    <span>Firebase is not configured. Enable the presentation preview only with NEXT_PUBLIC_PASHUCARE_DEMO_MODE=true.</span>
    <div className="setup-required-card"><b>Configure these deployment variables</b><code>NEXT_PUBLIC_FIREBASE_API_KEY</code><code>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</code><code>NEXT_PUBLIC_FIREBASE_PROJECT_ID</code><code>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</code><code>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</code><code>NEXT_PUBLIC_FIREBASE_APP_ID</code><small>For a demo without Firebase, set NEXT_PUBLIC_PASHUCARE_DEMO_MODE=true in Vercel and redeploy. This uses fictional preview data stored only in the browser. For real accounts, add all six Firebase values, enable Google and Email/Password, and keep demo mode false.</small></div>
  </div>;
}

function SidebarFallbackIcon({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M8 12h8M12 8v8" /></svg>;
}

function AppSidebar({ role, page, onNavigate, onLogout, canSwitchRole }: { role: Role; page: string; onNavigate: (page: string) => void; onLogout: () => void; canSwitchRole: boolean }) {
  const farmerItems = [
    { id: "overview", label: "Overview", icon: Home }, { id: "farms", label: "My farms", icon: MapPinned }, { id: "livestock", label: "My livestock", icon: PawPrint },
    { id: "health-records", label: "Health records", icon: ClipboardCheck }, { id: "reports", label: "Health reports", icon: FileText }, { id: "vaccinations", label: "Vaccinations", icon: Syringe },
    { id: "alerts", label: "Alerts & updates", icon: Bell }, { id: "identities", label: "Animal ID & QR", icon: QrCode }, { id: "offline", label: "Offline queue", icon: CloudUpload }, { id: "crop", label: "Crop rotation", icon: Sprout }, { id: "backup", label: "Backup & restore", icon: FileDown }, { id: "profile", label: "My profile", icon: UserRound }
  ];
  const vetItems = [
    { id: "overview", label: "Overview", icon: Home }, { id: "cases", label: "Case queue", icon: ClipboardList },
    { id: "health-records", label: "Health records", icon: ClipboardCheck }, { id: "surveillance", label: "Surveillance", icon: ScanSearch }, { id: "vaccinations", label: "Vaccination records", icon: Syringe },
    { id: "followups", label: "Follow-ups", icon: CalendarClock }, { id: "alerts", label: "Notifications", icon: Bell }, { id: "identities", label: "Animal lookup & QR", icon: QrCode }, { id: "analytics", label: "Analytics & export", icon: Activity }, { id: "audit", label: "Audit history", icon: ClipboardClock }, { id: "settings", label: "Rules & escalation", icon: Settings2 }, { id: "backup", label: "Backup & restore", icon: FileDown }, { id: "profile", label: "My profile", icon: UserRound }
  ];
  const items = role === "FARMER" ? farmerItems : vetItems;
  return <aside className="sidebar"><div className="sidebar-brand"><Brand /></div><div className="workspace-label">WORKSPACE</div><nav className="side-nav">{items.map(({ id, label, icon: Icon }) => { const SafeIcon = Icon || SidebarFallbackIcon; return <button key={id} className={`nav-link ${page === id ? "active" : ""}`} onClick={() => onNavigate(id)}><SafeIcon size={18} strokeWidth={1.9} /><span>{label}</span>{id === "alerts" && <i className="nav-dot" />}</button>; })}</nav><div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><CircleHelp size={17} /></div><strong>Need a hand?</strong><span>Quick guides for using PashuCare.</span><button onClick={() => onNavigate("guide")}>View quick guide <ArrowRight size={13} /></button></div><button className="nav-link logout-link" onClick={onLogout}><LogOut size={17} /><span>{canSwitchRole ? "Exit demo" : "Sign out"}</span></button><div className="sidebar-version">PashuCare <span>{canSwitchRole ? "Local demo" : "Firebase workspace"}</span></div></div></aside>;
}

function AppHeader({ user, unread, online, canInstall, onInstall, onNavigate, onSwitchRole, onLogout, query, onSearch, locale, onLocaleChange, pendingCount, canSwitchRole, syncState, onRetrySync }: {
  user: DemoUser; unread: number; online: boolean; canInstall: boolean; onInstall: () => void; onNavigate: (page: string) => void; onSwitchRole: (role: Role) => void; onLogout: () => void; query: string; onSearch: (value: string) => void; locale: Locale; onLocaleChange: (locale: Locale) => void; pendingCount: number; canSwitchRole: boolean; syncState: "local" | "syncing" | "synced" | "offline" | "error"; onRetrySync: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return <header className="topbar"><div className="topbar-left"><div className="mobile-brand"><Brand compact /></div><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{user.role === "FARMER" ? "Farmer portal" : "Veterinarian portal"}</strong></div></div><div className="topbar-actions"><label className="global-search"><Search size={15} /><input value={query} onChange={(e) => onSearch(e.target.value)} placeholder="Search this view" aria-label="Search current view" /></label><select className="language-select" aria-label="Language" value={locale} onChange={(e) => onLocaleChange(e.target.value as Locale)}><option value="en">EN</option><option value="mr">मराठी</option><option value="hi">हिन्दी</option></select><div className={`connection-status ${online ? "is-online" : "is-offline"}`}>{online ? <Wifi size={14} /> : <CloudOff size={14} />}<span>{online ? "Online" : "Offline"}{pendingCount > 0 ? ` · ${pendingCount} queued` : ""}</span></div>{syncState !== "local" && <div className={`cloud-sync-status sync-${syncState}`} title={syncState === "synced" ? "Cloud data saved" : syncState === "syncing" ? "Syncing changes" : syncState === "offline" ? "Changes will sync after reconnecting" : "Cloud sync needs attention"}>{syncState === "syncing" ? <RefreshCw size={13} className="spin-icon" /> : syncState === "error" ? <AlertCircle size={13} /> : syncState === "offline" ? <CloudOff size={13} /> : <CheckCircle2 size={13} />}<span>{syncState === "syncing" ? "Syncing" : syncState === "error" ? "Sync issue" : syncState === "offline" ? "Queued" : "Synced"}</span></div>}{syncState !== "local" && <button type="button" className="cloud-sync-retry" onClick={onRetrySync} title="Sync now" aria-label="Sync now"><RefreshCw size={13}/></button>}{canInstall && <button className="install-button" onClick={onInstall}><Download size={15} /> Install app</button>}<button className="icon-button notification-button" onClick={() => onNavigate("alerts")} aria-label="Notifications"><Bell size={18} />{unread > 0 && <i className="notification-dot" />}</button><div className="role-menu-wrap"><button className="profile-trigger" onClick={() => setMenuOpen(!menuOpen)}><span className="avatar">{initials(user.name)}</span><span className="profile-name"><strong>{user.name}</strong><small>{titleCase(user.role)}</small></span><ChevronDown size={15} /></button>{menuOpen && <div className="role-dropdown">{canSwitchRole && <><div className="dropdown-caption">SWITCH DEMO ROLE</div><button onClick={() => { onSwitchRole("FARMER"); setMenuOpen(false); }}><Tractor size={16} /> Farmer workspace {user.role === "FARMER" && <Check size={14} />}</button><button onClick={() => { onSwitchRole("VETERINARIAN"); setMenuOpen(false); }}><Stethoscope size={16} /> Veterinarian workspace {user.role === "VETERINARIAN" && <Check size={14} />}</button><div className="dropdown-divider" /></>}<button onClick={() => { onLogout(); setMenuOpen(false); }}><LogOut size={15} /> {canSwitchRole ? "Exit demo" : "Sign out"}</button></div>}</div></div></header>;
}

function OverviewPage({ role, data, user, onNavigate, onNewReport, onOpenCase }: {
  role: Role; data: AppData; user: DemoUser; onNavigate: (page: string) => void; onNewReport: () => void; onOpenCase: (id: string) => void;
}) {
  const myAnimals = role === "FARMER" ? data.animals.filter((a) => a.farmerId === user.id) : data.animals;
  const myReports = role === "FARMER" ? data.reports.filter((r) => r.farmerId === user.id) : data.reports;
  const myCases = role === "FARMER" ? data.cases.filter((c) => c.farmerId === user.id) : data.cases;
  const pendingVaccines = data.vaccinations.filter((v) => v.status !== "COMPLETED" && (role === "VETERINARIAN" || myAnimals.some((a) => a.id === v.animalId)));
  const openCases = myCases.filter((c) => c.status !== "CLOSED");
  const unread = data.alerts.filter((a) => a.recipientId === user.id && !a.readAt).length;
  const priorityCases = data.cases.filter((c) => c.priority === "PRIORITY" && c.status !== "CLOSED");
  const date = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const reportsByWeek = [3, 5, 2, 6, 4, 7, 5];

  return <div className="page-stack"><SectionHeading eyebrow={date.toUpperCase()} title={role === "FARMER" ? `Good day, ${user.name.split(" ")[0]}` : `Welcome back, ${user.name.split(" ")[0]}`} subtitle={role === "FARMER" ? "Here’s what’s happening with your livestock today." : "Here is your veterinary workload and surveillance overview."} action={role === "FARMER" ? <button className="primary-button" onClick={onNewReport}><Plus size={17} /> New health report</button> : <button className="secondary-button" onClick={() => onNavigate("cases")}>View case queue <ArrowRight size={16} /></button>} />
    <div className="stats-grid">{role === "FARMER" ? <>
      <StatCard label="My livestock" value={myAnimals.length} note={`${data.farms.filter(f => f.farmerId === user.id).length} registered farms`} icon={PawPrint} tone="green" />
      <StatCard label="Active reports" value={myReports.filter((r) => r.status !== "ARCHIVED").length} note="Reports in the system" icon={FileText} tone="blue" />
      <StatCard label="Vaccinations due" value={pendingVaccines.length} note="Upcoming or overdue" icon={Syringe} tone="amber" />
      <StatCard label="Unread alerts" value={unread} note="Updates to review" icon={Bell} tone="rose" />
    </> : <>
      <StatCard label="Open cases" value={openCases.length} note="Awaiting action" icon={ClipboardList} tone="green" />
      <StatCard label="Priority cases" value={priorityCases.length} note="Needs earlier review" icon={AlertTriangle} tone="amber" />
      <StatCard label="Follow-ups due" value={data.cases.filter((c) => c.followUpRequired && c.status !== "CLOSED").length} note="Scheduled follow-ups" icon={CalendarClock} tone="blue" />
      <StatCard label="Possible clusters" value={data.clusters.filter((c) => c.status === "NEEDS_REVIEW").length} note="For veterinary review" icon={ScanSearch} tone="rose" />
    </>}</div>
    {role === "FARMER" ? <div className="dashboard-grid"><section className="panel panel-main"><div className="panel-heading"><div><h2>Recent health reports</h2><p>Track the status of your submitted reports.</p></div><button className="text-button" onClick={() => onNavigate("reports")}>View all <ArrowRight size={14} /></button></div><div className="report-list">{myReports.slice(0, 4).map((r) => <ReportListItem key={r.id} report={r} data={data} onClick={() => onNavigate("reports")} />)}{myReports.length === 0 && <EmptyState title="No reports yet" message="Submit a health report when you notice a concern." action={<button className="primary-button small-button" onClick={onNewReport}>Create a report</button>} />}</div></section><section className="panel side-panel"><div className="panel-heading"><div><h2>Vaccination reminders</h2><p>Keep routine records up to date.</p></div><button className="icon-button small" onClick={() => onNavigate("vaccinations")}><ArrowUpRight size={16} /></button></div><div className="reminder-list">{pendingVaccines.slice(0, 3).map((v) => { const animal = data.animals.find((a) => a.id === v.animalId); return <div className="reminder-item" key={v.id}><div className="reminder-icon"><Syringe size={17} /></div><div className="reminder-copy"><strong>{v.vaccineName}</strong><span>{animal?.name || "Animal"} · {shortDate(v.dueOn)}</span></div><StatusPill status={v.status} /></div>; })}{pendingVaccines.length === 0 && <p className="muted small">No vaccination reminders.</p>}</div><div className="panel-divider" /><div className="panel-heading compact-heading"><div><h2>Case updates</h2><p>Latest veterinary activity.</p></div></div><div className="mini-case-list">{myCases.slice(0, 2).map((c) => <button className="mini-case" key={c.id} onClick={() => onNavigate("reports")}><span className="mini-case-dot" /><span><strong>{c.id}</strong><small>{titleCase(c.status)}</small></span><ChevronRight size={15} /></button>)}</div></section></div> : <div className="dashboard-grid"><section className="panel panel-main"><div className="panel-heading"><div><h2>Priority case queue</h2><p>Cases routed for earlier veterinary review.</p></div><button className="text-button" onClick={() => onNavigate("cases")}>Open queue <ArrowRight size={14} /></button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Case / Animal</th><th>Reported concern</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>{priorityCases.slice(0, 4).map((c) => { const r = data.reports.find((x) => x.id === c.reportId); const a = data.animals.find((x) => x.id === c.animalId); return <tr key={c.id} onClick={() => onOpenCase(c.id)} className="clickable-row"><td><strong>{c.id}</strong><small>{a?.name} · {a?.tagId}</small></td><td>{r?.symptoms.slice(0, 2).join(", ") || "Health report"}</td><td><PriorityPill priority={c.priority} /></td><td><StatusPill status={c.status} /></td><td><ChevronRight size={15} /></td></tr>; })}</tbody></table>{priorityCases.length === 0 && <EmptyState title="No priority cases" message="New cases flagged by the demo rules will appear here." />}</div></section><section className="panel side-panel"><div className="panel-heading"><div><h2>Surveillance snapshot</h2><p>Recent reports by area.</p></div><button className="icon-button small" onClick={() => onNavigate("surveillance")}><ArrowUpRight size={16} /></button></div><div className="surveillance-preview"><div className="preview-map"><span className="map-grid-line line-a" /><span className="map-grid-line line-b" /><span className="map-road road-a" /><span className="map-road road-b" /><i className="map-pin pin-a" /><i className="map-pin pin-b" /><i className="map-pin pin-c" /></div><div className="map-legend"><span><i className="legend-dot amber-dot" />Priority reports</span><span><i className="legend-dot green-dot" />Normal reports</span></div></div><div className="cluster-callout"><div className="cluster-callout-icon"><ScanSearch size={17} /></div><div><strong>{data.clusters.filter((c) => c.status === "NEEDS_REVIEW").length} possible cluster(s)</strong><span>Preliminary grouping · review evidence</span></div><button className="text-button" onClick={() => onNavigate("surveillance")}>View</button></div></section></div>}
    <section className="panel activity-panel"><div className="panel-heading"><div><h2>{role === "FARMER" ? "Your livestock overview" : "Recent activity"}</h2><p>{role === "FARMER" ? "A quick look at your registered animals." : "Recent health reports received by the platform."}</p></div><button className="text-button" onClick={() => onNavigate(role === "FARMER" ? "livestock" : "reports")}>View all <ArrowRight size={14} /></button></div>{role === "FARMER" ? <div className="animal-mini-grid">{myAnimals.slice(0, 4).map((a) => <AnimalMiniCard key={a.id} animal={a} />)}</div> : <div className="activity-chart-wrap"><div className="chart-summary"><strong>{data.reports.length}</strong><span>Reports in the demo dataset</span></div><div className="bar-chart">{reportsByWeek.map((v, i) => <div className="bar-column" key={i}><div className="bar-track"><i style={{ height: `${(v / 8) * 100}%` }} /></div><span>{["M", "T", "W", "T", "F", "S", "S"][i]}</span></div>)}</div><div className="chart-caption"><span><i className="legend-dot green-dot" />Illustrative weekly reporting activity</span><span>Sample data</span></div></div>}</section>
    <div className="safety-footnote"><Info size={15} /><span>Risk and possible cluster outputs are preliminary decision-support information. They are not confirmed diagnoses or official outbreak declarations.</span></div>
  </div>;
}

function ReportListItem({ report, data, onClick }: { report: HealthReport; data: AppData; onClick: () => void }) {
  const animal = data.animals.find((a) => a.id === report.animalId);
  return <button className="report-list-item" onClick={onClick}><div className="report-animal-avatar"><PawPrint size={17} /></div><div className="report-item-main"><strong>{report.id} <span>· {animal?.name}</span></strong><small>{report.symptoms.slice(0, 2).join(", ")} · {shortDate(report.submittedAt)}</small></div><PriorityPill priority={report.assessment.priority} /><ChevronRight size={15} className="item-chevron" /></button>;
}

function AnimalMiniCard({ animal }: { animal: Animal }) {
  return <div className="animal-mini-card"><div className="animal-thumb"><PawPrint size={20} /></div><div><strong>{animal.name}</strong><span>{animal.tagId} · {animal.species}</span><StatusPill status={animal.healthStatus.toUpperCase()} /></div></div>;
}

function LivestockPage({ data, user, query, onAdd, onOpen }: { data: AppData; user: DemoUser; query: string; onAdd: () => void; onOpen: (id: string) => void }) {
  const animals = data.animals.filter((a) => a.farmerId === user.id).filter((a) => `${a.name} ${a.tagId} ${a.species} ${a.breed}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="page-stack"><SectionHeading eyebrow="FARM RECORDS" title="My livestock" subtitle="Keep animal profiles and health history organised." action={<button className="primary-button" onClick={onAdd}><Plus size={17} /> Add animal</button>} /><div className="filter-row"><div className="filter-count">{animals.length} registered animals</div><div className="filter-chip"><Filter size={14} /> All species <ChevronDown size={13} /></div></div><div className="animal-grid">{animals.map((a) => <button className="animal-card" key={a.id} onClick={() => onOpen(a.id)}><div className="animal-card-top"><div className="animal-card-icon">{a.photoDataUrl ? <Image src={a.photoDataUrl} alt={`${a.name} profile`} width={96} height={96} unoptimized /> : <PawPrint size={22} />}</div><StatusPill status={a.healthStatus.toUpperCase()} /><MoreHorizontal size={18} className="muted-icon" /></div><h3>{a.name}</h3><p>{a.tagId} · {a.species}</p><div className="animal-meta"><span>{a.breed}</span><span>{a.ageYears} years</span><span>{a.sex}</span></div><div className="animal-card-bottom"><span>View animal profile</span><ArrowUpRight size={15} /></div></button>)}</div>{animals.length === 0 && <EmptyState icon={PawPrint} title="No animals found" message="Try a different search or add a livestock profile." action={<button className="primary-button small-button" onClick={onAdd}>Add animal</button>} />}</div>;
}

function FarmsPage({ data, user, onAdd, onEdit }: { data: AppData; user: DemoUser; onAdd: () => void; onEdit: (id: string) => void }) {
  const farms = data.farms.filter(f => f.farmerId === user.id);
  return <div className="page-stack"><SectionHeading eyebrow="FARM MANAGEMENT" title="My farms" subtitle="Register farm locations and maintain your farm details." action={<button className="primary-button" onClick={onAdd}><Plus size={16}/> Add farm</button>} /><div className="animal-grid">{farms.map(f => { const animals = data.animals.filter(a => a.farmId === f.id); return <article className="animal-card" key={f.id}><div className="animal-card-top"><div className="animal-card-icon"><MapPinned size={21}/></div><Pill tone="info">{animals.length} animals</Pill></div><h3>{f.name}</h3><p>{f.village}, {f.district}</p><div className="animal-meta"><span>{f.areaAcres} acres</span><span>{f.latitude != null && f.longitude != null ? `${f.latitude.toFixed(4)}, ${f.longitude.toFixed(4)}` : "GPS not set"}</span></div><div className="animal-card-bottom"><span>{animals.length} linked livestock</span><button className="text-button" onClick={() => onEdit(f.id)}><Pencil size={14}/> Edit</button></div></article>; })}</div>{!farms.length && <EmptyState icon={MapPinned} title="No farms registered" message="Add your first farm to organise animals and health records." action={<button className="primary-button" onClick={onAdd}>Add farm</button>}/>}</div>;
}

function HealthRecordsPage({ data, user, role }: { data: AppData; user: DemoUser; role: Role }) {
  const visibleAnimalIds = new Set(data.animals.filter(a => role === "VETERINARIAN" || a.farmerId === user.id).map(a => a.id));
  const records = data.healthRecords.filter(r => visibleAnimalIds.has(r.animalId)).sort((a,b) => b.date.localeCompare(a.date));
  return <div className="page-stack"><SectionHeading eyebrow="LIVESTOCK HISTORY" title="Health records" subtitle={role === "FARMER" ? "A chronological view of the health information recorded for your animals." : "Review health observations and case assessments across registered animals."}/><div className="panel notification-panel"><div className="table-toolbar"><div><strong>{records.length} records</strong><span> · Newest first</span></div><Pill tone="info">Health timeline</Pill></div>{records.map(r => { const animal = data.animals.find(a => a.id === r.animalId); return <div className="history-item" key={r.id}><span>{dateLabel(r.date)}</span><div><strong>{r.type} · {animal?.name || "Animal"}</strong><p>{r.notes}</p><small>{animal?.tagId} · Recorded by {r.recordedBy}</small></div></div>; })}{!records.length && <EmptyState icon={ClipboardCheck} title="No health records yet" message="Veterinary assessments and routine observations will be listed here."/>}</div><div className="safety-footnote"><Info size={14}/><span>Records shown here are the entries captured by this local demonstration app; they are not an official veterinary record.</span></div></div>;
}

function ProfilePage({ user, onSave, isCloudAccount }: { user: DemoUser; onSave: (p: { name: string; email: string; phone: string }) => void; isCloudAccount: boolean }) {
  const [name, setName] = useState(user.name); const [email, setEmail] = useState(user.email); const [phone, setPhone] = useState(user.phone || "");
  return <div className="page-stack"><SectionHeading eyebrow="ACCOUNT DETAILS" title="My profile" subtitle={isCloudAccount ? "Manage the contact details linked to your Firebase account." : "Update the contact details shown in this local preview."}/><div className="panel crop-form-panel profile-edit-panel"><div className="profile-avatar-large">{initials(user.name)}</div><div className="review-card"><div className="review-row"><span>Workspace role</span><strong>{titleCase(user.role)}</strong></div><div className="review-row"><span>{isCloudAccount ? "Firebase account ID" : "Demo account ID"}</span><strong>{user.id}</strong></div></div><label className="form-field"><span>Full name</span><input value={name} onChange={e => setName(e.target.value)} maxLength={80}/></label><label className="form-field"><span>Email</span><input type="email" value={email} onChange={e => setEmail(e.target.value)} maxLength={120} disabled={isCloudAccount}/>{isCloudAccount && <small>Your sign-in email is managed by Firebase Authentication and cannot be changed from this profile form.</small>}</label><label className="form-field"><span>Phone / contact</span><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Optional contact number" maxLength={20}/></label><button className="primary-button" onClick={() => onSave({ name: name.trim(), email: email.trim(), phone: phone.trim() })} disabled={!name.trim() || !email.trim()}><Save size={15}/> Save profile</button><div className="safety-banner"><Info size={15}/><span>{isCloudAccount ? "Your display name and contact number sync to your Firebase profile. Changing your password is handled through the password-reset flow." : "These edits are saved only in this browser preview and do not change a login credential."}</span></div></div></div>;
}

function ReportsPage({ data, user, role, query, onOpen }: { data: AppData; user: DemoUser; role: Role; query: string; onOpen: (id: string) => void }) {
  const reports = data.reports.filter((r) => role === "VETERINARIAN" || r.farmerId === user.id).filter((r) => `${r.id} ${r.symptoms.join(" ")} ${r.location}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return <div className="page-stack"><SectionHeading eyebrow="REPORTING" title="Health reports" subtitle={role === "FARMER" ? "Review the health reports submitted for your livestock." : "All incoming livestock health reports across the demo farms."} /><div className="panel table-panel"><div className="table-toolbar"><div><strong>{reports.length} reports</strong><span> · Latest submissions first</span></div><div className="filter-chip"><Filter size={14} /> All statuses <ChevronDown size={13} /></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Report ID</th><th>Animal</th><th>Symptoms</th><th>Date</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>{reports.map((r) => { const a = data.animals.find((x) => x.id === r.animalId); return <tr key={r.id} className="clickable-row" onClick={() => onOpen(r.id)}><td><strong>{r.id}</strong><small>{r.location}</small></td><td><strong>{a?.name || "Animal"}</strong><small>{a?.tagId}</small></td><td className="symptom-cell">{r.symptoms.slice(0, 2).join(", ")}{r.symptoms.length > 2 ? ` +${r.symptoms.length - 2}` : ""}</td><td>{shortDate(r.submittedAt)}</td><td><PriorityPill priority={r.assessment.priority} /></td><td><StatusPill status={r.status} /></td><td><ChevronRight size={15} /></td></tr>; })}</tbody></table>{reports.length === 0 && <EmptyState title="No reports match" message="Try another search term." />}</div></div><div className="safety-footnote"><Info size={15} /><span>Risk levels and priority labels are illustrative triage outputs, not veterinary diagnoses.</span></div></div>;
}

function CasesPage({ data, query, onOpen }: { data: AppData; query: string; onOpen: (id: string) => void }) {
  const [filter, setFilter] = useState("ALL");
  const cases = data.cases.filter((c) => {
    const matchFilter = filter === "ALL" || (filter === "PRIORITY" && c.priority === "PRIORITY" && c.status !== "CLOSED") || (filter === "NORMAL" && c.priority === "NORMAL") || (filter === "FOLLOW_UP" && c.followUpRequired && c.status !== "CLOSED") || (filter === "CLOSED" && c.status === "CLOSED");
    const r = data.reports.find((x) => x.id === c.reportId); const a = data.animals.find((x) => x.id === c.animalId);
    return matchFilter && `${c.id} ${r?.symptoms.join(" ")} ${a?.name} ${r?.location}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => Number(b.priority === "PRIORITY") - Number(a.priority === "PRIORITY") || b.createdAt.localeCompare(a.createdAt));
  const filters = [{ id: "ALL", label: "All cases" }, { id: "PRIORITY", label: "Priority" }, { id: "NORMAL", label: "Normal" }, { id: "FOLLOW_UP", label: "Follow-up" }, { id: "CLOSED", label: "Closed" }];
  return <div className="page-stack"><SectionHeading eyebrow="VETERINARY WORKSPACE" title="Case queue" subtitle="Review incoming cases and manage veterinary response." /><div className="filter-tabs">{filters.map((f) => <button key={f.id} className={filter === f.id ? "selected" : ""} onClick={() => setFilter(f.id)}>{f.label}<span>{f.id === "ALL" ? data.cases.length : f.id === "CLOSED" ? data.cases.filter((c) => c.status === "CLOSED").length : cases.filter((c) => f.id === "PRIORITY" ? c.priority === "PRIORITY" : f.id === "NORMAL" ? c.priority === "NORMAL" : c.followUpRequired).length}</span></button>)}</div><div className="case-card-list">{cases.map((c) => <CaseQueueCard key={c.id} item={c} data={data} onClick={() => onOpen(c.id)} />)}{cases.length === 0 && <EmptyState icon={ClipboardCheck} title="No cases in this view" message="Try another filter or search." />}</div></div>;
}

function CaseQueueCard({ item, data, onClick }: { item: VeterinaryCase; data: AppData; onClick: () => void }) {
  const report = data.reports.find((r) => r.id === item.reportId); const animal = data.animals.find((a) => a.id === item.animalId); const farmer = data.users.find((u) => u.id === item.farmerId);
  return <button className="case-queue-card" onClick={onClick}><div className="case-priority-rail" data-priority={item.priority.toLowerCase()} /><div className="case-card-main"><div className="case-card-title"><strong>{item.id}</strong><span className="case-card-date">{shortDate(item.createdAt)}</span></div><h3>{animal?.name || "Animal"} <span>· {animal?.tagId}</span></h3><p>{report?.symptoms.join(", ") || "Health report"}</p><div className="case-card-meta"><span><UserRound size={13} /> {farmer?.name || "Farmer"}</span><span><MapPin size={13} /> {report?.location || "Location unavailable"}</span></div></div><div className="case-card-side"><PriorityPill priority={item.priority} /><StatusPill status={item.status} /><ChevronRight size={16} className="muted-icon" /></div></button>;
}

function SurveillancePage({ data, onOpenReport, onReviewCluster }: { data: AppData; onOpenReport: (id: string) => void; onReviewCluster: (id: string) => void }) {
  const [rangeDays, setRangeDays] = useState("30");
  const [priorityOnly, setPriorityOnly] = useState(false);
  const cutoff = Date.now() - Number(rangeDays) * 86400000;
  const reports = data.reports.filter(r => new Date(r.submittedAt).getTime() >= cutoff && (!priorityOnly || r.assessment.priority === "PRIORITY"));
  const locations = Array.from(new Set(reports.map((r) => r.location)));
  const points = reports.map(report => { const coordinate = reportCoordinates(report); return coordinate ? { report, lat: coordinate.lat, lng: coordinate.lng } : null; }).filter((x): x is NonNullable<typeof x> => Boolean(x));
  return <div className="page-stack"><SectionHeading eyebrow="PRELIMINARY SURVEILLANCE" title="Surveillance overview" subtitle="Review report patterns, area clusters and the supporting evidence behind each flag." action={<button className="secondary-button" onClick={() => downloadCsv("pashucare-surveillance.csv", reports.map(r => ({ reportId: r.id, area: r.location, symptoms: r.symptoms.join("; "), priority: r.assessment.priority, submittedAt: r.submittedAt, clusterId: r.clusterId ?? "" })))}><FileSpreadsheet size={15} /> Export view</button>} /><div className="safety-banner"><Info size={17} /><div><strong>Decision-support information only</strong><span>Possible clusters highlight related recent reports for veterinary review. They do not confirm disease or an outbreak. Some map positions are approximate area centroids.</span></div></div>
    <div className="surveillance-filter-row"><label className="form-field inline-field"><span>Time window</span><select value={rangeDays} onChange={e => setRangeDays(e.target.value)}><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select></label><label className="checkbox-inline"><input type="checkbox" checked={priorityOnly} onChange={e => setPriorityOnly(e.target.checked)} /> Priority only</label><Pill tone="info">{reports.length} reports in view</Pill></div>
    <section className="panel area-panel"><div className="panel-heading"><div><h2>Geographic report map</h2><p>Approximate reported locations and priority indicators.</p></div><Pill tone="success">OpenStreetMap</Pill></div>{points.length ? <LeafletSurveillanceMap points={points} onOpen={onOpenReport} /> : <EmptyState icon={MapPinned} title="No mapped reports in this filter" message="Reports with a GPS position or supported sample area will appear on the map." />}<div className="map-legend"><span><i className="legend-dot amber-dot" />Priority report</span><span><i className="legend-dot green-dot" />Normal report</span><span>Map points may be approximate</span></div></section>
    <div className="surveillance-layout"><section className="panel cluster-panel"><div className="panel-heading"><div><h2>Possible clusters</h2><p>Review related reports and configured comparison windows.</p></div><Pill tone="warning">{data.clusters.filter(c => c.status === "NEEDS_REVIEW").length} need review</Pill></div>{data.clusters.map((c) => <div className="cluster-card" key={c.id}><div className="cluster-card-head"><div className="cluster-icon"><ScanSearch size={17} /></div><div><strong>{c.id}</strong><span>{c.area}</span></div><StatusPill status={c.status} /></div><div className="cluster-metrics"><div><strong>{c.reportIds.length}</strong><span>Related reports</span></div><div><strong>{c.windowDays} days</strong><span>Comparison window</span></div></div><div className="cluster-symptoms"><span>Shared signals</span><div>{c.symptoms.map((symptom) => <Pill key={symptom} tone="info">{symptom}</Pill>)}</div></div><div className="supporting-reports">{c.reportIds.map((id) => { const report = data.reports.find((x) => x.id === id); return <button key={id} onClick={() => onOpenReport(id)}><span>{id}</span><small>{report?.symptoms.slice(0, 2).join(", ")}</small><ChevronRight size={14} /></button>; })}</div><div className="cluster-note"><Info size={14} />Requires veterinarian review. Not a confirmed outbreak.</div>{c.status !== "REVIEWED" && <button className="secondary-button small-button full-button" onClick={() => onReviewCluster(c.id)}><CheckCheck size={14} /> Mark reviewed</button>}</div>)}{data.clusters.length === 0 && <EmptyState title="No possible clusters" message="New reports are compared using the configured time, location and symptom rules." />}</section>
    <section className="panel area-summary"><div className="panel-heading"><div><h2>Report distribution</h2><p>Reports grouped by approximate area.</p></div></div><div className="location-bars">{locations.map((loc) => { const count = reports.filter((r) => r.location === loc).length; const priority = reports.filter((r) => r.location === loc && r.assessment.priority === "PRIORITY").length; return <div className="location-bar-row" key={loc}><span>{loc}</span><div className="location-bar"><i style={{ width: `${Math.max(10, count / Math.max(1, reports.length) * 100)}%` }} /></div><strong>{count}</strong><small>{priority} priority</small></div>; })}</div><div className="safety-footnote"><Info size={14} /><span>Location matching uses GPS distance when available, otherwise the farmer-entered area label. This does not establish epidemiological causation.</span></div></section></div>
  </div>;
}
function VaccinationsPage({ data, role, user, onAdd, onEdit }: { data: AppData; role: Role; user: DemoUser; onAdd: () => void; onEdit: (id: string) => void }) {
  const animalIds = role === "FARMER" ? data.animals.filter((a) => a.farmerId === user.id).map((a) => a.id) : data.animals.map((a) => a.id);
  const list = data.vaccinations.filter((v) => animalIds.includes(v.animalId)).sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  return <div className="page-stack"><SectionHeading eyebrow="ROUTINE HEALTH" title={role === "FARMER" ? "Vaccinations" : "Vaccination records"} subtitle={role === "FARMER" ? "Review completed vaccinations and upcoming due dates." : "Maintain vaccination information and routine records."} action={role === "VETERINARIAN" ? <button className="primary-button" onClick={onAdd}><Plus size={17} /> Add record</button> : undefined} /><div className="stats-grid compact-stats"><StatCard label="Total records" value={list.length} note="Across visible animals" icon={ClipboardCheck} tone="green" /><StatCard label="Upcoming" value={list.filter((v) => v.status === "DUE").length} note="Reminder due" icon={CalendarClock} tone="amber" /><StatCard label="Overdue" value={list.filter((v) => v.status === "OVERDUE").length} note="Needs attention" icon={AlertCircle} tone="rose" /></div><div className="panel table-panel"><div className="table-toolbar"><div><strong>Vaccination history</strong><span> · {list.length} records</span></div><div className="filter-chip"><Filter size={14} /> All records <ChevronDown size={13} /></div></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Animal</th><th>Vaccine</th><th>Last administered</th><th>Next due</th><th>Status</th>{role === "VETERINARIAN" && <th>Manage</th>}</tr></thead><tbody>{list.map((v) => { const a = data.animals.find((x) => x.id === v.animalId); return <tr key={v.id}><td><strong>{a?.name || "Animal"}</strong><small>{a?.tagId}</small></td><td>{v.vaccineName}</td><td>{dateLabel(v.administeredOn)}</td><td>{dateLabel(v.dueOn)}</td><td><StatusPill status={v.status} /></td>{role === "VETERINARIAN" && <td><button className="text-button" onClick={() => onEdit(v.id)}><Pencil size={14} /> Edit</button></td>}</tr>; })}</tbody></table>{list.length === 0 && <EmptyState icon={Syringe} title="No vaccination records" message="Vaccination records will appear here." />}</div></div></div>;
}

function FollowupsPage({ data, onOpenCase }: { data: AppData; onOpenCase: (id: string) => void }) {
  const list = data.cases.filter((c) => c.followUpRequired && c.status !== "CLOSED").sort((a, b) => (a.followUpDate || "").localeCompare(b.followUpDate || ""));
  return <div className="page-stack"><SectionHeading eyebrow="VETERINARY WORKSPACE" title="Follow-ups" subtitle="Track cases that need another review or scheduled action." /><div className="case-card-list">{list.map((c) => { const animal = data.animals.find((a) => a.id === c.animalId); const farmer = data.users.find((u) => u.id === c.farmerId); return <button key={c.id} className="followup-card" onClick={() => onOpenCase(c.id)}><div className="followup-date"><CalendarDays size={18} /><strong>{shortDate(c.followUpDate)}</strong><span>Due date</span></div><div className="followup-info"><strong>{c.id} · {animal?.name}</strong><span>{farmer?.name} · {animal?.tagId}</span><p>{c.followUpNotes || "Veterinary follow-up requested."}</p></div><Pill tone="warning">Follow-up due</Pill><ChevronRight size={17} /></button>; })}{list.length === 0 && <EmptyState icon={CalendarCheck} title="No follow-ups pending" message="Cases marked for follow-up will appear here." />}</div></div>;
}

function AlertsPage({ data, user, onRead, onReadAll, onOpenRelated, notificationPermission, onEnableBrowserNotifications }: { data: AppData; user: DemoUser; onRead: (id: string) => void; onReadAll: () => void; onOpenRelated: (id: string) => void; notificationPermission: NotificationPermission | "unsupported"; onEnableBrowserNotifications: () => void }) {
  const list = data.alerts.filter((a) => a.recipientId === user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = list.filter((a) => !a.readAt).length;
  return <div className="page-stack"><SectionHeading eyebrow="IN-APP NOTIFICATIONS" title="Alerts & updates" subtitle="Important health events, reminders and veterinary case activity." action={notificationPermission === "default" ? <button type="button" className="primary-button notification-permission-button" onClick={onEnableBrowserNotifications}><BellRing size={16}/><span>Enable browser alerts</span></button> : <div className={`notification-permission-status permission-${notificationPermission}`}><BellRing size={16}/><span>{notificationPermission === "granted" ? "Browser alerts enabled" : notificationPermission === "denied" ? "Browser alerts blocked · see steps below" : "Browser alerts unavailable"}</span></div>} />
    {notificationPermission === "denied" && <div className="notification-permission-help"><div className="permission-help-icon"><Shield size={17}/></div><div><strong>Notifications are blocked by your browser</strong><span>Open the site settings from the address bar, change Notifications to Allow, then reload PashuCare. In-app alerts continue to work either way.</span></div><button type="button" className="text-button" onClick={onEnableBrowserNotifications}>Check again</button></div>}
    <div className="panel notification-panel"><div className="table-toolbar"><div><strong>{unread} unread</strong><span> · {list.length} total notifications</span></div><div className="notification-toolbar-actions"><Pill tone="info">In-app alerts</Pill>{unread > 0 && <button type="button" className="text-button mark-all-read" onClick={onReadAll}><CheckCheck size={14}/> Mark all read</button>}</div></div>
      {list.map((a) => <div className={`notification-row ${!a.readAt ? "unread" : ""}`} key={a.id}><div className={`notification-icon type-${a.type.toLowerCase()}`}>{a.type === "CLUSTER" ? <ScanSearch size={18} /> : a.type === "VACCINATION" ? <Syringe size={18} /> : a.type === "PRIORITY" ? <AlertTriangle size={18} /> : a.type === "FOLLOW_UP" ? <CalendarClock size={18} /> : a.type === "ESCALATION" ? <BellRing size={18} /> : <Bell size={18} />}</div><div className="notification-content"><div className="notification-title"><strong>{a.title}</strong>{!a.readAt && <i />}</div><p>{a.message}</p><span>{dateLabel(a.createdAt)}</span></div><div className="notification-actions">{a.relatedId && <button type="button" className="text-button" onClick={() => { onRead(a.id); onOpenRelated(a.relatedId!); }} aria-label={`View related item for ${a.title}`}>View <ArrowUpRight size={13} /></button>}{!a.readAt && <button type="button" className="icon-button small notification-read-button" onClick={() => onRead(a.id)} title="Mark as read" aria-label={`Mark ${a.title} as read`}><Check size={16} /><span>Read</span></button>}</div></div>)}
      {list.length === 0 && <EmptyState icon={Bell} title="You're all caught up" message="New updates will appear here." />}
    </div><div className="safety-banner"><Info size={15}/><span>In-app notifications are saved with your account. Browser alerts work on this device when permission is granted and PashuCare is active. Background push delivery needs a separately configured Firebase Cloud Messaging sender.</span></div></div>;
}

function BackupPage({ data, user, onRestore }: { data: AppData; user: DemoUser; onRestore: (data: AppData) => void }) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const exportBackup = () => {
    const payload = { product: "PashuCare", schemaVersion: 1, exportedAt: new Date().toISOString(), ownerUid: user.id, data };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `pashucare-backup-${new Date().toISOString().slice(0, 10)}.json`; anchor.click();
    URL.revokeObjectURL(url); setStatus("Backup downloaded successfully."); setError("");
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    setError(""); setStatus("");
    try {
      if (file.size > 15 * 1024 * 1024) throw new Error("Backup file is larger than 15 MB.");
      const parsed = JSON.parse(await file.text()) as { product?: string; ownerUid?: string; data?: AppData };
      const candidate = parsed?.data;
      if (parsed.product !== "PashuCare" || !candidate || !Array.isArray(candidate.users) || !Array.isArray(candidate.farms) || !Array.isArray(candidate.animals) || !Array.isArray(candidate.reports) || !Array.isArray(candidate.cases) || !Array.isArray(candidate.alerts) || !candidate.counters || !candidate.surveillanceSettings || !Array.isArray(candidate.escalationRules)) {
        throw new Error("This file is not a valid PashuCare backup.");
      }
      if (user.role !== "FARMER") throw new Error("Veterinarian accounts can export the cooperative workspace but cannot restore it from this screen.");
      if (parsed.ownerUid !== user.id) throw new Error("This backup does not belong to the signed-in account. Restore it from the matching Farmer account.");
      if (!candidate.users.some(person => person.id === user.id)) throw new Error("The backup does not contain your active account profile.");
      const farmIds = new Set(candidate.farms.filter(item => item.farmerId === user.id).map(item => item.id));
      const animalIds = new Set(candidate.animals.filter(item => item.farmerId === user.id && farmIds.has(item.farmId)).map(item => item.id));
      const reportIds = new Set(candidate.reports.filter(item => item.farmerId === user.id && animalIds.has(item.animalId)).map(item => item.id));
      const valid = candidate.farms.every(item => item.farmerId === user.id)
        && candidate.animals.every(item => item.farmerId === user.id && farmIds.has(item.farmId))
        && candidate.reports.every(item => item.farmerId === user.id && animalIds.has(item.animalId))
        && candidate.cases.every(item => item.farmerId === user.id && animalIds.has(item.animalId))
        && candidate.pendingReports.every(item => item.farmerId === user.id)
        && candidate.vaccinations.every(item => animalIds.has(item.animalId))
        && candidate.healthRecords.every(item => animalIds.has(item.animalId))
        && candidate.cropPlans.every(item => farmIds.has(item.farmId))
        && candidate.alerts.every(item => item.recipientId === user.id)
        && candidate.auditLogs.every(item => item.actorId === user.id)
        && candidate.clusters.every(item => item.reportIds.every(id => reportIds.has(id)));
      if (!valid) throw new Error("This backup contains records outside your Farmer workspace and cannot be restored.");
      const confirmRestore = window.confirm("Restore this Farmer workspace backup? Current records for this account will be replaced.");
      if (!confirmRestore) return;
      onRestore(candidate);
      setStatus("Backup restored. Your cloud sync will update this workspace.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not read the backup file."); }
  };
  const counts: Array<[string, number]> = [["Farms", data.farms.length], ["Animals", data.animals.length], ["Health reports", data.reports.length], ["Veterinary cases", data.cases.length], ["Vaccinations", data.vaccinations.length], ["Alerts", data.alerts.length]];
  return <div className="page-stack"><SectionHeading eyebrow="DATA PORTABILITY" title="Backup & restore" subtitle={user.role === "VETERINARIAN" ? "Export a cooperative workspace snapshot for controlled off-platform backup." : "Download or restore your Farmer workspace backup."} />
    <div className="stats-grid backup-stats">{counts.map(([label, value]) => <div className="stat-card" key={label}><div className="stat-copy"><span>{label}</span><strong>{value}</strong></div></div>)}</div>
    <div className={`backup-grid ${user.role === "VETERINARIAN" ? "backup-grid-single" : ""}`}><section className="panel backup-card"><div className="backup-icon"><Download size={21}/></div><h2>{user.role === "VETERINARIAN" ? "Export cooperative data" : "Export workspace"}</h2><p>Download {user.role === "VETERINARIAN" ? "Farmer records accessible to the cooperative and veterinary activity" : "your farms, animals, reports, veterinary cases, vaccination records, alerts, settings and audit history"} as a JSON backup.</p><button type="button" className="primary-button" onClick={exportBackup}><Download size={15}/> Download full backup</button></section>{user.role === "FARMER" && <section className="panel backup-card"><div className="backup-icon"><FilePlus2 size={21}/></div><h2>Restore workspace</h2><p>Choose a PashuCare JSON backup created by this Farmer account. Restore replaces only records owned by this signed-in account.</p><label className="secondary-button backup-file-button"><FilePlus2 size={15}/> Choose backup file<input type="file" accept="application/json,.json" onChange={event => { void importBackup(event.target.files?.[0]); event.currentTarget.value = ""; }}/></label></section>}</div>
    {status && <div className="auth-success" role="status">{status}</div>}{error && <div className="form-error" role="alert">{error}</div>}
    <div className="safety-banner"><ShieldCheck size={15}/><span>Backups may contain names, livestock health records and contact details. Store them privately. Veterinarian exports can contain records for every Farmer in this Firebase project; keep them in approved secure storage. Farmer restores are restricted to the signed-in account's own records.</span></div>
  </div>;
}

function CropRotationPage({ data, user, onSave }: { data: AppData; user: DemoUser; onSave: (plan: CropRotationPlan) => void }) {
  const farms = data.farms.filter(f => f.farmerId === user.id);
  const [farmId, setFarmId] = useState(farms[0]?.id || ""); const [field, setField] = useState("North Field"); const [previous, setPrevious] = useState("Soybean"); const [season, setSeason] = useState("Rabi"); const [suggestion, setSuggestion] = useState("");
  const farm = farms.find(f => f.id === farmId);
  const crops = ["Wheat", "Jowar", "Maize", "Gram", "Chickpea", "Vegetables", "Fodder"];
  const suggest = () => { const map: Record<string, string> = { Soybean: "Wheat", Groundnut: "Jowar", Maize: "Gram", Wheat: "Groundnut", Cotton: "Chickpea", Fodder: "Vegetables" }; setSuggestion(map[previous] || "Gram"); };
  const save = () => { if (!farmId || !field.trim()) return; const plannedCrop = suggestion || crops.find((c) => c !== previous) || "Wheat"; onSave({ id: `CROP-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, farmId, fieldName: field.trim(), previousCrop: previous, plannedCrop, season, suggestion: `Illustrative rotation suggestion: ${plannedCrop} after ${previous}. Confirm suitability with local agronomy guidance.` }); };
  return <div className="page-stack"><SectionHeading eyebrow="FARM UTILITY" title="Crop rotation planner" subtitle="A simple secondary utility for planning crop changes by field." /><div className="crop-layout"><section className="panel crop-form-panel"><div className="panel-heading"><div><h2>Plan a rotation</h2><p>Choose a farm, enter the last crop and select a season.</p></div><div className="crop-icon-large"><Sprout size={21} /></div></div><label className="form-field"><span>Farm</span><select value={farmId} onChange={e => setFarmId(e.target.value)}>{farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="form-field"><span>Field name</span><input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. North Field" /></label><label className="form-field"><span>Previous crop</span><select value={previous} onChange={(e) => { setPrevious(e.target.value); setSuggestion(""); }}><option>Soybean</option><option>Groundnut</option><option>Maize</option><option>Wheat</option><option>Cotton</option><option>Fodder</option></select></label><label className="form-field"><span>Planning season</span><select value={season} onChange={(e) => setSeason(e.target.value)}><option>Rabi</option><option>Kharif</option><option>Zaid</option></select></label><button className="primary-button full-button" onClick={suggest} disabled={!farmId}><Sprout size={16} /> Generate suggestion</button>{suggestion && <div className="suggestion-result"><span>ILLUSTRATIVE SUGGESTION</span><strong>{suggestion}</strong><p>A simple rule-based rotation idea following {previous}. This is a planning aid, not agronomic advice.</p><button className="secondary-button" onClick={save}><Save size={15} /> Save plan</button></div>}</section><section className="panel crop-plans-panel"><div className="panel-heading"><div><h2>Saved plans</h2><p>Rotation plans for {farm?.name || "your farm"}.</p></div><Pill tone="info">{data.cropPlans.filter((p) => p.farmId === farmId).length} plans</Pill></div>{data.cropPlans.filter((p) => p.farmId === farmId).map((p) => <div className="saved-plan" key={p.id}><div className="saved-plan-icon"><Leaf size={18} /></div><div><strong>{p.fieldName}</strong><span>{p.previousCrop} → {p.plannedCrop} · {p.season}</span><p>{p.suggestion}</p></div></div>)}{!data.cropPlans.some((p) => p.farmId === farmId) && <EmptyState icon={Sprout} title="No saved crop plans" message="Generate a simple rotation suggestion and save it here." />}</section></div>{!farms.length && <div className="safety-banner"><Info size={15}/><span>Register a farm before saving a crop rotation plan.</span></div>}<div className="safety-footnote"><Info size={15} /><span>Crop rotation is a secondary utility, separate from livestock surveillance. Suggestions are illustrative and should be checked with local agricultural guidance.</span></div></div>;
}

function GuidePage({ role }: { role: Role }) {
  const items = role === "FARMER" ? ["Register and update farms under My farms; add GPS only with permission.", "Add or edit livestock profiles and attach an optional animal photo.", "Open New health report and complete the three-step form.", "Review report status, health-record timeline, vaccination reminders and veterinary updates.", "Use Crop rotation to plan by farm and field; edit your local profile details in My profile."] : ["Open Case queue and filter by priority or follow-up.", "Review the original report, animal history, health timeline and vaccination records.", "Read preliminary risk reasons and supporting possible-cluster evidence.", "Assign the case to an available veterinarian and record assessment/treatment/recommendations.", "Edit vaccination records, schedule follow-up or close the case; the farmer receives an in-app update."];
  return <div className="page-stack"><SectionHeading eyebrow="QUICK GUIDE" title="Using PashuCare" subtitle="A short walkthrough for the current workspace." /><div className="panel guide-panel"><div className="guide-hero"><div className="guide-hero-icon">{role === "FARMER" ? <Tractor size={25} /> : <Stethoscope size={25} />}</div><div><h2>{role === "FARMER" ? "Farmer guide" : "Veterinarian guide"}</h2><p>Follow these steps to complete the main workflow.</p></div></div>{items.map((item, i) => <div className="guide-step" key={item}><span>{i + 1}</span><p>{item}</p><CheckCircle2 size={17} /></div>)}<div className="safety-banner"><Info size={16} /><div><strong>Important safety note</strong><span>Automated risk is preliminary decision support. Possible clusters require review. Clinical diagnosis and treatment remain with an authorised veterinarian.</span></div></div></div></div>;
}

function AnimalIdentityPage({ data, user, onOpen }: { data: AppData; user: DemoUser; onOpen: (id: string) => void }) {
  const [manualTag, setManualTag] = useState("");
  const [scanMessage, setScanMessage] = useState("");
  const animals = useMemo(() => data.animals.filter(a => user.role === "VETERINARIAN" || a.farmerId === user.id), [data.animals, user.role, user.id]);
  const handleScan = useCallback((raw: string) => {
    const match = animals.find(a => raw.includes(a.id) || raw.includes(a.tagId));
    if (match) { setScanMessage(`Animal found: ${match.name} · ${match.tagId}`); onOpen(match.id); }
    else setScanMessage("No matching animal was found in the accessible records.");
  }, [animals, onOpen]);
  const manualLookup = () => {
    const match = animals.find(a => a.tagId.toLowerCase() === manualTag.trim().toLowerCase() || a.id.toLowerCase() === manualTag.trim().toLowerCase());
    if (match) { setScanMessage(`Animal found: ${match.name}`); onOpen(match.id); }
    else setScanMessage("No animal matches that tag or identity ID.");
  };
  return <div className="page-stack"><SectionHeading eyebrow="DIGITAL ANIMAL IDENTITY" title="Animal ID & QR tags" subtitle="Give each registered animal a scannable identity for faster lookup and record access." /><div className="identity-grid"><section className="panel scanner-panel"><div className="panel-heading"><div><h2><ScanLine size={18} /> Scan an animal tag</h2><p>Scan a PashuCare QR label using your device camera.</p></div></div><QRScanner onDetected={handleScan} />{scanMessage && <div className="safety-banner"><Info size={15} /><span>{scanMessage}</span></div>}<div className="manual-lookup"><label className="form-field"><span>Or enter tag / animal ID</span><input value={manualTag} onChange={e => setManualTag(e.target.value)} placeholder="MH-PUN-001" /></label><button className="primary-button" onClick={manualLookup}><Search size={15} /> Find animal</button></div></section><section className="panel identity-list-panel"><div className="panel-heading"><div><h2>Registered identity tags</h2><p>{animals.length} accessible animal profiles</p></div><Pill tone="info">QR supported</Pill></div><div className="identity-list">{animals.map(animal => <div className="identity-row" key={animal.id}><div className="animal-card-icon">{animal.photoDataUrl ? <Image src={animal.photoDataUrl} alt={`${animal.name} profile`} width={96} height={96} unoptimized /> : <PawPrint size={20}/>}</div><div className="identity-copy"><strong>{animal.name}</strong><span>{animal.tagId} · {animal.species} · {animal.breed}</span></div><button className="secondary-button small-button" onClick={() => onOpen(animal.id)}><QrCode size={14} /> View QR</button></div>)}</div></section></div><div className="safety-footnote"><Info size={14} /><span>QR codes contain a local animal reference and tag ID only. They do not expose health or owner information directly.</span></div></div>;
}

function AnimalProfileModal({ animal, data, onClose, onEdit, canEdit }: { animal: Animal; data: AppData; onClose: () => void; onEdit: () => void; canEdit: boolean }) {
  const farm = data.farms.find(f => f.id === animal.farmId);
  const qrValue = `pashucare://animal/${animal.id}/tag/${animal.tagId}`;
  const reports = data.reports.filter(r => r.animalId === animal.id).slice(0, 5);
  const vaccinations = data.vaccinations.filter(v => v.animalId === animal.id);
  return <Modal title={`${animal.name} · Animal identity`} description={`${animal.tagId} · ${farm?.name ?? "Farm record"}`} onClose={onClose} wide><div className="animal-profile-qr-layout"><div className="animal-profile-summary"><div className="animal-card-icon large">{animal.photoDataUrl ? <Image src={animal.photoDataUrl} alt={`${animal.name} profile`} width={96} height={96} unoptimized /> : <PawPrint size={27}/>}</div><h3>{animal.name}</h3><p>{animal.species} · {animal.breed}</p><StatusPill status={animal.healthStatus.toUpperCase()} /><div className="review-card"><div className="review-row"><span>Tag ID</span><strong>{animal.tagId}</strong></div><div className="review-row"><span>Sex / Age</span><strong>{animal.sex} · {animal.ageYears} years</strong></div><div className="review-row"><span>Farm</span><strong>{farm?.name}</strong></div><div className="review-row"><span>Area</span><strong>{farm?.village}, {farm?.district}</strong></div></div></div><div className="qr-card"><QRCodeSVG value={qrValue} size={220} level="H" includeMargin /><strong>{animal.tagId}</strong><span>Scan to identify this animal in PashuCare</span><button className="secondary-button" onClick={() => window.print()}><Printer size={15} /> Print QR tag</button><small>QR contains only an animal reference and tag identifier.</small></div><div className="animal-profile-history"><div className="panel-heading"><div><h3>Recent reports</h3><p>Health concerns linked to this animal.</p></div></div>{reports.map(r => <div className="history-item" key={r.id}><span>{shortDate(r.submittedAt)}</span><div><strong>{r.id} · {r.symptoms.slice(0, 2).join(", ")}</strong><p>{titleCase(r.assessment.priority)} priority · {titleCase(r.status)}</p></div></div>)}{!reports.length && <p className="muted small">No health reports recorded.</p>}<div className="panel-divider"/><h3>Health record timeline</h3>{data.healthRecords.filter(h => h.animalId === animal.id).sort((a,b) => b.date.localeCompare(a.date)).map(h => <div className="history-item" key={h.id}><span>{shortDate(h.date)}</span><div><strong>{h.type}</strong><p>{h.notes}</p><small>{h.recordedBy}</small></div></div>)}{!data.healthRecords.some(h => h.animalId === animal.id) && <p className="muted small">No health records available.</p>}<div className="panel-divider"/><h3>Vaccination records</h3>{vaccinations.map(v => <div className="vaccine-history-line" key={v.id}><Syringe size={14}/><span>{v.vaccineName}</span><small>Due {dateLabel(v.dueOn)}</small></div>)}{!vaccinations.length && <p className="muted small">No vaccination records available.</p>}</div></div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Close</button>{canEdit && <button className="primary-button" onClick={onEdit}><Pencil size={15}/> Edit animal</button>}</div></Modal>;
}

function OfflineQueuePage({ data, online, cloudEnabled, onSync, onRemove }: { data: AppData; online: boolean; cloudEnabled: boolean; onSync: () => void; onRemove: (id: string) => void }) {
  const storageLabel = cloudEnabled ? "Saved on this device · Firebase sync pending" : "Stored in this browser";
  const queueLabel = cloudEnabled ? "Firebase sync queue" : "Local preview queue";
  const onlineDescription = cloudEnabled
    ? "Queued reports are processed and synchronized with your Firebase workspace automatically after reconnecting."
    : "Queued reports are processed into this browser's local preview when you reconnect.";
  return <div className="page-stack">
    <SectionHeading eyebrow="OFFLINE-FIRST WORKSPACE" title="Offline submission queue" subtitle="Capture health reports when connectivity is unavailable; they are kept on this device until you reconnect." action={<button type="button" className="primary-button" onClick={onSync} disabled={!online || !data.pendingReports.length}><RefreshCw size={15}/> Process queued reports</button>} />
    <div className={`offline-status-panel ${online ? "online" : "offline"}`}>
      <div>{online ? <Wifi size={20}/> : <CloudOff size={20}/>}</div>
      <div><strong>{online ? "Connection available" : "Currently offline"}</strong><span>{online ? onlineDescription : "You can continue to capture reports. They remain in your local device cache and will be picked up automatically when a connection returns."}</span></div>
      <Pill tone={online ? "success" : "warning"}>{online ? "Online" : "Offline"}</Pill>
    </div>
    <div className="panel notification-panel">
      <div className="table-toolbar"><div><strong>{data.pendingReports.length} pending report(s)</strong><span> · {storageLabel}</span></div><Pill tone="info">{queueLabel}</Pill></div>
      {data.pendingReports.map(p => { const animal = data.animals.find(a => a.id === p.payload.animalId); return <div className="notification-row" key={p.id}><div className="notification-icon type-case"><CloudUpload size={18}/></div><div className="notification-content"><div className="notification-title"><strong>{animal?.name ?? "Animal"} · {p.payload.location}</strong><Pill tone="warning">Queued offline</Pill></div><p>{p.payload.symptoms.join(", ")} · {p.payload.severity} · queued {dateLabel(p.queuedAt)}</p><span>{p.id}</span></div><div className="notification-actions"><button type="button" className="text-button" onClick={() => onRemove(p.id)}>Discard</button></div></div>; })}
      {!data.pendingReports.length && <EmptyState icon={CheckCircle2} title="Queue is clear" message="No unsent reports are waiting on this device." />}
    </div>
    <div className="safety-banner"><Info size={15}/><div><strong>{cloudEnabled ? "Firebase reconnect sync" : "Local preview mode"}</strong><span>{cloudEnabled ? "Records are saved locally first, then synchronized with Cloud Firestore when online. Attached photos upload to Firebase Storage during synchronization. Sign in once while online before relying on offline access on a device." : "This unconfigured preview stores data only in this browser. Add Firebase environment variables to enable secure accounts and multi-device synchronization."}</span></div></div>
  </div>;
}

function AnalyticsPage({ data }: { data: AppData }) {
  const priority = data.reports.filter(r => r.assessment.priority === "PRIORITY").length;
  const normal = data.reports.length - priority;
  const closed = data.cases.filter(c => c.status === "CLOSED").length;
  const open = data.cases.length - closed;
  const areas = Array.from(new Set(data.reports.map(r => r.location))).map(area => ({ area, count: data.reports.filter(r => r.location === area).length }));
  const exportReports = () => downloadCsv("pashucare-health-reports.csv", data.reports.map(r => ({ reportId: r.id, animalId: r.animalId, farmerId: r.farmerId, symptoms: r.symptoms.join("; "), severity: r.severity, priority: r.assessment.priority, score: r.assessment.score, location: r.location, status: r.status, submittedAt: r.submittedAt })));
  const exportCases = () => downloadCsv("pashucare-veterinary-cases.csv", data.cases.map(c => ({ caseId: c.id, reportId: c.reportId, animalId: c.animalId, priority: c.priority, status: c.status, followUpDate: c.followUpDate ?? "", updatedAt: c.updatedAt })));
  return <div className="page-stack"><SectionHeading eyebrow="OPERATIONAL INSIGHTS" title="Analytics & export" subtitle="Understand reporting activity and veterinary workload across the demonstration dataset." action={<button className="secondary-button" onClick={() => window.print()}><Printer size={15}/> Print report</button>} /><div className="stats-grid"><StatCard label="Total reports" value={data.reports.length} note="Synthetic demonstration data" icon={FileText}/><StatCard label="Priority reports" value={priority} note={`${data.reports.length ? Math.round(priority / data.reports.length * 100) : 0}% of reports`} icon={AlertTriangle} tone="amber"/><StatCard label="Open cases" value={open} note="Awaiting professional action" icon={ClipboardList} tone="blue"/><StatCard label="Closed cases" value={closed} note="Case lifecycle completed" icon={CheckCircle2} tone="green"/></div><div className="analytics-grid"><section className="panel analytics-panel"><div className="panel-heading"><div><h2>Priority distribution</h2><p>Report routing classification.</p></div></div><div className="donut-summary"><div className="donut-ring" style={{ background: `conic-gradient(#d29a3d 0 ${data.reports.length ? priority / data.reports.length * 100 : 0}%, #3d7955 0 100%)` }}><div><strong>{data.reports.length}</strong><span>reports</span></div></div><div className="chart-legend-block"><span><i className="legend-dot amber-dot"/>Priority <strong>{priority}</strong></span><span><i className="legend-dot green-dot"/>Normal <strong>{normal}</strong></span></div></div></section><section className="panel analytics-panel"><div className="panel-heading"><div><h2>Reports by area</h2><p>Counts grouped by farmer-entered location.</p></div></div><div className="location-bars">{areas.map(a => <div className="location-bar-row" key={a.area}><span>{a.area}</span><div className="location-bar"><i style={{ width: `${Math.max(8, a.count / Math.max(1, data.reports.length) * 100)}%` }}/></div><strong>{a.count}</strong></div>)}</div></section></div><section className="panel export-panel"><div className="panel-heading"><div><h2>Data exports</h2><p>Download synthetic project records in a spreadsheet-friendly CSV format.</p></div><FileSpreadsheet size={20}/></div><div className="export-actions"><button className="secondary-button" onClick={exportReports}><FileDown size={15}/> Export health reports</button><button className="secondary-button" onClick={exportCases}><FileDown size={15}/> Export veterinary cases</button><button className="secondary-button" onClick={() => downloadCsv("pashucare-audit-history.csv", data.auditLogs.map(l => ({ eventId:l.id, actor:l.actorName, role:l.actorRole, action:l.action, entity:l.entityType, entityId:l.entityId, summary:l.summary, timestamp:l.createdAt })))}><FileDown size={15}/> Export audit history</button></div></section><p className="muted small">All analytics are computed from the local demonstration dataset. They are not population estimates or clinical surveillance statistics.</p></div>;
}

function AuditHistoryPage({ data }: { data: AppData }) {
  const logs = [...data.auditLogs].sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  return <div className="page-stack"><SectionHeading eyebrow="TRACEABILITY" title="Audit history" subtitle="Review application event history for report submission, case changes, vaccination updates and rule actions." action={<button className="secondary-button" onClick={() => downloadCsv("pashucare-audit-history.csv", logs.map(l => ({ actor:l.actorName, role:l.actorRole, action:l.action, entity:l.entityType, entityId:l.entityId, summary:l.summary, timestamp:l.createdAt })))}><FileSpreadsheet size={15}/> Export CSV</button>} /><div className="panel notification-panel"><div className="table-toolbar"><div><strong>{logs.length} events</strong><span> · Newest first</span></div><Pill tone="info">Demo audit trail</Pill></div>{logs.map(log => <div className="audit-row" key={log.id}><div className="audit-marker"><ClipboardClock size={16}/></div><div className="audit-copy"><div><strong>{log.action.replaceAll("_", " ")}</strong><Pill tone={log.actorRole === "VETERINARIAN" ? "info" : "green"}>{titleCase(log.actorRole)}</Pill></div><p>{log.summary}</p><span>{log.actorName} · {log.entityType} {log.entityId} · {dateLabel(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"})}</span></div></div>)}{!logs.length && <EmptyState title="No audit events" message="Important activities will be listed here."/>}</div><div className="safety-banner"><Shield size={15}/><span>These application-level events are synced as workspace records. They are not an immutable compliance audit log; regulated deployments should add server-side, append-only audit logging.</span></div></div>;
}

function RulesAndEscalationPage({ data, onSave }: { data: AppData; onSave: (settings: AppData["surveillanceSettings"], rules: AppData["escalationRules"]) => void }) {
  const [settings, setSettings] = useState(data.surveillanceSettings);
  const [rules, setRules] = useState(data.escalationRules);
  const numberField = (key: keyof typeof settings, label: string, min: number, max: number, hint: string) => <label className="form-field rule-field"><span>{label}</span><input type="number" min={min} max={max} value={settings[key] as number} onChange={e => setSettings(old => ({ ...old, [key]: Math.min(max, Math.max(min, Number(e.target.value))) }))}/><small>{hint}</small></label>;
  return <div className="page-stack"><SectionHeading eyebrow="CONFIGURATION" title="Surveillance rules & escalation" subtitle="Adjust transparent demonstration thresholds and alert escalation behaviour." action={<button className="primary-button" onClick={() => onSave(settings, rules)}><Save size={15}/> Save configuration</button>} /><div className="safety-banner"><Info size={15}/><div><strong>Illustrative configuration only</strong><span>These settings demonstrate configurable business rules. They are not clinically validated thresholds and should not be used for real-world veterinary triage without expert review.</span></div></div><div className="settings-grid"><section className="panel settings-panel"><div className="panel-heading"><div><h2>Preliminary surveillance rules</h2><p>Applied to new reports in the local demo.</p></div><SlidersHorizontal size={19}/></div>{numberField("priorityScore", "Priority score threshold", 1, 100, "Score at or above this value enters the priority queue.")}{numberField("clusterWindowDays", "Cluster comparison window (days)", 1, 90, "Only recent reports inside this time window are compared.")}{numberField("minimumClusterReports", "Minimum reports for possible cluster", 2, 20, "Includes the incoming report plus matching prior reports.")}{numberField("matchingSymptomMinimum", "Minimum shared symptoms", 1, 10, "At least this many candidate symptoms must be shared.")}{numberField("vaccinationReminderDays", "Vaccination reminder lead time (days)", 0, 60, "Create in-app reminders before the recorded due date.")}{numberField("followUpReminderDays", "Follow-up reminder lead time (days)", 0, 30, "Remind the veterinary workspace before a scheduled follow-up.")}<div className="mortality-toggle rule-toggle"><div><strong>Escalate priority cases only</strong><span>When disabled, all open cases can be escalated after their rule window.</span></div><button type="button" className={`switch ${settings.escalationPriorityOnly ? "on" : ""}`} aria-pressed={settings.escalationPriorityOnly} onClick={() => setSettings(old => ({ ...old, escalationPriorityOnly: !old.escalationPriorityOnly }))}><i /></button></div></section><section className="panel settings-panel"><div className="panel-heading"><div><h2>Escalation rules</h2><p>Operational reminders generated from sample records.</p></div><BellRing size={19}/></div>{rules.map(rule => <div className="escalation-rule-row" key={rule.id}><div><strong>{rule.name}</strong><p>{rule.description}</p><small>{rule.condition.replaceAll("_", " ")} · notify {titleCase(rule.notifyRole)}</small></div><button type="button" className={`switch ${rule.enabled ? "on" : ""}`} aria-pressed={rule.enabled} onClick={() => setRules(old => old.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r))}><i/></button></div>)}{numberField("escalationAfterHours", "Default escalation window (hours)", 1, 168, "Reference setting for operational escalation windows.")}</section></div><div className="panel settings-panel"><div className="panel-heading"><div><h2>What these rules do</h2><p>Configured actions after saving.</p></div></div><ul className="reason-list"><li><CheckCircle2 size={14}/>New reports are assigned NORMAL or PRIORITY using the score threshold.</li><li><CheckCircle2 size={14}/>Possible clusters are grouped by symptom overlap and time/location match.</li><li><CheckCircle2 size={14}/>Unreviewed priority cases and overdue follow-ups can generate escalation alerts.</li><li><CheckCircle2 size={14}/>Vaccination due dates can trigger farmer reminders.</li></ul></div></div>;
}

function ReportWizard({ data, user, locale, online, onClose, onSubmit }: {
  data: AppData; user: DemoUser; locale: Locale; online: boolean; onClose: () => void; onSubmit: (input: ReportInput) => void;
}) {
  const animals = data.animals.filter((a) => a.farmerId === user.id);
  const [step, setStep] = useState(0);
  const [animalId, setAnimalId] = useState(animals[0]?.id || "");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().slice(0, 10));
  const [severity, setSeverity] = useState<Severity>("MEDIUM");
  const [mortality, setMortality] = useState(false);
  const [mortalityCount, setMortalityCount] = useState(1);
  const [location, setLocation] = useState(data.farms.find((f) => f.farmerId === user.id)?.village + ", Pune" || "");
  const [notes, setNotes] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [latitude, setLatitude] = useState<number | undefined>();
  const [longitude, setLongitude] = useState<number | undefined>();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const animal = animals.find((a) => a.id === animalId);
  const t = (key: string) => translate(locale, key);
  const toggleSymptom = (symptom: string) => setSymptoms((old) => old.includes(symptom) ? old.filter((x) => x !== symptom) : [...old, symptom]);
  const next = () => {
    setError("");
    if (step === 0 && (!animalId || symptoms.length === 0 || !onsetDate)) { setError("Select an animal, at least one symptom and the onset date."); return; }
    if (step === 1 && !location.trim()) { setError("Enter the approximate area or village."); return; }
    setStep((value) => Math.min(2, value + 1));
  };
  const captureLocation = () => {
    if (!navigator.geolocation) { setError("Location is not available on this device. Enter the village or area manually."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      // Round coordinates to roughly kilometre-level precision before local storage.
      setLatitude(Math.round(position.coords.latitude * 100) / 100);
      setLongitude(Math.round(position.coords.longitude * 100) / 100);
      setError("");
      if (!location.trim()) setLocation("Approximate device area");
    }, () => setError("Location permission was not granted. You can still submit using the approximate area."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  };
  const startVoice = () => {
    const browser = window as Window & { SpeechRecognition?: PashuSpeechRecognitionConstructor; webkitSpeechRecognition?: PashuSpeechRecognitionConstructor };
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Recognition) { setError("Voice dictation is not supported in this browser. You can type the observation instead."); return; }
    const recognition = new Recognition();
    recognition.lang = locale === "mr" ? "mr-IN" : locale === "hi" ? "hi-IN" : "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => { setListening(false); setError("Microphone input was unavailable. Check browser permission or type the observation."); };
    recognition.onresult = (event: PashuSpeechRecognitionResultEvent) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? "");
      if (transcript) {
        setVoiceTranscript((old) => [old, transcript].filter(Boolean).join(" "));
        setNotes((old) => [old, transcript].filter(Boolean).join(" "));
      }
    };
    try { recognition.start(); } catch { setListening(false); setError("Voice input could not start. Check microphone permission or type the observation."); }
  };
  const onPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (file.size > 8 * 1024 * 1024) { setError("Choose an image smaller than 8 MB. It will be compressed before saving."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const source = String(reader.result ?? "");
      const image = new window.Image();
      image.onload = () => {
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) { setError("Image compression is unavailable. Try another image."); return; }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.72);
        setPhotoDataUrl(compressed);
        setError("");
      };
      image.onerror = () => setError("Could not decode this image. Try another file.");
      image.src = source;
    };
    reader.onerror = () => setError("Could not read this image. Try another file.");
    reader.readAsDataURL(file);
  };
  return <Modal title={t("newReport")} description="Share a livestock health concern for veterinary review." onClose={onClose} wide>
    <div className="wizard-progress"><div className="wizard-steps">{[t("stepAnimal"), t("stepSeverity"), t("review")].map((label, i) => <div className={`wizard-step-label ${step === i ? "current" : step > i ? "done" : ""}`} key={label}><span>{step > i ? <Check size={13} /> : i + 1}</span>{label}</div>)}</div><div className="wizard-track"><i style={{ width: `${(step / 2) * 100}%` }} /></div></div>
    <AnimatePresence mode="wait"><motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.16 }} className="wizard-content">
      {step === 0 && <>
        <label className="form-field"><span>{t("animal")} <b>*</b></span><select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>{animals.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.tagId} · {a.species}</option>)}</select></label>
        <div className="form-field"><span>{t("symptoms")} <b>*</b></span><div className="symptom-options">{symptomsList.map((symptom) => <button type="button" key={symptom} className={`symptom-chip ${symptoms.includes(symptom) ? "selected" : ""}`} onClick={() => toggleSymptom(symptom)}>{symptoms.includes(symptom) && <Check size={13} />}{symptom}</button>)}</div><small>Select all that apply based on observation.</small></div>
        <label className="form-field"><span>{t("onset")} <b>*</b></span><input type="date" value={onsetDate} onChange={(e) => setOnsetDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} /></label>
      </>}
      {step === 1 && <>
        <div className="form-field"><span>{t("severity")} <b>*</b></span><div className="severity-options">{severityList.map((value) => <button key={value} type="button" className={`severity-option severity-${value.toLowerCase()} ${severity === value ? "selected" : ""}`} onClick={() => setSeverity(value)}><span>{titleCase(value)}</span><small>{value === "LOW" ? "Mild signs" : value === "MEDIUM" ? "Noticeable concern" : value === "HIGH" ? "Needs timely review" : "Urgent attention"}</small></button>)}</div></div>
        <div className="mortality-toggle"><div><strong>{t("mortality")}</strong><span>Only enable this when an animal death has been observed.</span></div><button type="button" className={`switch ${mortality ? "on" : ""}`} onClick={() => setMortality(!mortality)} aria-pressed={mortality}><i /></button></div>
        {mortality && <label className="form-field"><span>Number of animals affected</span><input type="number" min="1" max="999" value={mortalityCount} onChange={(e) => setMortalityCount(Math.max(1, Number(e.target.value)))} /></label>}
        <label className="form-field"><span>{t("location")} <b>*</b></span><div className="input-with-icon"><MapPin size={16} /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Pashan, Pune" /></div><small>Use a village or locality, not a household address.</small></label>
        <div className="location-tools"><button className="secondary-button small-button" type="button" onClick={captureLocation}><LocateFixed size={14} /> {t("gps")}</button>{latitude != null && longitude != null && <Pill tone="success">GPS captured · approximate</Pill>}</div>
        <label className="form-field"><span>{t("notes")} <em>Optional</em></span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Add relevant observations or context..." /></label>
        <div className="enhancement-input-grid"><div className="enhancement-input-card"><div className="enhancement-label"><Mic size={15} /> {t("voice")}</div><p>Dictate in English, Marathi or Hindi. Check the transcript before submission.</p><button type="button" className="secondary-button small-button" onClick={startVoice} disabled={listening}>{listening ? <><Activity size={14} /> Listening…</> : <><Mic size={14} /> Start dictation</>}</button>{voiceTranscript && <small className="transcript-preview">{voiceTranscript}</small>}</div><div className="enhancement-input-card"><div className="enhancement-label"><Camera size={15} /> {t("photo")}</div><p>Attach an optional supporting image (compressed before local storage).</p><label className="secondary-button small-button file-pick"><ImageIcon size={14} /> Choose image<input type="file" accept="image/*" capture="environment" onChange={(e) => onPhoto(e.target.files?.[0])} /></label>{photoDataUrl && <div className="photo-preview"><Image src={photoDataUrl} alt="Health report attachment preview" width={640} height={480} unoptimized /><button type="button" className="text-button" onClick={() => setPhotoDataUrl("")}>Remove</button></div>}</div></div>
      </>}
      {step === 2 && <>
        <div className="review-card"><div className="review-row"><span>Animal</span><strong>{animal?.name} · {animal?.tagId}</strong></div><div className="review-row"><span>Symptoms</span><strong>{symptoms.join(", ")}</strong></div><div className="review-row"><span>Onset date</span><strong>{dateLabel(onsetDate)}</strong></div><div className="review-row"><span>Severity</span><StatusPill status={severity} /></div><div className="review-row"><span>Mortality reported</span><strong>{mortality ? `Yes · ${mortalityCount}` : "No"}</strong></div><div className="review-row"><span>Area</span><strong>{location}</strong></div>{voiceTranscript && <div className="review-row"><span>Voice transcript</span><strong>{voiceTranscript}</strong></div>}{notes && <div className="review-row"><span>Observation</span><strong>{notes}</strong></div>}{photoDataUrl && <div className="review-row"><span>Photo evidence</span><strong>Attached</strong></div>}</div>
        <div className="safety-banner"><Info size={16} /><div><strong>What happens after submission?</strong><span>The system validates the report, assigns an illustrative preliminary priority, checks recent nearby reports and creates a veterinary case for review.</span></div></div>
        {!online && <div className="offline-save-banner"><CloudUpload size={16} /><span>{t("offlineQueued")}</span></div>}
      </>}
      {error && <div className="form-error"><AlertCircle size={15} />{error}</div>}
    </motion.div></AnimatePresence>
    <div className="modal-footer"><button className="secondary-button" onClick={() => step === 0 ? onClose() : setStep((value) => value - 1)}>{step === 0 ? "Cancel" : <><ChevronDown size={15} /> Back</>}</button>{step < 2 ? <button className="primary-button" onClick={next}>{t("continue")} <ArrowRight size={15} /></button> : <button className="primary-button" onClick={() => onSubmit({ animalId, symptoms, onsetDate, severity, mortality, mortalityCount: mortality ? mortalityCount : undefined, location, notes, latitude, longitude, photoDataUrl: photoDataUrl || undefined, voiceTranscript: voiceTranscript || undefined })}><FilePlus2 size={16} /> {t("submit")}</button>}</div>
  </Modal>;
}
function FarmModal({ initial, user, onClose, onSave }: { initial?: Farm; user: DemoUser; onClose: () => void; onSave: (farm: Farm) => void }) {
  const [name, setName] = useState(initial?.name || ""); const [village, setVillage] = useState(initial?.village || ""); const [district, setDistrict] = useState(initial?.district || ""); const [area, setArea] = useState(String(initial?.areaAcres ?? "")); const [latitude, setLatitude] = useState(initial?.latitude == null ? "" : String(initial.latitude)); const [longitude, setLongitude] = useState(initial?.longitude == null ? "" : String(initial.longitude)); const [error, setError] = useState(""); const [locating, setLocating] = useState(false);
  const captureLocation = () => { if (!navigator.geolocation) { setError("GPS is not supported by this browser."); return; } setLocating(true); navigator.geolocation.getCurrentPosition(pos => { setLatitude(pos.coords.latitude.toFixed(6)); setLongitude(pos.coords.longitude.toFixed(6)); setLocating(false); setError(""); }, () => { setLocating(false); setError("Location permission was denied or unavailable. Enter coordinates manually."); }, { enableHighAccuracy: false, timeout: 10000 }); };
  const save = () => { const n = Number(area); const lat = latitude.trim() ? Number(latitude) : undefined; const lng = longitude.trim() ? Number(longitude) : undefined; if (!name.trim() || !village.trim() || !district.trim() || !Number.isFinite(n) || n <= 0) { setError("Enter a farm name, village, district and valid area."); return; } if ((latitude.trim() && (lat == null || lat < -90 || lat > 90)) || (longitude.trim() && (lng == null || lng < -180 || lng > 180)) || (latitude.trim() !== longitude.trim())) { setError("Enter both valid GPS coordinates, or leave both blank."); return; } onSave({ id: initial?.id || `farm-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, farmerId: user.id, name: name.trim(), village: village.trim(), district: district.trim(), areaAcres: n, latitude: lat, longitude: lng }); };
  return <Modal title={initial ? "Edit farm" : "Register a farm"} description="Save farm identity, area and optional GPS coordinates." onClose={onClose}><div className="modal-form"><label className="form-field"><span>Farm name *</span><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Green Valley Farm"/></label><div className="form-grid-two"><label className="form-field"><span>Village / area *</span><input value={village} onChange={e => setVillage(e.target.value)} placeholder="Pashan"/></label><label className="form-field"><span>District *</span><input value={district} onChange={e => setDistrict(e.target.value)} placeholder="Pune"/></label></div><label className="form-field"><span>Farm area (acres) *</span><input type="number" min="0.1" step="0.1" value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. 4.5"/></label><div className="form-grid-two"><label className="form-field"><span>Latitude</span><input type="number" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="18.5…"/></label><label className="form-field"><span>Longitude</span><input type="number" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="73.8…"/></label></div><button className="secondary-button" type="button" onClick={captureLocation} disabled={locating}><LocateFixed size={15}/>{locating ? "Getting location…" : "Use current GPS location"}</button><small className="muted">GPS is optional. Use it only with explicit permission from the farmer; village/area is sufficient for a basic farm record.</small>{error && <div className="form-error">{error}</div>}</div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={save}><Save size={15}/> Save farm</button></div></Modal>;
}

function AnimalModal({ initial, farms, user, onClose, onSave }: { initial?: Animal; farms: AppData["farms"]; user: DemoUser; onClose: () => void; onSave: (animal: Animal) => void }) {
  const [name, setName] = useState(initial?.name || ""); const [tagId, setTagId] = useState(initial?.tagId || ""); const [species, setSpecies] = useState<Animal["species"]>(initial?.species || "Cattle"); const [breed, setBreed] = useState(initial?.breed || ""); const [sex, setSex] = useState<Animal["sex"]>(initial?.sex || "Female"); const [age, setAge] = useState(initial?.ageYears || 2); const [farmId, setFarmId] = useState(initial?.farmId || farms.find((f) => f.farmerId === user.id)?.id || ""); const [notes, setNotes] = useState(initial?.notes || ""); const [photoDataUrl, setPhotoDataUrl] = useState(initial?.photoDataUrl || ""); const [error, setError] = useState("");
  const onPhoto = (file?: File) => { if (!file) return; if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; } if (file.size > 8 * 1024 * 1024) { setError("Choose an image smaller than 8 MB."); return; } const reader = new FileReader(); reader.onload = () => { const image = new window.Image(); image.onload = () => { const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight)); const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale)); const context = canvas.getContext("2d"); if (!context) { setError("Could not process this image."); return; } context.drawImage(image, 0, 0, canvas.width, canvas.height); setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.72)); setError(""); }; image.onerror = () => setError("This image could not be opened."); image.src = String(reader.result); }; reader.readAsDataURL(file); };
  const save = () => { if (!name.trim() || !tagId.trim() || !breed.trim() || !farmId) { setError("Name, animal tag, breed and farm are required."); return; } onSave({ id: initial?.id || `animal-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, farmId, farmerId: user.id, name: name.trim(), tagId: tagId.trim(), species, breed: breed.trim(), sex, ageYears: age, healthStatus: initial?.healthStatus || "Healthy", notes, photoDataUrl: photoDataUrl || undefined, createdAt: initial?.createdAt || new Date().toISOString() }); };
  return <Modal title={initial ? "Edit animal profile" : "Add livestock"} description="Maintain the basic identity and farm details for an animal." onClose={onClose}><div className="modal-form"><div className="form-grid-two"><label className="form-field"><span>Animal name <b>*</b></span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gauri" /></label><label className="form-field"><span>Animal tag <b>*</b></span><input value={tagId} onChange={(e) => setTagId(e.target.value)} placeholder="MH-PUN-007" /></label><label className="form-field"><span>Species</span><select value={species} onChange={(e) => setSpecies(e.target.value as Animal["species"])}>{["Cattle", "Buffalo", "Goat", "Sheep"].map((s) => <option key={s}>{s}</option>)}</select></label><label className="form-field"><span>Breed <b>*</b></span><input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Gir" /></label><label className="form-field"><span>Sex</span><select value={sex} onChange={(e) => setSex(e.target.value as Animal["sex"])}><option>Female</option><option>Male</option></select></label><label className="form-field"><span>Age (years)</span><input type="number" min="0" max="40" value={age} onChange={(e) => setAge(Number(e.target.value))} /></label></div><label className="form-field"><span>Farm</span><select value={farmId} onChange={(e) => setFarmId(e.target.value)}>{farms.filter((f) => f.farmerId === user.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="form-field"><span>Notes</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional animal notes" /></label><div className="form-field"><span>Animal photo</span><label className="secondary-button small-button file-pick"><ImageIcon size={14}/> {photoDataUrl ? "Replace photo" : "Choose photo"}<input type="file" accept="image/*" capture="environment" onChange={e => onPhoto(e.target.files?.[0])}/></label>{photoDataUrl && <div className="photo-preview"><Image src={photoDataUrl} alt="Animal profile preview" width={640} height={480} unoptimized /><button type="button" className="text-button" onClick={() => setPhotoDataUrl("")}>Remove</button></div>}</div>{error && <div className="form-error">{error}</div>}</div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={save}><Save size={15} /> Save animal</button></div></Modal>;
}

function CaseDetailModal({ item, data, onClose, onSave }: { item: VeterinaryCase; data: AppData; onClose: () => void; onSave: (input: { assessment: string; treatment: string; recommendation: string; status: CaseStatus; followUpRequired: boolean; followUpDate?: string; followUpNotes: string; addVaccination: boolean; vaccineName: string; vaccineDue: string; veterinarianId: string }) => void }) {
  const report = data.reports.find((r) => r.id === item.reportId); const animal = data.animals.find((a) => a.id === item.animalId); const farmer = data.users.find((u) => u.id === item.farmerId); const farm = data.farms.find((f) => f.id === animal?.farmId); const cluster = report?.clusterId ? data.clusters.find((c) => c.id === report.clusterId) : undefined;
  const [assessment, setAssessment] = useState(item.assessment); const [treatment, setTreatment] = useState(item.treatment); const [veterinarianId, setVeterinarianId] = useState(item.veterinarianId); const [recommendation, setRecommendation] = useState(item.recommendation); const [status, setStatus] = useState<CaseStatus>(item.status); const [followUpRequired, setFollowUpRequired] = useState(item.followUpRequired); const [followUpDate, setFollowUpDate] = useState(item.followUpDate || ""); const [followUpNotes, setFollowUpNotes] = useState(item.followUpNotes); const [addVaccination, setAddVaccination] = useState(false); const [vaccineName, setVaccineName] = useState(""); const [vaccineDue, setVaccineDue] = useState(""); const [error, setError] = useState("");
  return <Modal title={`Veterinary case · ${item.id}`} description={`${animal?.name || "Animal"} · ${farmer?.name || "Farmer"} · ${farm?.village || report?.location || "Location"}`} onClose={onClose} wide><div className="case-detail-layout"><div className="case-context"><div className="case-detail-section"><div className="case-detail-head"><h3>Health report</h3><PriorityPill priority={item.priority} /></div><div className="context-id">{report?.id || item.reportId}</div><div className="context-line"><span>Animal</span><strong>{animal?.name} · {animal?.tagId}</strong></div><div className="context-line"><span>Reported</span><strong>{dateLabel(report?.submittedAt)}</strong></div><div className="context-line"><span>Onset</span><strong>{dateLabel(report?.onsetDate)}</strong></div><div className="context-line"><span>Area</span><strong>{report?.location}</strong></div><div className="context-line"><span>Severity</span><StatusPill status={report?.severity || "MEDIUM"} /></div><div className="context-line"><span>Mortality</span><strong>{report?.mortality ? `Yes · ${report.mortalityCount || 1}` : "No"}</strong></div><div className="symptom-cloud">{(report?.symptoms || []).map((s) => <Pill key={s} tone="info">{s}</Pill>)}</div>{report?.notes && <p className="context-note">{report.notes}</p>}{report?.voiceTranscript && <div className="context-note"><strong>Voice transcript:</strong> {report.voiceTranscript}</div>}{report?.photoDataUrl && <div className="case-photo-evidence"><span>Attached photo evidence</span><Image src={report.photoDataUrl} alt="Farmer attached evidence" width={640} height={480} unoptimized /></div>}</div><div className="case-detail-section"><h3>Animal history</h3><div className="history-list">{data.healthRecords.filter((h) => h.animalId === item.animalId).slice(0, 4).map((h) => <div className="history-item" key={h.id}><span>{shortDate(h.date)}</span><div><strong>{h.type}</strong><p>{h.notes}</p></div></div>)}{data.healthRecords.filter((h) => h.animalId === item.animalId).length === 0 && <span className="muted small">No previous health records.</span>}</div><h3 className="subheading">Vaccination history</h3>{data.vaccinations.filter((v) => v.animalId === item.animalId).map((v) => <div className="vaccine-history-line" key={v.id}><Syringe size={14} /><span>{v.vaccineName}</span><small>{dateLabel(v.administeredOn)}</small></div>)}</div><div className="case-detail-section risk-detail"><div className="case-detail-head"><h3>Preliminary risk assessment</h3><Pill tone={report?.assessment.riskLevel === "CRITICAL" || report?.assessment.riskLevel === "HIGH" ? "warning" : "info"}>{titleCase(report?.assessment.riskLevel || "LOW")}</Pill></div><div className="risk-meter"><div><strong>{report?.assessment.score ?? 0}</strong><span>/ 100 illustrative score</span></div><div className="risk-track"><i style={{ width: `${report?.assessment.score || 0}%` }} /></div></div><ul className="reason-list">{(report?.assessment.reasons || []).map((r) => <li key={r}><CheckCircle2 size={14} />{r}</li>)}</ul>{cluster && <div className="cluster-evidence"><strong><ScanSearch size={14} /> {cluster.id} · Possible cluster</strong><span>{cluster.reportIds.length} supporting reports · {cluster.area}</span></div>}<div className="disclaimer"><Info size={14} />Preliminary decision support only. Not a confirmed diagnosis or outbreak.</div></div></div>
    <div className="case-action-column"><div className="case-detail-section"><h3>Case assignment</h3><label className="form-field"><span>Assigned veterinarian</span><select value={veterinarianId} onChange={e => setVeterinarianId(e.target.value)}>{data.users.filter(u => u.role === "VETERINARIAN").map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label><p className="status-hint">Assignment choices come from the approved veterinarian directory in this Firebase project.</p></div><div className="case-detail-section"><div className="case-detail-head"><h3>Veterinary assessment</h3><Pill tone="success">Professional input</Pill></div><label className="form-field"><span>Clinical assessment</span><textarea rows={3} value={assessment} onChange={(e) => setAssessment(e.target.value)} placeholder="Record your professional assessment..." /></label><label className="form-field"><span>Treatment / action taken</span><textarea rows={3} value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="Record treatment or actions taken..." /></label><label className="form-field"><span>Recommendation for farmer</span><textarea rows={3} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="Add instructions or recommendations..." /></label></div><div className="case-detail-section"><h3>Follow-up plan</h3><div className="mortality-toggle"><div><strong>Follow-up required</strong><span>Schedule another review if needed.</span></div><button type="button" className={`switch ${followUpRequired ? "on" : ""}`} onClick={() => setFollowUpRequired(!followUpRequired)} aria-pressed={followUpRequired}><i /></button></div>{followUpRequired && <><label className="form-field"><span>Follow-up date</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></label><label className="form-field"><span>Follow-up notes</span><textarea rows={2} value={followUpNotes} onChange={(e) => setFollowUpNotes(e.target.value)} placeholder="What should be reviewed next?" /></label></>}</div><div className="case-detail-section"><h3>Vaccination update <em>Optional</em></h3><div className="mortality-toggle"><div><strong>Record a vaccination</strong><span>Use when relevant to this case.</span></div><button type="button" className={`switch ${addVaccination ? "on" : ""}`} onClick={() => setAddVaccination(!addVaccination)} aria-pressed={addVaccination}><i /></button></div>{addVaccination && <><label className="form-field"><span>Vaccine name</span><input value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} placeholder="Vaccine name" /></label><label className="form-field"><span>Next due date</span><input type="date" value={vaccineDue} onChange={(e) => setVaccineDue(e.target.value)} /></label></>}</div><div className="case-detail-section status-section"><label className="form-field"><span>Case status</span><select value={status} onChange={(e) => setStatus(e.target.value as CaseStatus)}><option value="OPEN">Open</option><option value="IN_PROGRESS">In progress</option><option value="CLOSED">Closed</option></select></label>{error && <div className="form-error">{error}</div>}<p className="status-hint">Saving will create an in-app case update for the farmer.</p></div></div></div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Close</button><button className="primary-button" onClick={() => { if (followUpRequired && !followUpDate) { setError("Choose a follow-up date or turn off follow-up."); return; } if (addVaccination && !vaccineName.trim()) { setError("Enter the vaccine name."); return; } onSave({ assessment, treatment, recommendation, status, followUpRequired, followUpDate: followUpRequired ? followUpDate : undefined, followUpNotes, addVaccination, vaccineName, vaccineDue, veterinarianId }); }}><Save size={15} /> Save case update</button></div></Modal>;
}

function ReportDetailModal({ report, data, onClose }: { report: HealthReport; data: AppData; onClose: () => void }) {
  const animal = data.animals.find((a) => a.id === report.animalId); const item = data.cases.find((c) => c.id === report.caseId);
  return <Modal title={`Health report · ${report.id}`} description={`${animal?.name || "Animal"} · ${animal?.tagId || ""}`} onClose={onClose}><div className="report-detail-content"><div className="report-detail-top"><PriorityPill priority={report.assessment.priority} /><StatusPill status={report.status} /></div><div className="review-card"><div className="review-row"><span>Animal</span><strong>{animal?.name} · {animal?.species}</strong></div><div className="review-row"><span>Symptoms</span><strong>{report.symptoms.join(", ")}</strong></div><div className="review-row"><span>Severity</span><strong>{titleCase(report.severity)}</strong></div><div className="review-row"><span>Onset date</span><strong>{dateLabel(report.onsetDate)}</strong></div><div className="review-row"><span>Location</span><strong>{report.location}</strong></div><div className="review-row"><span>Submitted</span><strong>{dateLabel(report.submittedAt)}</strong></div><div className="review-row"><span>Veterinary case</span><strong>{item?.id || report.caseId}</strong></div>{item && <div className="review-row"><span>Case status</span><strong>{titleCase(item.status)}</strong></div>}</div>{report.photoDataUrl && <div className="report-attachment"><div className="enhancement-label"><ImageIcon size={15}/> Attached photo evidence</div><Image src={report.photoDataUrl} alt="Photo evidence attached to health report" width={640} height={480} unoptimized /></div>}{report.voiceTranscript && <div className="risk-detail-card"><strong>Voice transcript</strong><p>{report.voiceTranscript}</p></div>}<div className="risk-detail-card"><div className="case-detail-head"><strong>Preliminary assessment</strong><Pill tone="warning">{titleCase(report.assessment.riskLevel)}</Pill></div><p>Illustrative score: {report.assessment.score}/100</p><ul className="reason-list">{report.assessment.reasons.map((r) => <li key={r}><CheckCircle2 size={14} />{r}</li>)}</ul></div><div className="safety-banner"><Info size={15} /><div><strong>Decision-support output</strong><span>This result is not a confirmed diagnosis. A veterinarian reviews the report before clinical decisions are made.</span></div></div></div><div className="modal-footer"><button className="primary-button" onClick={onClose}>Done</button></div></Modal>;
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <motion.div className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><CheckCircle2 size={17} /><span>{message}</span><button onClick={onClose}><X size={14} /></button></motion.div>;
}

function mergeOfflineWorkspace(remote: AppData, local: AppData): AppData {
  const mergeById = <T extends { id: string }>(cloudRows: T[], localRows: T[]): T[] => {
    const merged = new Map<string, T>();
    cloudRows.forEach((row) => merged.set(row.id, row));
    localRows.forEach((row) => merged.set(row.id, row));
    return Array.from(merged.values());
  };
  return {
    ...remote,
    users: mergeById(remote.users, local.users),
    farms: mergeById(remote.farms, local.farms),
    animals: mergeById(remote.animals, local.animals),
    reports: mergeById(remote.reports, local.reports),
    clusters: mergeById(remote.clusters, local.clusters),
    cases: mergeById(remote.cases, local.cases),
    vaccinations: mergeById(remote.vaccinations, local.vaccinations),
    healthRecords: mergeById(remote.healthRecords, local.healthRecords),
    alerts: mergeById(remote.alerts, local.alerts),
    cropPlans: mergeById(remote.cropPlans, local.cropPlans),
    auditLogs: mergeById(remote.auditLogs, local.auditLogs),
    pendingReports: mergeById(remote.pendingReports, local.pendingReports),
    surveillanceSettings: local.surveillanceSettings || remote.surveillanceSettings,
    escalationRules: local.escalationRules?.length ? local.escalationRules : remote.escalationRules,
    counters: {
      report: Math.max(remote.counters.report, local.counters.report),
      case: Math.max(remote.counters.case, local.counters.case),
      alert: Math.max(remote.counters.alert, local.counters.alert),
      animal: Math.max(remote.counters.animal, local.counters.animal),
      vaccine: Math.max(remote.counters.vaccine, local.counters.vaccine),
    },
  };
}

export default function PashuCareApp() {
  const initial = useMemo(() => createSeedData(), []);
  const [data, setData] = useState<AppData>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [authReady, setAuthReady] = useState(!firebaseConfigured);
  const [activeUser, setActiveUser] = useState<DemoUser | null>(null);
  const [cloudUid, setCloudUid] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"local" | "syncing" | "synced" | "offline" | "error">(firebaseConfigured ? "offline" : "local");
  const [syncRetry, setSyncRetry] = useState(0);
  const [page, setPage] = useState("overview");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<"report" | "animal" | "animal-profile" | "case" | "report-detail" | "vaccination" | "farm" | null>(null);
  const [locale, setLocale] = useState<Locale>("en");
  const [remindersProcessed, setRemindersProcessed] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">("default");
  const knownAlertIds = useRef<Set<string>>(new Set());
  const alertBaselineReady = useRef(false);
  const [selectedId, setSelectedId] = useState("");
  const [toast, setToast] = useState("");
  const [googleAuthError, setGoogleAuthError] = useState("");
  const [online, setOnline] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const authUserRef = useRef<FirebaseUser | null>(null);
  const cloudBaseRef = useRef<AppData | null>(null);
  const cloudSyncBusy = useRef(false);
  const cloudWorkspaceLoading = useRef(false);
  const syncAttemptRef = useRef(0);
  const syncRetryTimerRef = useRef<number | null>(null);
  const writerIdRef = useRef(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `writer-${Date.now()}`);
  const cloudLoadSequence = useRef(0);

  useEffect(() => () => { if (syncRetryTimerRef.current) window.clearTimeout(syncRetryTimerRef.current); }, []);

  // Keep navigation predictable on phones and close the More sheet with Escape.
  useEffect(() => {
    const closeMenuOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileMenuOpen(false); };
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => window.removeEventListener("keydown", closeMenuOnEscape);
  }, []);

  useEffect(() => {
    const mainScroller = document.querySelector<HTMLElement>(".main-scroll");
    mainScroller?.scrollTo({ top: 0, behavior: "auto" });
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [page]);

  useEffect(() => {
    setOnline(navigator.onLine);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onlineHandler = () => { setOnline(true); setSyncRetry((value) => value + 1); };
    const offlineHandler = () => setOnline(false);
    const installHandler = (event: Event) => { event.preventDefault(); setInstallEvent(event as BeforeInstallPromptEvent); setCanInstall(true); };
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    window.addEventListener("beforeinstallprompt", installHandler);

    if (!firebaseConfigured) {
      const fallback = createSeedData();
      setData(loadDemoData(fallback, "demo"));
      setHydrated(true);
      setAuthReady(true);
      return () => {
        window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", offlineHandler); window.removeEventListener("beforeinstallprompt", installHandler);
      };
    }

    let disposed = false;
    // Consume the OAuth redirect result once at app startup, before routing to the signed-in shell.
    void completeGoogleRedirectFirebase().catch((cause) => { if (!disposed) setGoogleAuthError(friendlyFirebaseAuthError(cause)); });
    const unsubscribe = subscribeAuth(async (firebaseUser) => {
      authUserRef.current = firebaseUser;
      if (firebaseUser) setGoogleAuthError("");
      cloudLoadSequence.current += 1;
      const sequence = cloudLoadSequence.current;
      if (!firebaseUser) {
        cloudBaseRef.current = null;
        setCloudUid(null);
        setActiveUser(null);
        setData(createSeedData());
        setSyncState("offline");
        setHydrated(true);
        setAuthReady(true);
        return;
      }
      setAuthReady(false);
      setSyncState(navigator.onLine ? "syncing" : "offline");
      try {
        const [role, displayName] = await Promise.all([getAuthenticatedRole(firebaseUser), getFirebaseDisplayName(firebaseUser)]);
        const identity: DemoUser = { id: firebaseUser.uid, name: displayName, email: firebaseUser.email || "", role };
        let workspace: AppData;
        let loadedFromCloud = true;
        try {
          workspace = await initializeWorkspaceIfEmpty(firebaseUser.uid, identity);
        } catch {
          // Open only this account's saved cache (or a clean workspace) while offline.
          loadedFromCloud = false;
          workspace = loadDemoData(createEmptyWorkspace(identity), firebaseUser.uid);
          if (!workspace.users.some((item) => item.id === firebaseUser.uid)) workspace.users = [identity, ...workspace.users];
          setSyncState("offline");
          setToast("Offline mode: your device copy is available. Changes will sync after reconnecting.");
        }
        if (disposed || sequence !== cloudLoadSequence.current) return;
        cloudBaseRef.current = loadedFromCloud ? workspace : null;
        setData(workspace);
        setCloudUid(firebaseUser.uid);
        setActiveUser(workspace.users.find((item) => item.id === firebaseUser.uid) || identity);
        setPage("overview");
        setQuery("");
        setHydrated(true);
        setAuthReady(true);
        if (loadedFromCloud && navigator.onLine) setSyncState("synced");
        else if (!navigator.onLine) setSyncState("offline");
      } catch (error) {
        if (disposed || sequence !== cloudLoadSequence.current) return;
        setAuthReady(true);
        setHydrated(true);
        setSyncState("error");
        setToast(error instanceof Error ? error.message : "Could not load your Firebase workspace.");
      }
    }, (error) => {
      if (disposed) return;
      setAuthReady(true); setHydrated(true); setSyncState("error");
      setToast(error.message || "Firebase Authentication could not be initialized.");
    });
    return () => {
      disposed = true; unsubscribe();
      window.removeEventListener("online", onlineHandler); window.removeEventListener("offline", offlineHandler); window.removeEventListener("beforeinstallprompt", installHandler);
    };
  }, []);

  useEffect(() => { if (hydrated) saveDemoData(data, cloudUid || "demo"); }, [data, hydrated, cloudUid]);

  useEffect(() => {
    if (!cloudUid || !hydrated || !online || cloudWorkspaceLoading.current || !activeUser) return;
    if (cloudBaseRef.current && syncRetry === 0) return;
    let disposed = false;
    cloudWorkspaceLoading.current = true;
    setSyncState("syncing");
    void initializeWorkspaceIfEmpty(cloudUid, activeUser).then((remote) => {
      if (disposed) return;
      cloudBaseRef.current = remote;
      setData((local) => mergeOfflineWorkspace(remote, local));
      setSyncState("synced");
      syncAttemptRef.current = 0;
    }).catch(() => {
      if (disposed) return;
      setSyncState(navigator.onLine ? "error" : "offline");
      if (syncRetryTimerRef.current) window.clearTimeout(syncRetryTimerRef.current);
      syncRetryTimerRef.current = window.setTimeout(() => setSyncRetry((value) => value + 1), 10000);
    }).finally(() => { cloudWorkspaceLoading.current = false; });
    return () => { disposed = true; };
  }, [cloudUid, hydrated, online, activeUser, syncRetry]);

  useEffect(() => {
    if (!cloudUid || !hydrated || !activeUser) return;
    const unsubscribe = subscribeWorkspace(cloudUid, activeUser, async (remoteWriterId) => {
      if (!remoteWriterId || remoteWriterId === writerIdRef.current) return;
      const sequence = ++cloudLoadSequence.current;
      setSyncState("syncing");
      try {
        const identity = activeUser;
        if (!identity) return;
        const latest = await loadFirebaseWorkspace(cloudUid, identity);
        if (sequence !== cloudLoadSequence.current) return;
        cloudBaseRef.current = latest;
        setData(current => mergeOfflineWorkspace(latest, current));
        setSyncState("synced");
      } catch {
        setSyncState(navigator.onLine ? "error" : "offline");
      }
    }, () => setSyncState(navigator.onLine ? "error" : "offline"));
    return () => unsubscribe();
  }, [cloudUid, hydrated, activeUser]);

  useEffect(() => {
    if (!cloudUid || !hydrated) { if (!firebaseConfigured) setSyncState("local"); return; }
    if (!online) { setSyncState("offline"); return; }
    if (!cloudBaseRef.current || JSON.stringify(cloudBaseRef.current) === JSON.stringify(data)) return;
    const snapshot = data;
    const previous = cloudBaseRef.current;
    const timer = window.setTimeout(async () => {
      if (cloudSyncBusy.current) {
        if (syncRetryTimerRef.current) window.clearTimeout(syncRetryTimerRef.current);
        syncRetryTimerRef.current = window.setTimeout(() => setSyncRetry((value) => value + 1), 1500);
        return;
      }
      cloudSyncBusy.current = true;
      setSyncState("syncing");
      try {
        const normalized = await saveFirebaseWorkspace(cloudUid, previous, snapshot, writerIdRef.current);
        cloudBaseRef.current = normalized;
        setData(current => {
          const animalUrls = new Map(normalized.animals.map(item => [item.id, item.photoDataUrl]));
          const reportUrls = new Map(normalized.reports.map(item => [item.id, item.photoDataUrl]));
          return {
            ...current,
            animals: current.animals.map(item => item.photoDataUrl?.startsWith("data:image/") && animalUrls.get(item.id) ? { ...item, photoDataUrl: animalUrls.get(item.id) } : item),
            reports: current.reports.map(item => item.photoDataUrl?.startsWith("data:image/") && reportUrls.get(item.id) ? { ...item, photoDataUrl: reportUrls.get(item.id) } : item),
          };
        });
        setSyncState("synced");
        syncAttemptRef.current = 0;
        if (syncRetryTimerRef.current) window.clearTimeout(syncRetryTimerRef.current);
      } catch (error) {
        setSyncState(navigator.onLine ? "error" : "offline");
        setToast(error instanceof Error ? `Cloud sync paused: ${error.message}` : "Cloud sync paused. Changes remain on this device and will retry.");
        if (navigator.onLine) {
          const delay = Math.min(60000, 5000 * (2 ** Math.min(syncAttemptRef.current, 3)));
          syncAttemptRef.current += 1;
          if (syncRetryTimerRef.current) window.clearTimeout(syncRetryTimerRef.current);
          syncRetryTimerRef.current = window.setTimeout(() => setSyncRetry((value) => value + 1), delay);
        }
      } finally { cloudSyncBusy.current = false; }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [data, cloudUid, hydrated, online, syncRetry]);

  useEffect(() => {
    if (!hydrated || remindersProcessed) return;
    setData(current => processRemindersAndEscalations(current));
    setRemindersProcessed(true);
  }, [hydrated, remindersProcessed]);

  useEffect(() => {
    if (!hydrated || !online || data.pendingReports.length === 0) return;
    const count = data.pendingReports.length;
    setData(current => applyQueuedReports(current, (snapshot, farmer, queued) => createReportInData(snapshot, farmer, queued.payload)));
    setToast(`${count} queued report${count === 1 ? "" : "s"} processed after reconnecting.`);
  }, [hydrated, online, data.pendingReports.length]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(""), 4800); return () => window.clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) { setNotificationPermission("unsupported"); return; }
    setNotificationPermission(Notification.permission);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    if (!alertBaselineReady.current) { data.alerts.forEach(a => knownAlertIds.current.add(a.id)); alertBaselineReady.current = true; return; }
    const fresh = data.alerts.filter(a => !knownAlertIds.current.has(a.id));
    fresh.forEach(a => {
      knownAlertIds.current.add(a.id);
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker?.ready.then(reg => reg.showNotification(a.title, { body: a.message, icon: "/icon-192.png", badge: "/icon-192.png", tag: a.id, data: { url: "/" } })).catch(() => undefined);
      }
    });
  }, [data.alerts, hydrated]);

  const user = activeUser ? data.users.find((u) => u.id === activeUser.id) || activeUser : null;
  const role = user?.role;
  const farmerAlerts = user ? data.alerts.filter((a) => a.recipientId === user.id && !a.readAt).length : 0;
  const openCase = (id: string) => { setSelectedId(id); setModal("case"); };
  const openReport = (id: string) => { setSelectedId(id); setModal("report-detail"); };
  const login = (selectedRole: Role) => { const found = data.users.find((u) => u.role === selectedRole); if (found) { setActiveUser(found); setData(current => audit(current, found, "DEMO_LOGIN", "Session", found.id, `Entered the ${selectedRole.toLowerCase()} demonstration workspace.`)); setPage("overview"); setQuery(""); } };
  const switchRole = (selectedRole: Role) => { login(selectedRole); setToast(`Switched to ${selectedRole === "FARMER" ? "Farmer" : "Veterinarian"} demo workspace`); };
  const logout = () => {
    if (cloudUid) { void signOutFirebase().catch(error => setToast(error instanceof Error ? error.message : "Sign out failed.")); }
    else setActiveUser(null);
    setPage("overview"); setQuery(""); setMobileMenuOpen(false);
  };
  const resetDemo = () => { const fresh = createSeedData(); setData(fresh); clearDemoData(); if (user) setActiveUser(fresh.users.find((u) => u.id === user.id) || null); setToast("Demo data has been reset"); };
  const install = async () => { if (!installEvent) { setToast("Use your browser menu and choose Install app or Add to Home screen"); return; } installEvent.prompt(); try { await installEvent.userChoice; } finally { setInstallEvent(null); setCanInstall(false); } };

  const submitReport = (input: ReportInput) => {
    if (!user || user.role !== "FARMER") return;
    if (!input.animalId || !input.symptoms.length || !input.onsetDate || !input.location.trim()) { setToast("Complete the required report fields before submitting."); return; }
    if (!online) {
      setData(current => queueReport(current, user, input));
      setModal(null); setPage("offline"); setToast(translate(locale, "offlineQueued")); return;
    }
    setData(current => createReportInData(current, user, input));
    setModal(null); setPage("reports"); setToast("Health report submitted and a veterinary case was created.");
  };

  const saveCase = (input: { assessment: string; treatment: string; recommendation: string; status: CaseStatus; followUpRequired: boolean; followUpDate?: string; followUpNotes: string; addVaccination: boolean; vaccineName: string; vaccineDue: string; veterinarianId: string }) => {
    if (!user || user.role !== "VETERINARIAN") { setToast("Only the Veterinarian demo workspace can update a case in this prototype."); return; }
    const currentCase = data.cases.find(c => c.id === selectedId);
    if (!currentCase) return;
    if (input.followUpRequired && !input.followUpDate) { setToast("Choose a follow-up date before saving."); return; }
    setData(current => updateCaseInData(current, user, { ...input, caseId: selectedId }));
    setModal(null); setToast(`${selectedId} updated. Farmer notification created.`);
  };

  const addAnimal = (animal: Animal) => {
    if (!user || user.role !== "FARMER") return;
    if (!data.farms.some(f => f.id === animal.farmId && f.farmerId === user.id)) { setToast("Choose one of your registered farms."); return; }
    if (data.animals.some(a => a.tagId.toLowerCase() === animal.tagId.toLowerCase() && a.id !== animal.id)) { setToast("That animal tag is already in use. Enter a unique tag ID."); return; }
    const existed = data.animals.some(a => a.id === animal.id && a.farmerId === user.id);
    setData(current => {
      const updated = { ...current, animals: existed ? current.animals.map(a => a.id === animal.id ? animal : a) : [animal, ...current.animals], counters: { ...current.counters, animal: current.counters.animal + (existed ? 0 : 1) } };
      return audit(updated, user, existed ? "ANIMAL_UPDATED" : "ANIMAL_CREATED", "Animal", animal.id, `${animal.name} (${animal.tagId}) ${existed ? "profile updated" : "registered"}.`);
    });
    setModal(null); setToast(existed ? `${animal.name} profile updated` : `${animal.name} added to your livestock`);
  };
  const saveFarm = (farm: Farm) => {
    if (!user || user.role !== "FARMER") return;
    if (farm.farmerId !== user.id) { setToast("You can only manage your own farm records."); return; }
    const existed = data.farms.some(f => f.id === farm.id && f.farmerId === user.id);
    setData(current => audit({ ...current, farms: existed ? current.farms.map(f => f.id === farm.id ? farm : f) : [farm, ...current.farms] }, user, existed ? "FARM_UPDATED" : "FARM_CREATED", "Farm", farm.id, `${farm.name} ${existed ? "updated" : "registered"}.`));
    setModal(null); setToast(existed ? "Farm details updated" : "Farm registered");
  };
  const saveProfile = (profile: { name: string; email: string; phone: string }) => {
    if (!user) return;
    setData(current => audit({ ...current, users: current.users.map(u => u.id === user.id ? { ...u, ...profile } : u) }, user, "PROFILE_UPDATED", "User", user.id, "Updated account profile details."));
    setActiveUser(current => current ? { ...current, name: profile.name, email: profile.email, phone: profile.phone } : current);
    if (authUserRef.current && cloudUid) void updateFirebaseProfile(authUserRef.current, profile.name, profile.phone).then(() => setToast("Profile updated and synced to your Firebase account.")).catch(() => setToast("Profile saved locally. Firebase profile update will need a retry."));
    else setToast("Profile details saved on this device.");
  };
  const saveVaccination = (vaccine: { id?: string; animalId: string; vaccineName: string; administeredOn: string; dueOn: string; notes: string; status: Vaccination["status"] }) => {
    if (!user || user.role !== "VETERINARIAN") return;
    const id = vaccine.id || `VAC-${user?.id || "vet"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const record: Vaccination = {
      id,
      animalId: vaccine.animalId,
      vaccineName: vaccine.vaccineName,
      administeredOn: vaccine.administeredOn,
      dueOn: vaccine.dueOn,
      notes: vaccine.notes,
      status: vaccine.status,
      administeredBy: vaccine.status === "COMPLETED" ? user.name : undefined,
    };
    const existed = data.vaccinations.some(v => v.id === id);
    setData(current => audit({ ...current, vaccinations: existed ? current.vaccinations.map(v => v.id === id ? { ...v, ...record } : v) : [record, ...current.vaccinations], counters: { ...current.counters, vaccine: current.counters.vaccine + (existed ? 0 : 1) } }, user, existed ? "VACCINATION_UPDATED" : "VACCINATION_RECORDED", "Vaccination", id, `${vaccine.vaccineName} ${existed ? "updated" : "recorded"} for animal ${vaccine.animalId}.`));
    setModal(null); setToast(existed ? "Vaccination record updated" : "Vaccination record saved");
  };

  const readAlert = (id: string) => setData((current) => ({ ...current, alerts: current.alerts.map((a) => a.id === id ? { ...a, readAt: new Date().toISOString() } : a) }));
  const enableBrowserNotifications = async () => {
    if (!("Notification" in window)) { setNotificationPermission("unsupported"); setToast("This browser does not support browser notifications."); return; }
    if (Notification.permission === "denied") { setToast("Allow notifications in your browser site settings, then return and tap Check again."); return; }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      setToast(permission === "granted" ? "Browser notifications enabled on this device." : "Permission was not granted. In-app alerts remain available.");
    } catch { setToast("The browser could not open the notification permission prompt. Check site settings."); }
  };
  const saveCropPlan = (plan: CropRotationPlan) => { if (!user) return; setData(current => audit({ ...current, cropPlans: [plan, ...current.cropPlans] }, user, "CROP_PLAN_CREATED", "CropRotationPlan", plan.id, `Saved crop rotation plan for ${plan.fieldName}.`)); setToast("Crop rotation plan saved"); };
  const reviewCluster = (clusterId: string) => { if (!user || user.role !== "VETERINARIAN") return; setData(current => audit({ ...current, clusters: current.clusters.map(c => c.id === clusterId ? { ...c, status: "REVIEWED" } : c) }, user, "CLUSTER_REVIEWED", "PossibleCluster", clusterId, "Marked possible cluster as reviewed by the veterinary workspace.")); setToast(`${clusterId} marked as reviewed.`); };
  const saveRules = (settings: AppData["surveillanceSettings"], rules: AppData["escalationRules"]) => { if (!user || user.role !== "VETERINARIAN") return; setData(current => audit({ ...current, surveillanceSettings: settings, escalationRules: rules }, user, "SURVEILLANCE_RULES_UPDATED", "SurveillanceSettings", "GLOBAL", "Updated demonstration surveillance thresholds and escalation rules.")); setToast("Surveillance rules saved. New reports will use the updated settings."); };
  const syncQueued = () => { if (!online) { setToast("Reconnect to sync offline reports."); return; } if (!data.pendingReports.length) { setToast("No reports are waiting to sync."); return; } const count = data.pendingReports.length; setData(current => applyQueuedReports(current, (snapshot, farmer, queued) => createReportInData(snapshot, farmer, queued.payload))); setToast(`${count} queued report(s) processed.`); };
  const removePending = (id: string) => { if (!user || user.role !== "FARMER") return; setData(current => audit({ ...current, pendingReports: current.pendingReports.filter(p => p.id !== id) }, user, "OFFLINE_REPORT_DISCARDED", "PendingHealthReport", id, "Discarded a queued offline report.")); setToast("Queued report discarded."); };

  if (!firebaseConfigured && process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_PASHUCARE_DEMO_MODE === "false") return <FirebaseSetupRequiredScreen />;
  if (!authReady || !hydrated) return <div className="auth-loading"><div className="brand-mark"><HeartPulse size={22}/></div><strong>Preparing PashuCare</strong><span>{firebaseConfigured ? "Checking your secure session and cloud workspace…" : "Loading your local workspace…"}</span></div>;
  if (!user) return firebaseConfigured ? <FirebaseAuthScreen initialError={googleAuthError} /> : <LoginScreen onLogin={login} />;

  const navItems = role === "FARMER"
    ? [{ id: "overview", label: "Home", icon: Home }, { id: "livestock", label: "Livestock", icon: PawPrint }, { id: "reports", label: "Reports", icon: FileText }, { id: "alerts", label: "Alerts", icon: Bell }]
    : [{ id: "overview", label: "Home", icon: Home }, { id: "cases", label: "Cases", icon: ClipboardList }, { id: "surveillance", label: "Surveillance", icon: ScanSearch }, { id: "followups", label: "Follow-ups", icon: CalendarClock }];
  const mobileMoreItems = role === "FARMER"
    ? [
        { id: "farms", label: "My farms", icon: MapPinned },
        { id: "health-records", label: "Health records", icon: ClipboardCheck },
        { id: "vaccinations", label: "Vaccinations", icon: Syringe },
        { id: "identities", label: "Animal ID & QR", icon: QrCode },
        { id: "offline", label: "Offline queue", icon: CloudUpload },
        { id: "crop", label: "Crop rotation", icon: Sprout },
        { id: "backup", label: "Backup & restore", icon: FileDown },
        { id: "profile", label: "My profile", icon: UserRound },
        { id: "guide", label: "Quick guide", icon: BookOpen },
      ]
    : [
        { id: "health-records", label: "Health records", icon: ClipboardCheck },
        { id: "vaccinations", label: "Vaccinations", icon: Syringe },
        { id: "alerts", label: "Alerts & updates", icon: Bell },
        { id: "identities", label: "Animal lookup & QR", icon: QrCode },
        { id: "analytics", label: "Analytics & export", icon: Activity },
        { id: "audit", label: "Audit history", icon: ClipboardClock },
        { id: "settings", label: "Rules & escalation", icon: Settings2 },
        { id: "backup", label: "Backup & restore", icon: FileDown },
        { id: "guide", label: "Quick guide", icon: BookOpen },
      ];
  const selectedCase = data.cases.find((c) => c.id === selectedId);
  const selectedReport = data.reports.find((r) => r.id === selectedId);
  const selectedAnimal = data.animals.find((a) => a.id === selectedId);

  let content: ReactNode;
  switch (page) {
    case "overview": content = <OverviewPage role={role!} data={data} user={user} onNavigate={setPage} onNewReport={() => setModal("report")} onOpenCase={openCase} />; break;
    case "farms": content = role === "FARMER" ? <FarmsPage data={data} user={user} onAdd={() => { setSelectedId(""); setModal("farm"); }} onEdit={(id) => { setSelectedId(id); setModal("farm"); }} /> : <EmptyState title="Farm directory" message="Farmer farm records are visible through assigned cases." icon={MapPinned} />; break;
    case "livestock": content = role === "FARMER" ? <LivestockPage data={data} user={user} query={query} onAdd={() => { setSelectedId(""); setModal("animal"); }} onOpen={(id) => { setSelectedId(id); setModal("animal"); }} /> : <EmptyState title="Livestock directory" message="Open a veterinary case to view its associated animal profile and health history." icon={PawPrint} />; break;
    case "health-records": content = <HealthRecordsPage data={data} user={user} role={role!} />; break;
    case "profile": content = <ProfilePage user={user} onSave={saveProfile} isCloudAccount={Boolean(cloudUid)} />; break;
    case "reports": content = <ReportsPage data={data} user={user} role={role!} query={query} onOpen={openReport} />; break;
    case "cases": content = role === "VETERINARIAN" ? <CasesPage data={data} query={query} onOpen={openCase} /> : <ReportsPage data={data} user={user} role={role!} query={query} onOpen={openReport} />; break;
    case "surveillance": content = role === "VETERINARIAN" ? <SurveillancePage data={data} onOpenReport={openReport} onReviewCluster={reviewCluster} /> : <EmptyState title="Veterinary workspace" message="Possible cluster information is visible to authorised veterinarians." icon={ShieldCheck} />; break;
    case "vaccinations": content = <VaccinationsPage data={data} role={role!} user={user} onAdd={() => { setSelectedId(""); setModal("vaccination"); }} onEdit={(id) => { setSelectedId(id); setModal("vaccination"); }} />; break;
    case "followups": content = role === "VETERINARIAN" ? <FollowupsPage data={data} onOpenCase={openCase} /> : <EmptyState title="Veterinary workspace" message="Follow-up management is available in the veterinarian portal." icon={CalendarClock} />; break;
    case "alerts": content = <AlertsPage data={data} user={user} onRead={readAlert} onReadAll={() => setData(current => ({ ...current, alerts: current.alerts.map(a => a.recipientId === user.id && !a.readAt ? { ...a, readAt: new Date().toISOString() } : a) }))} notificationPermission={notificationPermission} onEnableBrowserNotifications={enableBrowserNotifications} onOpenRelated={(id) => { if (id.startsWith("CASE")) { const linkedCase = data.cases.find((c) => c.id === id); if (role === "FARMER" && linkedCase) openReport(linkedCase.reportId); else openCase(id); } else if (id.startsWith("RPT")) openReport(id); else if (id.startsWith("CLUSTER")) setPage("surveillance"); else setPage("vaccinations"); }} />; break;
    case "identities": content = <AnimalIdentityPage data={data} user={user} onOpen={(id) => { setSelectedId(id); setModal("animal-profile"); }} />; break;
    case "offline": content = role === "FARMER" ? <OfflineQueuePage data={data} online={online} cloudEnabled={Boolean(cloudUid)} onSync={syncQueued} onRemove={removePending} /> : <EmptyState icon={CloudUpload} title="Farmer offline queue" message="Queued health reports are available in the Farmer workspace." />; break;
    case "analytics": content = role === "VETERINARIAN" ? <AnalyticsPage data={data} /> : <EmptyState icon={Activity} title="Veterinary analytics" message="Operational analytics are available in the Veterinarian workspace." />; break;
    case "audit": content = role === "VETERINARIAN" ? <AuditHistoryPage data={data} /> : <EmptyState icon={ClipboardClock} title="Veterinary audit history" message="Audit history is available to the Veterinarian workspace." />; break;
    case "settings": content = role === "VETERINARIAN" ? <RulesAndEscalationPage data={data} onSave={saveRules} /> : <EmptyState icon={Settings2} title="Veterinary configuration" message="Surveillance rules are managed in the Veterinarian workspace." />; break;
    case "crop": content = role === "FARMER" ? <CropRotationPage data={data} user={user} onSave={saveCropPlan} /> : <EmptyState title="Farmer utility" message="Crop rotation is a secondary Farmer-side module." icon={Sprout} />; break;
    case "backup": content = <BackupPage data={data} user={user} onRestore={(restored) => { setData({ ...restored, users: restored.users.map(person => person.id === user.id ? user : person) }); setToast("Backup restored. Cloud sync is starting."); }} />; break;
    case "guide": content = <GuidePage role={role!} />; break;
    default: content = <OverviewPage role={role!} data={data} user={user} onNavigate={setPage} onNewReport={() => setModal("report")} onOpenCase={openCase} />;
  }

  return <div className="app-shell"><AppSidebar role={role!} page={page} onNavigate={setPage} onLogout={logout} canSwitchRole={!cloudUid} /><div className="app-main"><AppHeader user={user} unread={farmerAlerts} online={online} canInstall={canInstall} onInstall={install} onNavigate={setPage} onSwitchRole={switchRole} onLogout={logout} query={query} onSearch={setQuery} locale={locale} onLocaleChange={setLocale} pendingCount={data.pendingReports.length} canSwitchRole={!cloudUid} syncState={syncState} onRetrySync={() => { if (syncRetryTimerRef.current) window.clearTimeout(syncRetryTimerRef.current); setSyncRetry(value => value + 1); setToast("Cloud sync retry requested."); }} /><div className="main-scroll"><div className="content-wrap"><AnimatePresence mode="wait"><motion.div key={`${role}-${page}`} {...pageMotion}>{content}</motion.div></AnimatePresence><footer className="app-footer"><span>© 2026 PashuCare · Livestock Health Management</span><span>Synthetic demonstration data · SIH26128</span></footer></div></div><nav className="mobile-bottom-nav" aria-label="Primary navigation">{navItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={page === id ? "active" : ""} aria-current={page === id ? "page" : undefined} onClick={() => { setPage(id); setMobileMenuOpen(false); }}><Icon size={20} strokeWidth={page === id ? 2.25 : 1.8} /><span>{label}</span>{id === "alerts" && farmerAlerts > 0 && <i aria-label={`${farmerAlerts} unread alerts`} />}</button>)}<button type="button" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className={mobileMenuOpen || mobileMoreItems.some((item) => item.id === page) ? "active" : ""} aria-expanded={mobileMenuOpen} aria-controls="mobile-more-sheet"><MoreHorizontal size={20} /><span>More</span></button></nav>{mobileMenuOpen && <><button type="button" className="mobile-more-scrim" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} /><section id="mobile-more-sheet" className="mobile-more-sheet" role="dialog" aria-label="More navigation"><div className="mobile-more-header"><div><strong>More tools</strong><span>Everything else in your workspace</span></div><button type="button" className="mobile-more-close" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)}><X size={17} /></button></div><div className="mobile-more-grid">{mobileMoreItems.map(({ id, label, icon: Icon }) => <button key={id} type="button" className={page === id ? "active" : ""} aria-current={page === id ? "page" : undefined} onClick={() => { setPage(id); setMobileMenuOpen(false); }}><Icon size={18} /><span>{label}</span></button>)}</div><div className="mobile-more-footer">{!cloudUid && <button type="button" onClick={() => { resetDemo(); setMobileMenuOpen(false); }}><RotateCcw size={16} /> Reset demo</button>}<button type="button" onClick={logout}><LogOut size={16} /> {cloudUid ? "Sign out" : "Exit demo"}</button></div></section></>}</div>
    {!cloudUid && <div className="demo-toolbar"><span><i /> LOCAL DEMO DATA</span><button onClick={resetDemo}><RefreshCcw size={13} /> Reset</button></div>}
    <AnimatePresence>{toast && <Toast message={toast} onClose={() => setToast("")} />}</AnimatePresence>
    <AnimatePresence>{modal === "report" && <ReportWizard data={data} user={user} locale={locale} online={online} onClose={() => setModal(null)} onSubmit={submitReport} />}</AnimatePresence>
    <AnimatePresence>{modal === "animal-profile" && selectedAnimal && <AnimalProfileModal animal={selectedAnimal} data={data} canEdit={role === "FARMER"} onClose={() => setModal(null)} onEdit={() => setModal("animal")} />}</AnimatePresence>
    <AnimatePresence>{modal === "animal" && <AnimalModal initial={selectedAnimal} farms={data.farms} user={user} onClose={() => setModal(null)} onSave={addAnimal} />}</AnimatePresence>
    <AnimatePresence>{modal === "case" && selectedCase && <CaseDetailModal item={selectedCase} data={data} onClose={() => setModal(null)} onSave={saveCase} />}</AnimatePresence>
    <AnimatePresence>{modal === "report-detail" && selectedReport && <ReportDetailModal report={selectedReport} data={data} onClose={() => setModal(null)} />}</AnimatePresence>
    <AnimatePresence>{modal === "farm" && <FarmModal initial={data.farms.find(f => f.id === selectedId)} user={user} onClose={() => setModal(null)} onSave={saveFarm} />}</AnimatePresence>
    <AnimatePresence>{modal === "vaccination" && <VaccinationModal data={data} initial={data.vaccinations.find(v => v.id === selectedId)} onClose={() => setModal(null)} onSave={saveVaccination} />}</AnimatePresence>
  </div>;
}

function VaccinationModal({ data, initial, onClose, onSave }: { data: AppData; initial?: Vaccination; onClose: () => void; onSave: (v: { id?: string; animalId: string; vaccineName: string; administeredOn: string; dueOn: string; notes: string; status: Vaccination["status"] }) => void }) {
  const [animalId, setAnimalId] = useState(initial?.animalId || data.animals[0]?.id || ""); const [vaccineName, setVaccineName] = useState(initial?.vaccineName || ""); const [administeredOn, setAdministeredOn] = useState(initial?.administeredOn || ""); const [dueOn, setDueOn] = useState(initial?.dueOn || ""); const [notes, setNotes] = useState(initial?.notes || ""); const [status, setStatus] = useState<Vaccination["status"]>(initial?.status || "DUE"); const [error, setError] = useState("");
  return <Modal title={initial ? "Edit vaccination record" : "Add vaccination record"} description="Record vaccine administration and the next due date." onClose={onClose}><div className="modal-form"><label className="form-field"><span>Animal</span><select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>{data.animals.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.tagId}</option>)}</select></label><label className="form-field"><span>Vaccine name <b>*</b></span><input value={vaccineName} onChange={(e) => setVaccineName(e.target.value)} placeholder="e.g. FMD Booster" /></label><div className="form-grid-two"><label className="form-field"><span>Administered on</span><input type="date" value={administeredOn} onChange={(e) => setAdministeredOn(e.target.value)} /></label><label className="form-field"><span>Next due date</span><input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} /></label></div><label className="form-field"><span>Record status</span><select value={status} onChange={e => setStatus(e.target.value as Vaccination["status"])}><option value="COMPLETED">Completed / administered</option><option value="DUE">Upcoming / due</option><option value="OVERDUE">Overdue</option></select></label><label className="form-field"><span>Notes</span><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>{error && <div className="form-error">{error}</div>}</div><div className="modal-footer"><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={() => { if (!vaccineName.trim() || !animalId) { setError("Choose an animal and enter a vaccine name."); return; } if (status === "COMPLETED" && !administeredOn) { setError("Enter the administration date for a completed vaccine."); return; } if (status !== "COMPLETED" && !dueOn) { setError("Enter the due date for a pending vaccination."); return; } onSave({ id: initial?.id, animalId, vaccineName: vaccineName.trim(), administeredOn, dueOn: dueOn || administeredOn, notes, status }); }}><Save size={15} /> {initial ? "Update record" : "Save record"}</button></div></Modal>;
}

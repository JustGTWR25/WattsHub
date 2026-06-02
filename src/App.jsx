import { useState, useEffect, useRef, useCallback, useMemo, Component } from "react";

/* ─── FIREBASE ───────────────────────────────────────────────────────────── */
let _app=null,_db=null,_auth=null;
let _ref,_set,_update,_onValue,_off,_remove,_push,_signInAnon,_onAuthState;

async function bootFirebase(cfg) {
  try {
    const [fa, fd, fauth] = await Promise.all([
      import("https://esm.sh/firebase/app"),
      import("https://esm.sh/firebase/database"),
      import("https://esm.sh/firebase/auth"),
    ]);
    _app = fa.getApps().length ? fa.getApp() : fa.initializeApp(cfg);
    _db  = fd.getDatabase(_app);
    _auth = fauth.getAuth(_app);
    _ref=fd.ref; _set=fd.set; _update=fd.update;
    _onValue=fd.onValue; _off=fd.off; _remove=fd.remove; _push=fd.push;
    _signInAnon=fauth.signInAnonymously; _onAuthState=fauth.onAuthStateChanged;
    return true;
  } catch(e) { console.warn("Firebase boot failed", e); return false; }
}

function useFirebase(cfg) {
  const [state, setState] = useState({ ready:false, uid:null, db:null, online:true });
  const subs = useRef([]);

  useEffect(() => {
    if (!cfg) return;
    bootFirebase(cfg).then(ok => {
      if (!ok) return;
      setState(s => ({...s, db:_db}));
      _onValue(_ref(_db,".info/connected"), snap =>
        setState(s => ({...s, online:!!snap.val()}))
      );
      _onAuthState(_auth, async u => {
        if (u) { setState(s => ({...s, uid:u.uid, ready:true})); }
        else { try { await _signInAnon(_auth); } catch(e) { setState(s => ({...s, ready:true})); } }
      });
    });
    return () => { subs.current.forEach(f=>f()); subs.current=[]; };
  }, [cfg]);

  /* stable db ops — always read _db directly so no stale closure issues */
  const db = {
    listen : useCallback((path, cb) => {
      if (!_db) return ()=>{};
      const r = _ref(_db, path);
      _onValue(r, s => cb(s.val()));
      const u = ()=>_off(r);
      subs.current.push(u);
      return u;
    }, [state.db]),
    set    : useCallback((path, val)    => _db && _set(_ref(_db,path), val),    [state.db]),
    update : useCallback((path, val)    => _db && _update(_ref(_db,path), val), [state.db]),
    del    : useCallback((path)         => _db && _remove(_ref(_db,path)),       [state.db]),
    push   : useCallback((path, val)    => _db && _push(_ref(_db,path), val),   [state.db]),
    atomic : useCallback((updates)      => _db && _update(_ref(_db), updates),  [state.db]),
  };
  const dbRef = useRef(db); dbRef.current = db;
  const safe = {
    listen : (...a) => dbRef.current.listen(...a),
    set    : (...a) => dbRef.current.set(...a),
    update : (...a) => dbRef.current.update(...a),
    del    : (...a) => dbRef.current.del(...a),
    push   : (...a) => dbRef.current.push(...a),
    atomic : (...a) => dbRef.current.atomic(...a),
  };

  return { ...state, ...safe };
}

/* ─── UTILS ──────────────────────────────────────────────────────────────── */
const localDate  = () => new Date().toLocaleDateString("en-CA");
const parseLocal = s  => new Date(s + "T00:00:00");
const weekKey    = d  => {
  const dt=parseLocal(d), j=new Date(dt.getFullYear(),0,1);
  const wk=Math.ceil(((dt-j)/86400000+j.getDay()+1)/7);
  return `${dt.getFullYear()}-W${String(wk).padStart(2,"0")}`;
};
const monthKey   = d  => {
  const dt=parseLocal(d);
  return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;
};
const uid2       = ()  => Math.random().toString(36).slice(2,8);
const txKey      = id  => `tx_${Date.now()}_${id}_${uid2()}`;
const cents2     = c   => `$${(Math.round(c||0)/100).toFixed(2)}`;
const DOW        = d   => parseLocal(d).toLocaleDateString("en-US",{weekday:"short"});
const DAYS       = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const SUMMER_START = "2026-06-01";
const SUMMER_END   = "2026-08-15";
const SESSION_DAYS = new Set([1,2,3,4]); // Mon–Thu
const FOCUS_MAP    = { Monday:"math", Tuesday:"literacy", Wednesday:"math", Thursday:"literacy" };
const isSummerActive = () => {
  const n=new Date(), s=new Date(SUMMER_START+"T00:00:00"), e=new Date(SUMMER_END+"T00:00:00");
  return n>=s && n<=e;
};
const summerWeeksElapsed = () => {
  const s=new Date(SUMMER_START+"T00:00:00"), n=new Date();
  return n<s ? 0 : Math.max(1, Math.ceil((n-s)/(7*86400000)));
};
const prevSessionDay = () => {
  const d = new Date(); d.setDate(d.getDate()-1);
  for (let i=0; i<5; i++) {
    if (SESSION_DAYS.has(d.getDay())) return d.toLocaleDateString("en-CA");
    d.setDate(d.getDate()-1);
  }
  return null;
};

const PALETTE = [
  { accent:"#4F46E5", light:"#EEF2FF", text:"#4338CA" },
  { accent:"#059669", light:"#ECFDF5", text:"#047857" },
  { accent:"#DC2626", light:"#FEF2F2", text:"#B91C1C" },
  { accent:"#D97706", light:"#FFFBEB", text:"#B45309" },
  { accent:"#7C3AED", light:"#F5F3FF", text:"#6D28D9" },
];

/* ─── ERROR BOUNDARY ─────────────────────────────────────────────────────── */
class ErrBound extends Component {
  constructor(p) { super(p); this.state={err:null}; }
  static getDerivedStateFromError(e) { return {err:e}; }
  render() {
    if (this.state.err) return (
      <div style={{padding:"2rem",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:8}}>⚠️</div>
        <div style={{fontWeight:700,marginBottom:4,color:"#111"}}>Something went wrong</div>
        <div style={{fontSize:13,color:"#666",marginBottom:16}}>{this.state.err.message}</div>
        <button onClick={()=>this.setState({err:null})} style={{...BTN.base,...BTN.primary}}>Try again</button>
      </div>
    );
    return this.props.children;
  }
}

/* ─── TOAST HOOK ─────────────────────────────────────────────────────────── */
function useToasts() {
  const [list, setList] = useState([]);
  const add = useCallback((msg, type="info", dur=3000) => {
    const id = Date.now()+Math.random();
    setList(l => [...l, {id,msg,type}]);
    setTimeout(() => setList(l => l.filter(x=>x.id!==id)), dur);
  }, []);
  return { list, add };
}

/* ─── STYLE CONSTANTS ────────────────────────────────────────────────────── */
const C = {
  bg     : "#F8F9FA",
  surface: "#FFFFFF",
  border : "#E5E7EB",
  border2: "#D1D5DB",
  text   : "#111827",
  text2  : "#6B7280",
  text3  : "#9CA3AF",
  primary: "#4F46E5",
  pLight : "#EEF2FF",
  pDark  : "#4338CA",
  green  : "#059669",
  gLight : "#ECFDF5",
  red    : "#DC2626",
  rLight : "#FEF2F2",
  amber  : "#D97706",
  aLight : "#FFFBEB",
};

const BTN = {
  base   : { border:"none", borderRadius:8, padding:"8px 14px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"inherit", display:"inline-flex", alignItems:"center", gap:5, transition:"all .15s" },
  primary: { background:C.primary, color:"#fff" },
  ghost  : { background:"#fff", color:C.text, border:`1px solid ${C.border2}` },
  danger : { background:C.rLight, color:C.red, border:`1px solid #FECACA` },
  success: { background:C.gLight, color:C.green, border:`1px solid #A7F3D0` },
  sm     : { padding:"5px 10px", fontSize:12 },
};

const CARD = {
  background : C.surface,
  border     : `1px solid ${C.border}`,
  borderRadius: 12,
  padding    : 16,
};

/* ─── CSS STRING ─────────────────────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
*, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
html, body { background:${C.bg}; color:${C.text}; font-family:'Nunito',system-ui,sans-serif; min-height:100vh; min-height:-webkit-fill-available; -webkit-tap-highlight-color:transparent; font-size:14px; }
button, input, select, textarea { font-family:inherit; -webkit-appearance:none; }
::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-thumb { background:#D1D5DB; border-radius:2px; }
a { color:${C.primary}; }

/* Layout */
.layout { display:flex; min-height:100vh; min-height:-webkit-fill-available; }
.sidebar { width:220px; flex-shrink:0; background:#fff; border-right:1px solid ${C.border}; display:flex; flex-direction:column; height:100vh; height:-webkit-fill-available; position:sticky; top:0; overflow-y:auto; }
.main    { flex:1; min-width:0; overflow-y:auto; height:100vh; height:-webkit-fill-available; }
.topbar  { background:#fff; border-bottom:1px solid ${C.border}; padding:12px 20px; display:flex; align-items:center; justify-content:space-between; position:sticky; top:0; z-index:20; }
.content { padding:20px; max-width:900px; }

/* Sidebar */
.slogo   { padding:16px; font-size:17px; font-weight:900; color:${C.primary}; border-bottom:1px solid ${C.border}; }
.snav    { padding:8px; flex:1; }
.sni     { display:flex; align-items:center; gap:9px; width:100%; background:none; border:none; color:${C.text2}; cursor:pointer; font-size:13px; font-weight:600; padding:8px 10px; border-radius:8px; transition:all .15s; text-align:left; }
.sni:hover { background:${C.bg}; color:${C.text}; }
.sni.act   { background:${C.pLight}; color:${C.primary}; }
.sni-ic  { font-size:16px; width:20px; text-align:center; }
.sbadge  { margin-left:auto; background:${C.amber}; color:#fff; font-size:10px; font-weight:800; border-radius:10px; padding:1px 6px; }
.sfoot   { padding:12px; border-top:1px solid ${C.border}; }
.skid    { display:flex; align-items:center; gap:8px; width:100%; background:none; border:none; color:${C.text2}; cursor:pointer; font-size:13px; font-weight:600; padding:7px 10px; border-radius:8px; transition:all .15s; }
.skid:hover { background:${C.bg}; color:${C.text}; }
.skid.act   { background:${C.pLight}; color:${C.primary}; }
.sdiv    { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:${C.text3}; padding:8px 10px 3px; }

/* Cards */
.card    { background:#fff; border:1px solid ${C.border}; border-radius:12px; padding:16px; }
.card+.card { margin-top:12px; }
.card-h  { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:${C.text3}; margin-bottom:12px; }

/* Chore cards */
.ccard   { background:#fff; border:1px solid ${C.border}; border-radius:10px; padding:12px 14px; display:flex; align-items:center; gap:12px; cursor:pointer; transition:all .15s; margin-bottom:8px; user-select:none; }
.ccard:hover  { border-color:${C.border2}; box-shadow:0 1px 4px rgba(0,0,0,.06); }
.ccard.done   { opacity:.6; background:${C.bg}; }
.ccard.pending{ border-color:#FCD34D; background:#FFFBEB; }
.ccard.opt    { opacity:.75; }
.ccheck  { width:24px; height:24px; border-radius:7px; border:2px solid ${C.border2}; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all .15s; }
.ccheck.done    { background:${C.green}; border-color:${C.green}; }
.ccheck.pending { background:${C.amber}; border-color:${C.amber}; }
.ccheck.opt     { background:${C.pLight}; border-color:${C.primary}; }
.ctitle  { font-size:14px; font-weight:700; flex:1; min-width:0; }
.cdiff   { font-size:10px; font-weight:700; padding:2px 8px; border-radius:20px; flex-shrink:0; }
.diff-easy   { background:#ECFDF5; color:${C.green}; }
.diff-medium { background:#FFFBEB; color:${C.amber}; }
.diff-hard   { background:#FEF2F2; color:${C.red}; }
.cxp     { font-size:12px; font-weight:800; color:${C.primary}; flex-shrink:0; }

/* Dashboard grid */
.dgrid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:14px; }
.kcard   { background:#fff; border:1px solid ${C.border}; border-radius:14px; padding:16px; transition:box-shadow .15s; cursor:pointer; }
.kcard:hover { box-shadow:0 4px 12px rgba(0,0,0,.08); }

/* Progress bars */
.pbar    { height:7px; background:${C.bg}; border-radius:4px; overflow:hidden; margin-top:5px; }
.pbar-f  { height:100%; border-radius:4px; transition:width .5s ease; }

/* Store */
.sgrid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:12px; }
.sitem   { background:#fff; border:1px solid ${C.border}; border-radius:10px; padding:14px; text-align:center; cursor:pointer; transition:all .15s; }
.sitem:hover     { border-color:${C.border2}; box-shadow:0 2px 8px rgba(0,0,0,.06); }
.sitem.afford    { border-color:#A7F3D0; background:${C.gLight}; }
.sitem.no-afford { opacity:.5; cursor:default; }

/* Modals */
.overlay { position:fixed; inset:0; background:rgba(0,0,0,.4); display:flex; align-items:center; justify-content:center; z-index:100; padding:16px; }
.modal   { background:#fff; border-radius:16px; padding:22px; width:100%; max-width:440px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,.2); }
.modal-h { font-size:16px; font-weight:800; margin-bottom:16px; }
.fg      { display:flex; flex-direction:column; gap:4px; margin-bottom:12px; }
.fl      { font-size:12px; font-weight:700; color:${C.text2}; }
.fi      { background:${C.bg}; border:1px solid ${C.border2}; border-radius:8px; padding:9px 12px; color:${C.text}; font-size:13px; outline:none; transition:border-color .15s; }
.fi:focus { border-color:${C.primary}; background:#fff; }
.frow    { display:flex; gap:8px; flex-wrap:wrap; }
.fax     { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.sw-row  { display:flex; align-items:center; justify-content:space-between; padding:8px 0; }

/* Toggle switch */
.sw      { position:relative; width:36px; height:20px; cursor:pointer; display:inline-block; }
.sw input { opacity:0; width:0; height:0; }
.sw-t    { position:absolute; inset:0; background:${C.border2}; border-radius:10px; transition:.2s; }
.sw input:checked+.sw-t { background:${C.primary}; }
.sw-th   { position:absolute; left:2px; top:2px; width:16px; height:16px; background:#fff; border-radius:50%; transition:.2s; box-shadow:0 1px 3px rgba(0,0,0,.2); }
.sw input:checked~.sw-th { transform:translateX(16px); }

/* Picker */
.picker  { min-height:100vh; min-height:-webkit-fill-available; display:flex; flex-direction:column; align-items:center; justify-content:center; background:${C.bg}; padding:24px; }
.picker-grid { display:flex; flex-wrap:wrap; gap:14px; justify-content:center; max-width:560px; }
.pcard   { background:#fff; border:1.5px solid ${C.border}; border-radius:16px; padding:22px 20px; display:flex; flex-direction:column; align-items:center; gap:10px; cursor:pointer; transition:all .2s; min-width:120px; }
.pcard:hover { border-color:${C.primary}; box-shadow:0 4px 16px rgba(79,70,229,.15); transform:translateY(-2px); }

/* PIN */
.pin-wrap { min-height:100vh; min-height:-webkit-fill-available; display:flex; align-items:center; justify-content:center; background:${C.bg}; }
.pin-box  { background:#fff; border-radius:16px; padding:28px 24px; width:min(300px,92vw); display:flex; flex-direction:column; align-items:center; gap:14px; box-shadow:0 8px 30px rgba(0,0,0,.1); }
.pin-dots { display:flex; gap:12px; }
.pin-dot  { width:14px; height:14px; border-radius:50%; border:2px solid ${C.border2}; transition:all .15s; }
.pin-dot.on { background:${C.primary}; border-color:${C.primary}; }
.pin-pad  { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; width:100%; }
.pin-btn  { background:${C.bg}; border:1px solid ${C.border}; border-radius:10px; color:${C.text}; font-size:18px; font-weight:700; padding:14px; cursor:pointer; transition:all .15s; }
.pin-btn:hover { background:${C.pLight}; border-color:${C.primary}; }
.pin-err  { font-size:12px; color:${C.red}; min-height:16px; }

/* Kid mode */
.km-wrap   { display:flex; flex-direction:column; min-height:100vh; min-height:-webkit-fill-available; background:${C.bg}; }
.km-header { background:#fff; border-bottom:1px solid ${C.border}; padding:14px 16px; display:flex; align-items:center; gap:12px; }
.km-tabs   { background:#fff; border-bottom:1px solid ${C.border}; display:flex; }
.km-tab    { flex:1; background:none; border:none; color:${C.text2}; cursor:pointer; font-size:13px; font-weight:700; padding:11px 0; transition:all .15s; border-bottom:2px solid transparent; }
.km-tab.act { color:${C.primary}; border-bottom-color:${C.primary}; }
.km-content { padding:14px; padding-bottom:80px; }

/* Bottom nav */
.bnav     { display:none; position:fixed; bottom:0; left:0; right:0; width:100%; background:#fff; border-top:1px solid ${C.border}; z-index:50; }
.bnav-in  { display:flex; width:100%; padding-bottom:env(safe-area-inset-bottom,0px); }
.bnav-btn { flex:1; background:none; border:none; color:${C.text3}; cursor:pointer; display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 0; font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; min-width:0; }
.bnav-btn.act { color:${C.primary}; }
.bnav-ic  { font-size:20px; line-height:1; }

/* Toasts */
.toasts   { position:fixed; bottom:24px; right:16px; display:flex; flex-direction:column; gap:8px; z-index:200; pointer-events:none; }
.toast    { background:#fff; border:1px solid ${C.border}; border-radius:10px; padding:10px 16px; font-size:13px; font-weight:600; box-shadow:0 4px 16px rgba(0,0,0,.1); animation:toastIn .2s ease; max-width:280px; }
@keyframes toastIn { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
.toast-success { border-color:#A7F3D0; color:${C.green}; }
.toast-warn    { border-color:#FCD34D; color:${C.amber}; }
.toast-err     { border-color:#FECACA; color:${C.red}; }
.toast-info    { border-color:#C7D2FE; color:${C.primary}; }

/* Misc */
.chip     { display:inline-flex; align-items:center; gap:4px; font-size:11px; font-weight:700; padding:3px 9px; border-radius:20px; background:${C.bg}; color:${C.text2}; border:1px solid ${C.border}; }
.empty    { text-align:center; padding:3rem 1rem; color:${C.text3}; }
.alog-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid ${C.border}; }
.alog-row:last-child { border-bottom:none; }
.pill     { font-size:11px; font-weight:700; padding:2px 8px; border-radius:20px; }
.pill-green { background:${C.gLight}; color:${C.green}; }
.pill-blue  { background:${C.pLight}; color:${C.primary}; }
.pill-amber { background:${C.aLight}; color:${C.amber}; }
.offline-bar { position:fixed; top:0; left:0; right:0; background:#FCD34D; color:#92400E; font-size:12px; font-weight:700; text-align:center; padding:5px; z-index:300; }

/* Summer */
.sum-card   { background:#fff; border:1.5px solid #C7D2FE; border-radius:12px; padding:14px; margin-bottom:14px; }
.sum-stats  { display:flex; gap:8px; margin:10px 0; }
.sum-stat   { flex:1; background:${C.bg}; border-radius:8px; padding:8px 6px; text-align:center; }
.streak-alert { border-radius:8px; padding:8px 12px; font-size:12px; font-weight:600; margin-bottom:10px; }
.rep-grid   { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
.rep-card   { background:#fff; border:1px solid ${C.border}; border-radius:12px; overflow:hidden; }
.rep-head   { padding:10px 14px; background:${C.bg}; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid ${C.border}; }
.rep-stats  { display:grid; grid-template-columns:repeat(4,1fr); }
.rep-stat   { padding:8px 6px; text-align:center; border-right:1px solid ${C.border}; }
.rep-stat:last-child { border-right:none; }

@media(max-width:680px){
  .sidebar  { display:none; }
  .bnav     { display:flex; }
  .content  { padding:12px 12px 90px; }
  .topbar   { padding:10px 12px; }
  .dgrid    { grid-template-columns:1fr; }
  .sgrid    { grid-template-columns:repeat(auto-fill,minmax(130px,1fr)); }
  .rep-grid { grid-template-columns:1fr; }
}
@media print {
  .sidebar,.bnav,.topbar,.no-print { display:none!important; }
  .main { height:auto; overflow:visible; }
}
`;

/* ─── SEED DATA ──────────────────────────────────────────────────────────── */
const SEED_KIDS = [
  { id:"k1", name:"Tayonna", age:17, colorIdx:0, initials:"TW", xp:0, balanceCents:0, goal:{ weeklyXp:80 } },
  { id:"k2", name:"Brianna", age:14, colorIdx:1, initials:"BW", xp:0, balanceCents:0, goal:{ weeklyXp:60 } },
  { id:"k3", name:"Leon",    age:10, colorIdx:2, initials:"LW", xp:0, balanceCents:0, goal:{ weeklyXp:40 } },
];
const SEED_CHORES = [
  { id:"c1", title:"Make bed",       diff:"easy",   scheduleType:"daily",  scheduleDays:[],                                    assignedTo:["k1","k2","k3"], requiresApproval:false, xp:5  },
  { id:"c2", title:"Clean room",     diff:"medium", scheduleType:"daily",  scheduleDays:[],                                    assignedTo:["k1","k2","k3"], requiresApproval:false, xp:20 },
  { id:"c3", title:"Dishes",         diff:"medium", scheduleType:"weekly", scheduleDays:["Mon","Tue","Wed","Thu","Fri"],        assignedTo:["k1","k2"],      requiresApproval:false, xp:20 },
  { id:"c4", title:"Take out trash", diff:"easy",   scheduleType:"weekly", scheduleDays:["Sun"],                               assignedTo:["k3"],           requiresApproval:true,  xp:5  },
  { id:"c5", title:"Vacuum",         diff:"hard",   scheduleType:"weekly", scheduleDays:["Sat"],                               assignedTo:["k1","k2","k3"], requiresApproval:true,  xp:35 },
];
const STORE_DEFAULTS = [
  { id:"sd1", name:"30 min screen time", emoji:"📱", priceCents:50  },
  { id:"sd2", name:"Pick dinner",        emoji:"🍕", priceCents:100 },
  { id:"sd3", name:"Stay up 30 min",     emoji:"🌙", priceCents:80  },
  { id:"sd4", name:"Skip one chore",     emoji:"🎯", priceCents:150 },
  { id:"sd5", name:"Movie night pick",   emoji:"🎬", priceCents:120 },
  { id:"sd6", name:"Cash out $1",        emoji:"💵", priceCents:100 },
];

/* ─── STATIC COMPONENTS ──────────────────────────────────────────────────── */
function Avatar({ initials, colorIdx, size=40 }) {
  const p = PALETTE[colorIdx%PALETTE.length];
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:p.light, color:p.accent, fontSize:size*0.35, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      {initials}
    </div>
  );
}

async function sha256(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");
}

function PINScreen({ mode, onSuccess, onBack }) {
  const [pin,  setPin]  = useState("");
  const [pin2, setPin2] = useState("");
  const [step, setStep] = useState(mode==="set"?"a":"v");
  const [err,  setErr]  = useState("");
  const tap = d => {
    if (pin.length >= 4) return;
    const next = pin + d; setPin(next); setErr("");
    if (next.length < 4) return;
    if (mode === "set") {
      if (step === "a") { setPin2(next); setPin(""); setStep("b"); }
      else if (next === pin2) { sha256(next).then(h => { localStorage.setItem("wh_pin", h); onSuccess(); }); }
      else { setErr("PINs don't match"); setPin(""); setPin2(""); setStep("a"); }
    } else {
      const stored = localStorage.getItem("wh_pin");
      sha256(next).then(h => { if (h===stored) onSuccess(); else { setErr("Wrong PIN"); setPin(""); } });
    }
  };
  const label = mode==="set" ? (step==="a" ? "Create a parent PIN" : "Confirm PIN") : "Enter parent PIN";
  return (
    <div className="pin-wrap">
      <div className="pin-box">
        <div style={{ fontSize:22 }}>🔑</div>
        <div style={{ fontSize:16, fontWeight:800 }}>{label}</div>
        <div className="pin-dots">
          {[0,1,2,3].map(i => <div key={i} className={`pin-dot${pin.length>i?" on":""}`}/>)}
        </div>
        <div className="pin-err">{err}</div>
        <div className="pin-pad">
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i) => (
            <button key={i} className="pin-btn" style={d===""?{visibility:"hidden"}:{}}
              onClick={() => d==="⌫" ? (setPin(p=>p.slice(0,-1)), setErr("")) : tap(String(d))}>
              {d}
            </button>
          ))}
        </div>
        {onBack && <button onClick={onBack} style={{...BTN.base,...BTN.ghost,...BTN.sm}}>← Back</button>}
      </div>
    </div>
  );
}

function FirebaseCfgModal({ onSave, onSkip }) {
  const [cfg, setCfg] = useState({ apiKey:"", authDomain:"", databaseURL:"", projectId:"", appId:"" });
  return (
    <div className="overlay"><div className="modal">
      <div className="modal-h">🔥 Connect Firebase</div>
      <p style={{ fontSize:12, color:C.text2, marginBottom:14, lineHeight:1.6 }}>
        Firebase Console → Project Settings → Your apps → Web app → Config object.
        Enable Realtime Database and Anonymous Auth.
      </p>
      {[{k:"apiKey",l:"API Key"},{k:"authDomain",l:"Auth Domain",h:"project.firebaseapp.com"},{k:"databaseURL",l:"Database URL",h:"https://project-rtdb.firebaseio.com"},{k:"projectId",l:"Project ID"},{k:"appId",l:"App ID"}].map(f => (
        <div className="fg" key={f.k}>
          <label className="fl">{f.l}</label>
          <input className="fi" placeholder={f.h||f.l} value={cfg[f.k]} onChange={e=>setCfg(c=>({...c,[f.k]:e.target.value}))}/>
        </div>
      ))}
      <div className="fax">
        <button style={{...BTN.base,...BTN.ghost}} onClick={onSkip}>Demo mode</button>
        <button style={{...BTN.base,...BTN.primary}} disabled={!cfg.apiKey||!cfg.databaseURL} onClick={()=>onSave(cfg)}>Connect →</button>
      </div>
    </div></div>
  );
}

function FocusTimerModal({ onClose, kids, onAwardXp }) {
  const D = 25*60;
  const [secs,    setSecs]    = useState(D);
  const [running, setRunning] = useState(false);
  const [done,    setDone]    = useState(false);
  const [selKid,  setSelKid]  = useState(kids[0]?.id||"");
  const t = useRef(null);
  const start = () => { setRunning(true); t.current=setInterval(()=>setSecs(s=>{if(s<=1){clearInterval(t.current);setRunning(false);setDone(true);return 0;}return s-1;}),1000); };
  const pause = () => { clearInterval(t.current); setRunning(false); };
  const reset = () => { clearInterval(t.current); setRunning(false); setDone(false); setSecs(D); };
  useEffect(()=>()=>clearInterval(t.current),[]);
  const pct=(secs/D)*100, r=56, circ=2*Math.PI*r;
  const mm=String(Math.floor(secs/60)).padStart(2,"0"), ss=String(secs%60).padStart(2,"0");
  return (
    <div className="overlay"><div className="modal" style={{textAlign:"center"}}>
      <div style={{fontSize:16,fontWeight:800,marginBottom:16}}>⏱ Focus Timer</div>
      <div style={{width:140,height:140,margin:"0 auto 16px",position:"relative"}}>
        <svg style={{transform:"rotate(-90deg)"}} width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke={C.bg} strokeWidth="8"/>
          <circle cx="70" cy="70" r={r} fill="none" stroke={C.primary} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round"/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900}}>{mm}:{ss}</div>
      </div>
      {done ? (
        <div style={{marginBottom:16}}>
          <div style={{color:C.green,fontWeight:800,marginBottom:10}}>🎉 Done! Award bonus XP?</div>
          <select className="fi" style={{width:"100%"}} value={selKid} onChange={e=>setSelKid(e.target.value)}>
            <option value="">No bonus</option>
            {kids.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </div>
      ) : (
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
          {!running?<button style={{...BTN.base,...BTN.primary}} onClick={start}>▶ Start</button>
            :<button style={{...BTN.base,...BTN.ghost}} onClick={pause}>⏸ Pause</button>}
          <button style={{...BTN.base,...BTN.ghost}} onClick={reset}>↺ Reset</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {done&&selKid&&<button style={{...BTN.base,...BTN.success}} onClick={()=>{onAwardXp(selKid,15);onClose();}}>+15 XP & Close</button>}
        <button style={{...BTN.base,...BTN.ghost}} onClick={onClose}>Close</button>
      </div>
    </div></div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════════════════════════════════ */
export default function WattsHub() {
  /* ── Firebase config ── */
  const [fbCfg, setFbCfg] = useState(() => {
    for (const k of ["wh_fbcfg","wh3_cfg","wh_fb","wattshub_cfg"]) {
      try { const p=JSON.parse(localStorage.getItem(k)||"null"); if(p?.apiKey&&p?.databaseURL)return p; } catch{}
    }
    return null;
  });
  const [showCfg, setShowCfg] = useState(false);
  const FB = useFirebase(fbCfg);
  const { ready, uid, online } = FB;

  /* ── Data ── */
  const [kids,         setKids]         = useState(SEED_KIDS);
  const [chores,       setChores]       = useState(SEED_CHORES);
  const [comps,        setComps]        = useState({});  // { [dateKey]: { [choreId_kidId]: comp } }
  const [weekXp,       setWeekXp]       = useState({});
  const [storeItems,   setStoreItems]   = useState([]);
  const [txLog,        setTxLog]        = useState([]);
  const [allowedUids,  setAllowedUids]  = useState({});
  const [sumKids,      setSumKids]      = useState({});
  const [sumSessions,  setSumSessions]  = useState({});
  const [sumWeekly,    setSumWeekly]    = useState({});
  const [sumMonthly,   setSumMonthly]   = useState({});

  /* ── UI ── */
  const [screen,    setScreen]    = useState("picker"); // picker|pin-set|pin-verify|app|kid
  const [view,      setView]      = useState("dashboard");
  const [activeKid, setActiveKid] = useState(null);
  const [parentMode,setParentMode]= useState(false);
  const [selDate,   setSelDate]   = useState(localDate());
  const [optim,     setOptim]     = useState({});       // optimistic completions

  const [showChoreModal, setShowChoreModal] = useState(false);
  const [editingChore,   setEditingChore]   = useState(null);
  const [showKidModal,   setShowKidModal]   = useState(false);
  const [showItemModal,  setShowItemModal]  = useState(false);
  const [showTimer,      setShowTimer]      = useState(false);

  const { list:toasts, add:toast } = useToasts();

  /* ── Midnight reset ── */
  useEffect(() => {
    const ms = new Date().setHours(24,0,0,0) - Date.now();
    const t = setTimeout(() => setSelDate(localDate()), ms);
    return () => clearTimeout(t);
  }, []);

  /* ── Firebase listeners ── */
  useEffect(() => {
    if (!ready) return;
    const unsubs = [
      FB.listen("wh/kids",                v => { if(v) setKids(Object.values(v).filter(Boolean)); }),
      FB.listen("wh/chores",              v => { if(v) setChores(Object.values(v).filter(Boolean)); }),
      FB.listen("wh/comps",               v => setComps(v||{})),
      FB.listen("wh/weekXp",              v => setWeekXp(v||{})),
      FB.listen("wh/store",               v => { if(v) setStoreItems(Object.values(v).filter(Boolean)); }),
      FB.listen("wh/txlog",               v => { if(v) setTxLog(Object.values(v).filter(Boolean).sort((a,b)=>b.ts-a.ts)); }),
      FB.listen("wh/allowedUids",         v => setAllowedUids(v||{})),
      FB.listen("wh/summerProgram/kids",  v => setSumKids(v||{})),
      FB.listen("wh/summerSessions",      v => setSumSessions(v||{})),
      FB.listen("wh/reports/weekly",      v => setSumWeekly(v||{})),
      FB.listen("wh/reports/monthly",     v => setSumMonthly(v||{})),
    ];
    return () => unsubs.forEach(f=>f&&f());
  }, [ready]);

  /* ── One-time seed (2s delay, only if wh/chores is empty) ── */
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      const u = FB.listen("wh/chores", v => {
        u && u();
        if (!v) {
          const u2 = FB.listen("wh/kids", kv => { u2&&u2(); if(!kv) SEED_KIDS.forEach(k=>FB.set(`wh/kids/${k.id}`,k)); });
          SEED_CHORES.forEach(c => FB.set(`wh/chores/${c.id}`, c));
        }
      });
    }, 2000);
    return () => clearTimeout(t);
  }, [ready]);

  /* ── Helpers ── */
  const kidById   = id => kids.find(k=>k.id===id);
  const getComp   = (dk,cId,kId) => comps[dk]?.[`${cId}_${kId}`] || null;
  const isToday   = selDate === localDate();
  const isScheduled = (c, ds) => {
    if (c.scheduleType==="daily") return true;
    if (c.scheduleType==="weekly") return (c.scheduleDays||[]).includes(DOW(ds));
    return true;
  };
  const pendCount = useMemo(() => {
    let n=0;
    chores.forEach(c => { if(!c.requiresApproval)return; kids.forEach(k => { if(getComp(localDate(),c.id,k.id)?.status==="pending")n++; }); });
    return n;
  }, [chores,kids,comps]);
  const hasPIN  = !!localStorage.getItem("wh_pin");
  const isAdmin = uid && allowedUids[uid]?.role==="admin";

  /* ── Actions ── */
  async function completeChore(choreId, kidId) {
    const chore = chores.find(c=>c.id===choreId);
    const kid   = kidById(kidId);
    if (!chore||!kid) return;
    const dk  = localDate();
    const key = `${choreId}_${kidId}`;
    const existing = getComp(dk, choreId, kidId);

    setOptim(o=>({...o,[key]:true}));
    try {
      if (existing?.status==="done") {
        /* UNCHECK — reverse XP */
        const xp  = existing.xp||chore.xp||5;
        const wk  = weekKey(dk);
        await FB.atomic({
          [`wh/comps/${dk}/${key}`]             : null,
          [`wh/kids/${kidId}/xp`]               : Math.max(0,(kid.xp||0)-xp),
          [`wh/weekXp/${wk}/${kidId}`]          : Math.max(0,(weekXp[wk]?.[kidId]||0)-xp),
        });
        toast(`${chore.title} unchecked (-${xp} XP)`, "warn");
      } else if (!existing || existing.status==="none") {
        /* COMPLETE */
        const xp     = chore.xp||5;
        const status = chore.requiresApproval?"pending":"done";
        const wk     = weekKey(dk);
        const upd    = { [`wh/comps/${dk}/${key}`]: { status, ts:Date.now(), choreId, kidId, xp } };
        if (status==="done") {
          upd[`wh/kids/${kidId}/xp`]       = (kid.xp||0)+xp;
          upd[`wh/weekXp/${wk}/${kidId}`]  = (weekXp[wk]?.[kidId]||0)+xp;
          upd[`wh/txlog/${txKey(kidId)}`]  = { kidId, type:"chore", xp, cents:0, desc:chore.title, ts:Date.now() };
        }
        await FB.atomic(upd);
        toast(status==="done" ? `+${xp} XP for ${kid.name}! ⭐` : `${chore.title} sent for approval`, "success");
      }
    } catch(e) {
      toast("Save failed — check connection", "err");
    } finally {
      setOptim(o=>{const n={...o};delete n[key];return n;});
    }
  }

  async function approveComp(dk, choreId, kidId) {
    const chore = chores.find(c=>c.id===choreId);
    const kid   = kidById(kidId);
    const comp  = getComp(dk, choreId, kidId);
    if (!chore||!kid||!comp) return;
    const xp = comp.xp||chore.xp||5;
    const wk = weekKey(dk);
    await FB.atomic({
      [`wh/comps/${dk}/${choreId}_${kidId}/status`]     : "approved",
      [`wh/comps/${dk}/${choreId}_${kidId}/approvedAt`] : Date.now(),
      [`wh/kids/${kidId}/xp`]                           : (kid.xp||0)+xp,
      [`wh/weekXp/${wk}/${kidId}`]                      : (weekXp[wk]?.[kidId]||0)+xp,
      [`wh/txlog/${txKey(kidId)}`]                      : { kidId, type:"chore", xp, cents:0, desc:chore.title+" (approved)", ts:Date.now() },
    });
    toast(`Approved +${xp} XP for ${kid.name}`, "success");
  }

  async function rejectComp(dk, choreId, kidId) {
    await FB.atomic({ [`wh/comps/${dk}/${choreId}_${kidId}`]: null });
    toast("Chore rejected", "warn");
  }

  async function awardXp(kidId, amount) {
    const kid = kidById(kidId); if(!kid)return;
    const wk = weekKey(localDate());
    await FB.atomic({
      [`wh/kids/${kidId}/xp`]       : (kid.xp||0)+amount,
      [`wh/weekXp/${wk}/${kidId}`]  : (weekXp[wk]?.[kidId]||0)+amount,
    });
    toast(`+${amount} XP for ${kid.name}`, "success");
  }

  async function buyItem(item) {
    if (!activeKid) { toast("Select a kid first","warn"); return; }
    const kid = kidById(activeKid);
    if ((kid?.balanceCents||0) < item.priceCents) { toast("Not enough coins","warn"); return; }
    const id = txKey(activeKid);
    await FB.atomic({
      [`wh/kids/${activeKid}/balanceCents`] : (kid.balanceCents||0)-item.priceCents,
      [`wh/txlog/${id}`]                   : { kidId:activeKid, type:"purchase", xp:0, cents:-item.priceCents, desc:item.name, ts:Date.now() },
    });
    toast(`Purchased: ${item.name}! 🎉`, "success");
  }

  async function saveChore(data) {
    const id = data.id||`c${Date.now()}`;
    await FB.set(`wh/chores/${id}`, {...data, id});
    toast(data.id?"Chore updated ✓":"Chore added ✓", "success");
  }

  async function deleteChore(id) {
    await FB.del(`wh/chores/${id}`);
    toast("Chore deleted","warn");
  }

  async function saveKid(data) {
    const id = data.id||`k${Date.now()}`;
    await FB.set(`wh/kids/${id}`, { ...data, id, xp:data.xp||0, balanceCents:data.balanceCents||0, colorIdx:data.colorIdx!==undefined?data.colorIdx:kids.length%PALETTE.length });
    toast(data.id?"Updated ✓":"Kid added ✓","success");
  }

  /* ── Summer actions ── */
  async function completeSummerSession(kidId, kidName) {
    const today    = localDate();
    const dow      = new Date().toLocaleDateString("en-US",{weekday:"long"});
    const focus    = FOCUS_MAP[dow];
    if (!focus) return;
    const sk       = sumKids[kidId] || {};
    const prevDay  = prevSessionDay();
    const newStreak= sk.lastSessionDate===prevDay ? (sk.currentStreak||0)+1 : 1;
    const hasBonus = newStreak>=5;
    const xp       = hasBonus ? 15 : 10;
    const cents    = xp*5;
    const kid      = kidById(kidId);
    const wk       = weekKey(today);

    const sessRef  = `wh/summerSessions/${kidId}/${Date.now()}_${uid2()}`;
    const upd = {
      [sessRef] : { date:today, focus, xpAwarded:xp, streakBonus:hasBonus, completedAt:Date.now() },
      [`wh/summerProgram/kids/${kidId}/totalXPEarned`]          : (sk.totalXPEarned||0)+xp,
      [`wh/summerProgram/kids/${kidId}/totalSessionsCompleted`]  : (sk.totalSessionsCompleted||0)+1,
      [`wh/summerProgram/kids/${kidId}/currentStreak`]           : newStreak,
      [`wh/summerProgram/kids/${kidId}/longestStreak`]           : Math.max(newStreak,sk.longestStreak||0),
      [`wh/summerProgram/kids/${kidId}/lastSessionDate`]         : today,
      [`wh/summerProgram/kids/${kidId}/displayName`]             : kidName,
      [`wh/kids/${kidId}/xp`]                                    : (kid?.xp||0)+xp,
      [`wh/kids/${kidId}/balanceCents`]                          : (kid?.balanceCents||0)+cents,
      [`wh/weekXp/${wk}/${kidId}`]                               : (weekXp[wk]?.[kidId]||0)+xp,
    };
    await FB.atomic(upd);
    toast(`+${xp} XP${hasBonus?" 🔥 Streak bonus!":""}`, "success");
  }

  async function generateReport(type) {
    const today = localDate();
    const key   = type==="weekly" ? weekKey(today) : today.slice(0,7);
    const upd   = {};
    const now   = Date.now();

    for (const kid of kids) {
      const sessions = Object.values(sumSessions[kid.id]||{});
      const sk = sumKids[kid.id]||{};
      const filtered = type==="weekly"
        ? sessions.filter(s=>weekKey(s.date)===key)
        : sessions.filter(s=>s.date?.startsWith(key));
      const xpEarned = filtered.reduce((a,s)=>a+(s.xpAwarded||0),0);
      upd[`wh/reports/${type}/${kid.id}/${key}`] = {
        generatedAt:now, key, kidName:kid.name,
        sessionsCompleted:filtered.length, sessionsScheduled: type==="weekly"?4:16,
        xpEarned, centsEarned:xpEarned*5,
        currentStreak:sk.currentStreak||0, longestStreak:sk.longestStreak||0,
        mathSessions: filtered.filter(s=>s.focus==="math").length,
        literacySessions: filtered.filter(s=>s.focus==="literacy").length,
        totalXPToDate:sk.totalXPEarned||0,
      };
    }
    await FB.atomic(upd);
    toast(`${type==="weekly"?"Weekly":"Monthly"} report generated ✓`, "success");
  }

  /* ── Navigation helpers ── */
  function saveCfg(cfg) {
    ["wh_fbcfg","wh3_cfg"].forEach(k=>localStorage.setItem(k,JSON.stringify(cfg)));
    setFbCfg(cfg); setShowCfg(false);
  }
  function enterKid(kidId)   { setActiveKid(kidId); setScreen("kid"); setParentMode(false); setSelDate(localDate()); }
  function enterParent()     { setParentMode(true); setScreen("app"); setView("dashboard"); setActiveKid(null); }
  function exitToPicker()    { setScreen("picker"); setParentMode(false); setActiveKid(null); }
  function goParentPin()     { setScreen(hasPIN?"pin-verify":"pin-set"); }

  /* ══════════════ VIEWS ══════════════ */

  /* ── Chores View ── */
  function ChoresView() {
    const filtered = chores.filter(c =>
      (!activeKid || (c.assignedTo||[]).includes(activeKid)) &&
      isScheduled(c, selDate)
    );
    const dateLabel = isToday ? "Today" : parseLocal(selDate).toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"});
    const inKidMode = screen==="kid";

    return (
      <div>
        {/* Date nav */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button style={{...BTN.base,...BTN.ghost,...BTN.sm}}
            onClick={()=>{const d=parseLocal(selDate);d.setDate(d.getDate()-1);setSelDate(d.toLocaleDateString("en-CA"));}}>‹</button>
          <span style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700}}>{dateLabel}</span>
          <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} disabled={isToday}
            onClick={()=>{const d=parseLocal(selDate);d.setDate(d.getDate()+1);const s=d.toLocaleDateString("en-CA");if(s<=localDate())setSelDate(s);}}>›</button>
        </div>

        {/* Pending approvals (parent only) */}
        {parentMode && pendCount>0 && (
          <div className="card" style={{marginBottom:12,borderColor:"#FCD34D"}}>
            <div className="card-h">⏳ Pending approval</div>
            {chores.filter(c=>c.requiresApproval).flatMap(c =>
              kids.map(k => {
                const comp = getComp(localDate(),c.id,k.id);
                if (comp?.status!=="pending") return null;
                return (
                  <div key={k.id+c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
                    <span style={{flex:1,fontSize:13}}><strong>{k.name}</strong> — {c.title}</span>
                    <button style={{...BTN.base,...BTN.success,...BTN.sm}} onClick={()=>approveComp(localDate(),c.id,k.id)}>✓ Approve</button>
                    <button style={{...BTN.base,...BTN.danger,...BTN.sm}}  onClick={()=>rejectComp(localDate(),c.id,k.id)}>✗</button>
                  </div>
                );
              }).filter(Boolean)
            )}
          </div>
        )}

        {filtered.length===0 ? (
          <div className="empty">
            <div style={{fontSize:32,marginBottom:8}}>🎉</div>
            <div style={{fontWeight:700}}>{parentMode?"No chores scheduled":"Nothing today!"}</div>
          </div>
        ) : (
          filtered.map(c => {
            const kidsForChore = activeKid ? [kidById(activeKid)] : kids.filter(k=>(c.assignedTo||[]).includes(k.id));
            return kidsForChore.map(k => {
              if (!k) return null;
              const key    = `${c.id}_${k.id}`;
              const comp   = getComp(selDate, c.id, k.id);
              const isOpt  = optim[key];
              const status = comp?.status||"none";
              const isDone = status==="done"||status==="approved";
              const canTap = (inKidMode||!parentMode) && status!=="approved" && !isOpt;
              const pal    = PALETTE[k.colorIdx%PALETTE.length];
              return (
                <div key={key}
                  className={`ccard${isDone?" done":status==="pending"?" pending":isOpt?" opt":""}`}
                  onClick={()=>canTap&&completeChore(c.id,k.id)}>
                  <div className={`ccheck${isDone?" done":status==="pending"?" pending":isOpt?" opt":""}`}>
                    {isDone  && <span style={{color:"#fff",fontWeight:900,fontSize:13}}>✓</span>}
                    {status==="pending" && <span style={{fontSize:11}}>⏳</span>}
                    {isOpt&&!isDone && <span style={{color:C.primary,fontSize:11}}>…</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="ctitle" style={{textDecoration:isDone?"line-through":""}}>{c.title}</div>
                    {!activeKid && <div style={{fontSize:11,color:pal.accent,marginTop:2}}>{k.name}</div>}
                  </div>
                  <span className={`cdiff diff-${c.diff||"easy"}`}>{c.diff||"easy"}</span>
                  <span className="cxp">+{c.xp||5}</span>
                  {parentMode && (
                    <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                      <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={()=>{setEditingChore({...c});setShowChoreModal(true);}}>✏️</button>
                      <button style={{...BTN.base,...BTN.danger,...BTN.sm}} onClick={()=>{if(window.confirm(`Delete "${c.title}"?`))deleteChore(c.id);}}>🗑</button>
                    </div>
                  )}
                </div>
              );
            });
          })
        )}
      </div>
    );
  }

  /* ── Dashboard View ── */
  function DashboardView() {
    return (
      <div>
        {pendCount>0 && parentMode && (
          <div style={{background:"#FFFBEB",border:"1px solid #FCD34D",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13}}>
            <span style={{fontWeight:700,color:C.amber}}>⏳ {pendCount} chore{pendCount!==1?"s":""} awaiting approval</span>
            <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={()=>setView("chores")}>Review →</button>
          </div>
        )}
        <div className="dgrid">
          {kids.map(k => {
            const pal  = PALETTE[k.colorIdx%PALETTE.length];
            const xp   = k.xp||0;
            const lvl  = Math.floor(xp/100)+1;
            const pct  = ((xp%100)/100)*100;
            const wk   = weekKey(localDate());
            const wxp  = weekXp[wk]?.[k.id]||0;
            const goal = k.goal?.weeklyXp||100;
            const gpct = Math.min(100,Math.round((wxp/goal)*100));
            const sk   = sumKids[k.id];
            return (
              <div key={k.id} className="kcard" onClick={()=>enterKid(k.id)}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <Avatar initials={k.initials} colorIdx={k.colorIdx} size={44}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:800}}>{k.name}</div>
                    <div style={{fontSize:11,color:C.text2}}>Age {k.age} · Level {lvl}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:16,fontWeight:900,color:C.amber}}>{cents2(k.balanceCents||0)}</div>
                    <div style={{fontSize:10,color:C.text3}}>balance</div>
                  </div>
                </div>
                {/* XP level bar */}
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.text2,marginBottom:3}}>
                    <span>{xp%100}/100 XP</span><span style={{color:pal.accent}}>Lvl {lvl}</span>
                  </div>
                  <div className="pbar"><div className="pbar-f" style={{width:`${pct}%`,background:pal.accent}}/></div>
                </div>
                {/* Weekly goal bar */}
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.text2,marginBottom:3}}>
                    <span>Weekly {wxp}/{goal} XP</span>
                    <span style={{color:gpct>=100?C.green:C.text2,fontWeight:gpct>=100?800:400}}>{gpct}%{gpct>=100?" 🎯":""}</span>
                  </div>
                  <div className="pbar"><div className="pbar-f" style={{width:`${gpct}%`,background:gpct>=100?C.green:pal.accent}}/></div>
                </div>
                {sk && (
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <span className="chip">☀️ {sk.totalSessionsCompleted||0} sessions</span>
                    <span className="chip">⭐ {sk.totalXPEarned||0} XP</span>
                    {(sk.currentStreak||0)>0 && <span className="chip">{sk.currentStreak>=5?"🔥":"⚡"}{sk.currentStreak}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Store View ── */
  function StoreView() {
    const kid     = activeKid?kidById(activeKid):null;
    const balance = kid?.balanceCents||0;
    const items   = [...STORE_DEFAULTS,...storeItems];
    return (
      <div>
        {kid && <div style={{fontSize:14,fontWeight:800,color:C.amber,marginBottom:14}}>💰 {kid.name}'s balance: {cents2(balance)}</div>}
        {!kid  && <div className="card" style={{marginBottom:14,fontSize:13,color:C.text2}}>👆 Select a kid in the sidebar to buy items.</div>}
        <div className="sgrid">
          {items.map(item => {
            const canAfford = kid && balance>=item.priceCents;
            const cantAfford = kid && balance<item.priceCents;
            return (
              <div key={item.id} className={`sitem${canAfford?" afford":cantAfford?" no-afford":""}`}
                onClick={()=>canAfford&&buyItem(item)}>
                <div style={{fontSize:30,marginBottom:6}}>{item.emoji}</div>
                <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{item.name}</div>
                <div style={{fontSize:12,fontWeight:800,color:C.amber}}>{cents2(item.priceCents)}</div>
                {kid && <div style={{fontSize:10,marginTop:4,color:canAfford?C.green:C.red,fontWeight:700}}>{canAfford?"✓ Can afford":"Need more"}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  /* ── Money View ── */
  function MoneyView() {
    return (
      <div>
        <div className="dgrid" style={{marginBottom:14}}>
          {kids.map(k => {
            const pal = PALETTE[k.colorIdx%PALETTE.length];
            const bal = k.balanceCents||0;
            return (
              <div key={k.id} className="card">
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <Avatar initials={k.initials} colorIdx={k.colorIdx} size={36}/>
                  <div>
                    <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
                    <div style={{fontSize:18,fontWeight:900,color:C.amber}}>{cents2(bal)}</div>
                  </div>
                </div>
                {[{l:"Save",pct:50,c:C.green},{l:"Spend",pct:40,c:C.amber},{l:"Share",pct:10,c:C.primary}].map(b=>(
                  <div key={b.l} style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,fontSize:12}}>
                    <span style={{width:38,color:C.text2}}>{b.l}</span>
                    <div className="pbar" style={{flex:1}}><div className="pbar-f" style={{width:`${b.pct}%`,background:b.c}}/></div>
                    <span style={{width:44,textAlign:"right",fontWeight:700}}>{cents2(Math.round(bal*(b.pct/100)))}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="card">
          <div className="card-h">Recent transactions</div>
          {txLog.slice(0,25).map(tx => {
            const k = kidById(tx.kidId);
            return (
              <div key={tx.ts+tx.kidId} className="alog-row">
                <div style={{fontSize:11,color:C.text3,width:76,flexShrink:0}}>{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                <div style={{flex:1,fontSize:13,minWidth:0}}><strong>{k?.name||"?"}</strong> — {tx.desc}</div>
                {tx.xp>0 && <span className="pill pill-blue">+{tx.xp} XP</span>}
                {!!tx.cents && <span className={`pill ${tx.cents>0?"pill-green":"pill-amber"}`}>{tx.cents>0?"+":""}{cents2(Math.abs(tx.cents))}</span>}
              </div>
            );
          })}
          {txLog.length===0 && <div className="empty" style={{padding:"1rem 0"}}>No transactions yet.</div>}
        </div>
      </div>
    );
  }

  /* ── Activity View ── */
  function ActivityView() {
    return (
      <div className="card">
        <div className="card-h">Activity log — {txLog.length} entries</div>
        {txLog.slice(0,60).map(tx => {
          const k = kidById(tx.kidId);
          return (
            <div key={tx.ts+tx.kidId+tx.desc} className="alog-row">
              <div style={{fontSize:11,color:C.text3,width:100,flexShrink:0}}>
                {new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})} {new Date(tx.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}
              </div>
              <div style={{flex:1,fontSize:13,minWidth:0}}><strong>{k?.name||"?"}</strong> — {tx.desc}</div>
              {tx.xp>0 && <span className="pill pill-blue">+{tx.xp} XP</span>}
            </div>
          );
        })}
        {txLog.length===0 && <div className="empty" style={{padding:"1rem 0"}}>No activity yet.</div>}
      </div>
    );
  }

  /* ── Summer View ── */
  function SummerView() {
    const [sumTab, setSumTab] = useState("overview");
    const [selWeek,  setSelWeek]  = useState(weekKey(localDate()));
    const [selMonth, setSelMonth] = useState(localDate().slice(0,7));
    const [genBusy,  setGenBusy]  = useState(false);

    const today = localDate();
    const dow   = new Date().toLocaleDateString("en-US",{weekday:"long"});
    const focus = FOCUS_MAP[dow];

    const allWeeks  = Array.from(new Set(Object.values(sumWeekly).flatMap(k=>Object.keys(k)))).sort().reverse();
    const allMonths = Array.from(new Set(Object.values(sumMonthly).flatMap(k=>Object.keys(k)))).sort().reverse();

    const KidSumCard = ({ kid }) => {
      const sk     = sumKids[kid.id]||{};
      const todayDone = Object.values(sumSessions[kid.id]||{}).some(s=>s.date===today);
      const streak = sk.currentStreak||0;
      const hasBonus = streak>=5, nearBonus = streak>=3&&!hasBonus;
      const sessXP = hasBonus?15:10;
      const pal = PALETTE[kid.colorIdx%PALETTE.length];
      return (
        <div className="sum-card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Avatar initials={kid.initials} colorIdx={kid.colorIdx} size={32}/>
              <span style={{fontWeight:800,fontSize:14}}>{kid.name}</span>
            </div>
            <span style={{fontSize:12,color:C.text2}}>{dow}</span>
          </div>
          <div className="sum-stats">
            {[{ic:streak>=5?"🔥":streak>0?"⚡":"○",v:streak,l:"streak"},{ic:"⭐",v:sk.totalXPEarned||0,l:"XP"},{ic:"📚",v:sk.totalSessionsCompleted||0,l:"sessions"}].map(s=>(
              <div key={s.l} className="sum-stat">
                <div style={{fontSize:14}}>{s.ic}</div>
                <div style={{fontSize:15,fontWeight:800}}>{s.v}</div>
                <div style={{fontSize:10,color:C.text3,textTransform:"uppercase",letterSpacing:".04em"}}>{s.l}</div>
              </div>
            ))}
          </div>
          {nearBonus && <div className="streak-alert" style={{background:"#FFFBEB",border:"1px solid #FCD34D",color:C.amber}}>⚡ {5-streak} more session{5-streak!==1?"s":""} to unlock 🔥 streak bonus (+50% XP)</div>}
          {hasBonus  && <div className="streak-alert" style={{background:"#FEF3C7",border:"1px solid #F59E0B",color:"#92400E"}}>🔥 Streak bonus ACTIVE — earning 15 XP per session!</div>}
          {!focus ? (
            <div style={{textAlign:"center",padding:"10px 0",fontSize:13,color:C.text3}}>🏖️ No session today — enjoy the break!</div>
          ) : todayDone ? (
            <div style={{background:C.gLight,border:`1px solid #A7F3D0`,borderRadius:8,padding:"8px 12px",fontSize:13,color:C.green,fontWeight:700}}>✅ Today's session done! Great work.</div>
          ) : (
            <div>
              <div style={{fontSize:12,color:C.text2,marginBottom:8}}>
                Today's focus: <strong style={{color:C.text}}>{focus==="math"?"🔢 Math":"📖 Literacy"}</strong>
                <span style={{float:"right",background:pal.accent,color:"#fff",borderRadius:12,padding:"1px 9px",fontSize:11,fontWeight:700}}>+{sessXP} XP</span>
              </div>
              <button style={{...BTN.base,...BTN.primary,width:"100%",justifyContent:"center",padding:"12px",fontSize:14,fontWeight:800}}
                onClick={()=>completeSummerSession(kid.id,kid.name)}>
                ✅ Mark Session Complete
              </button>
            </div>
          )}
        </div>
      );
    };

    const ReportCard = ({ report, colorIdx }) => {
      if (!report) return null;
      const pal = PALETTE[colorIdx%PALETTE.length];
      const attPct = Math.round((report.attendanceRate||0)*100);
      return (
        <div className="rep-card" style={{borderLeft:`4px solid ${pal.accent}`}}>
          <div className="rep-head">
            <strong style={{color:pal.accent}}>{report.kidName}</strong>
            <span style={{fontSize:11,color:C.text2}}>{report.key}</span>
          </div>
          <div className="rep-stats">
            {[
              {v:`${report.sessionsCompleted||0}/${report.sessionsScheduled||4}`,l:"sessions"},
              {v:`+${report.xpEarned||0}`,l:"XP"},
              {v:cents2((report.centsEarned||0)),l:"earned"},
              {v:`${report.currentStreak||0}${(report.currentStreak||0)>=5?"🔥":""}`,l:"streak"},
            ].map(s=>(
              <div key={s.l} className="rep-stat">
                <div style={{fontSize:15,fontWeight:800}}>{s.v}</div>
                <div style={{fontSize:9,color:C.text3,textTransform:"uppercase",letterSpacing:".05em"}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{padding:"8px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:C.text2,marginBottom:4}}>
              <span>Attendance</span><span style={{color:pal.accent,fontWeight:800}}>{attPct}%</span>
            </div>
            <div className="pbar"><div className="pbar-f" style={{width:`${attPct}%`,background:pal.accent}}/></div>
            <div style={{fontSize:11,color:C.text3,marginTop:6}}>Season: {report.totalXPToDate||0} XP total</div>
          </div>
        </div>
      );
    };

    const handleGen = async (type) => {
      setGenBusy(true);
      try { await generateReport(type); }
      finally { setGenBusy(false); }
    };

    return (
      <div>
        {/* Status banner */}
        {isSummerActive()
          ? <div style={{background:C.pLight,border:`1px solid #C7D2FE`,borderRadius:10,padding:"8px 14px",fontSize:12,color:C.primary,fontWeight:600,marginBottom:14}}>☀️ Program active · Week {summerWeeksElapsed()} of ~10 · 10 XP/session · Streak bonus at 5 sessions (Mon–Thu)</div>
          : <div style={{background:C.gLight,border:`1px solid #A7F3D0`,borderRadius:10,padding:"8px 14px",fontSize:12,color:C.green,fontWeight:600,marginBottom:14}}>☀️ Program starts {SUMMER_START}</div>
        }

        {/* Tabs */}
        <div style={{display:"flex",gap:6,marginBottom:14}} className="no-print">
          {[{id:"overview",l:"📊 Overview"},{id:"sessions",l:"☀️ Sessions"},{id:"weekly",l:"📅 Weekly"},{id:"monthly",l:"📆 Monthly"}].map(t=>(
            <button key={t.id} onClick={()=>setSumTab(t.id)}
              style={{...BTN.base,...(sumTab===t.id?BTN.primary:BTN.ghost),...BTN.sm}}>{t.l}</button>
          ))}
          <div style={{flex:1}}/>
          <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={()=>window.print()}>🖨️ PDF</button>
        </div>

        {/* Overview */}
        {sumTab==="overview" && (
          <div className="rep-grid">
            {kids.map((k,i) => {
              const sk      = sumKids[k.id]||{};
              const total   = sk.totalSessionsCompleted||0;
              const exp     = summerWeeksElapsed()*4;
              const attPct  = exp>0?Math.round((total/exp)*100):0;
              const pal     = PALETTE[i%PALETTE.length];
              return (
                <div key={k.id} className="rep-card" style={{borderLeft:`4px solid ${pal.accent}`}}>
                  <div className="rep-head">
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <Avatar initials={k.initials} colorIdx={i} size={28}/>
                      <strong style={{color:pal.accent}}>{k.name}</strong>
                    </div>
                    <span style={{fontSize:14,fontWeight:900,color:(sk.currentStreak||0)>=5?"#F59E0B":pal.accent}}>{(sk.currentStreak||0)>=5?"🔥":"⚡"}{sk.currentStreak||0}</span>
                  </div>
                  <div className="rep-stats">
                    {[{v:total,l:"sessions"},{v:`+${sk.totalXPEarned||0}`,l:"XP"},{v:cents2((sk.totalXPEarned||0)*5),l:"earned"},{v:`${attPct}%`,l:"attend."}].map(s=>(
                      <div key={s.l} className="rep-stat">
                        <div style={{fontSize:15,fontWeight:800}}>{s.v}</div>
                        <div style={{fontSize:9,color:C.text3,textTransform:"uppercase",letterSpacing:".05em"}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{padding:"8px 14px"}}>
                    <div className="pbar"><div className="pbar-f" style={{width:`${attPct}%`,background:pal.accent}}/></div>
                    <div style={{fontSize:11,color:C.text3,marginTop:5}}>Best streak: {sk.longestStreak||0} days</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sessions */}
        {sumTab==="sessions" && (
          <div>
            {kids.map(k=><div key={k.id} style={{marginBottom:8}}><KidSumCard kid={k}/></div>)}
          </div>
        )}

        {/* Weekly */}
        {sumTab==="weekly" && (
          <div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
              <label style={{fontSize:12,color:C.text2}}>Week:</label>
              <select className="fi" style={{width:"auto"}} value={selWeek} onChange={e=>setSelWeek(e.target.value)}>
                {allWeeks.length?allWeeks.map(w=><option key={w} value={w}>{w}</option>):<option value={selWeek}>{selWeek}</option>}
              </select>
              <button style={{...BTN.base,...BTN.primary,...BTN.sm}} disabled={genBusy} onClick={()=>handleGen("weekly")}>
                {genBusy?"Generating...":"⚡ Generate"}
              </button>
            </div>
            <div className="rep-grid">
              {kids.map((k,i)=><ReportCard key={k.id} report={sumWeekly[k.id]?.[selWeek]} colorIdx={i}/>)}
            </div>
            {kids.every(k=>!sumWeekly[k.id]?.[selWeek]) && <div className="empty">No report for {selWeek} yet. Click Generate.</div>}
          </div>
        )}

        {/* Monthly */}
        {sumTab==="monthly" && (
          <div>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12,flexWrap:"wrap"}}>
              <label style={{fontSize:12,color:C.text2}}>Month:</label>
              <select className="fi" style={{width:"auto"}} value={selMonth} onChange={e=>setSelMonth(e.target.value)}>
                {allMonths.length?allMonths.map(m=><option key={m} value={m}>{m}</option>):<option value={selMonth}>{selMonth}</option>}
              </select>
              <button style={{...BTN.base,...BTN.primary,...BTN.sm}} disabled={genBusy} onClick={()=>handleGen("monthly")}>
                {genBusy?"Generating...":"⚡ Generate"}
              </button>
            </div>
            <div className="rep-grid">
              {kids.map((k,i)=><ReportCard key={k.id} report={sumMonthly[k.id]?.[selMonth]} colorIdx={i}/>)}
            </div>
            {kids.every(k=>!sumMonthly[k.id]?.[selMonth]) && <div className="empty">No report for {selMonth} yet. Click Generate.</div>}
          </div>
        )}
      </div>
    );
  }

  /* ── Settings View ── */
  function SettingsView() {
    return (
      <div className="card">
        {[
          { l:"Firebase", s:ready?`🟢 Connected${!online?" · ⚠️ Offline":""}`: "🔴 Demo mode", btn:"Configure", fn:()=>setShowCfg(true) },
          { l:"Parent PIN", s:hasPIN?"PIN is set":"No PIN set", btn:hasPIN?"Change PIN":"Set PIN", fn:()=>setScreen("pin-set") },
          { l:"Focus timer", s:"25-min Pomodoro with XP bonus", btn:"Start", fn:()=>setShowTimer(true) },
        ].map(r=>(
          <div key={r.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:`1px solid ${C.border}`}}>
            <div><div style={{fontWeight:700,fontSize:13}}>{r.l}</div><div style={{fontSize:11,color:C.text2,marginTop:2}}>{r.s}</div></div>
            <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={r.fn}>{r.btn}</button>
          </div>
        ))}
        <div style={{padding:"12px 0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div><div style={{fontWeight:700,fontSize:13}}>Parent mode</div><div style={{fontSize:11,color:C.text2,marginTop:2}}>Manage chores, approve tasks, edit settings</div></div>
          <label className="sw"><input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/><div className="sw-t"/><div className="sw-th"/></label>
        </div>
      </div>
    );
  }

  /* ── Chore Modal ── */
  function ChoreModal({ init, onClose }) {
    const blank = { title:"", diff:"easy", scheduleType:"daily", scheduleDays:[], assignedTo:[], requiresApproval:false, xp:5 };
    const [f, setF] = useState(init||blank);
    const tog = (arr,v) => arr?.includes(v)?arr.filter(x=>x!==v):[...(arr||[]),v];
    return (
      <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">{init?"Edit Chore":"Add Chore"}</div>
        <div className="fg"><label className="fl">Title</label>
          <input className="fi" placeholder="Chore name" value={f.title} onChange={e=>setF(x=>({...x,title:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Difficulty & XP</label>
          <select className="fi" value={f.diff} onChange={e=>{const d=e.target.value;setF(x=>({...x,diff:d,xp:d==="easy"?5:d==="medium"?20:35}));}}>
            <option value="easy">Easy — 5 XP</option>
            <option value="medium">Medium — 20 XP</option>
            <option value="hard">Hard — 35 XP</option>
          </select></div>
        <div className="fg"><label className="fl">Custom XP (optional)</label>
          <input className="fi" type="number" min="1" max="500" value={f.xp} onChange={e=>setF(x=>({...x,xp:+e.target.value}))}/></div>
        <div className="fg"><label className="fl">Schedule</label>
          <select className="fi" value={f.scheduleType} onChange={e=>setF(x=>({...x,scheduleType:e.target.value}))}>
            <option value="daily">Every day</option>
            <option value="weekly">Specific days</option>
          </select></div>
        {f.scheduleType==="weekly" && (
          <div className="fg"><label className="fl">Days</label>
            <div className="frow">{DAYS.map(d=>(
              <button key={d} style={{...BTN.base,...(f.scheduleDays?.includes(d)?BTN.primary:BTN.ghost),...BTN.sm}} onClick={()=>setF(x=>({...x,scheduleDays:tog(x.scheduleDays,d)}))}>
                {d}
              </button>
            ))}</div></div>
        )}
        <div className="fg"><label className="fl">Assign to</label>
          <div className="frow">{kids.map(k=>(
            <button key={k.id} style={{...BTN.base,...(f.assignedTo?.includes(k.id)?BTN.primary:BTN.ghost),...BTN.sm}} onClick={()=>setF(x=>({...x,assignedTo:tog(x.assignedTo,k.id)}))}>
              {k.name}
            </button>
          ))}</div></div>
        <div className="sw-row">
          <span style={{fontSize:13,fontWeight:600}}>Requires parent approval</span>
          <label className="sw"><input type="checkbox" checked={!!f.requiresApproval} onChange={e=>setF(x=>({...x,requiresApproval:e.target.checked}))}/><div className="sw-t"/><div className="sw-th"/></label>
        </div>
        <div className="fax">
          {init && <button style={{...BTN.base,...BTN.danger}} onClick={()=>{deleteChore(init.id);onClose();}}>Delete</button>}
          <button style={{...BTN.base,...BTN.ghost}} onClick={onClose}>Cancel</button>
          <button style={{...BTN.base,...BTN.primary}} onClick={()=>{if(!f.title.trim())return;saveChore(f);onClose();}}>
            {init?"Save changes":"Add chore"}
          </button>
        </div>
      </div></div>
    );
  }

  function KidModal({ onClose }) {
    const [f,setF] = useState({name:"",age:"",initials:""});
    return (
      <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">Add Kid</div>
        <div className="fg"><label className="fl">Name</label><input className="fi" placeholder="First name" value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Age</label><input className="fi" type="number" min="3" max="21" value={f.age} onChange={e=>setF(x=>({...x,age:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Initials</label><input className="fi" maxLength={2} placeholder="TW" value={f.initials} onChange={e=>setF(x=>({...x,initials:e.target.value.toUpperCase()}))}/></div>
        <div className="fax">
          <button style={{...BTN.base,...BTN.ghost}} onClick={onClose}>Cancel</button>
          <button style={{...BTN.base,...BTN.primary}} onClick={()=>{if(!f.name.trim()||!f.initials.trim())return;saveKid(f);onClose();}}>Add kid</button>
        </div>
      </div></div>
    );
  }

  function StoreItemModal({ onClose }) {
    const [f,setF] = useState({name:"",emoji:"🎁",priceCents:100});
    return (
      <div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">Add Store Item</div>
        <div className="fg"><label className="fl">Name</label><input className="fi" placeholder="Item name" value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Emoji</label><input className="fi" value={f.emoji} onChange={e=>setF(x=>({...x,emoji:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Price in cents (100 = $1.00)</label><input className="fi" type="number" min="1" value={f.priceCents} onChange={e=>setF(x=>({...x,priceCents:+e.target.value}))}/></div>
        <div className="fax">
          <button style={{...BTN.base,...BTN.ghost}} onClick={onClose}>Cancel</button>
          <button style={{...BTN.base,...BTN.primary}} onClick={()=>{if(!f.name.trim())return;FB.set(`wh/store/si${Date.now()}`,{...f,id:`si${Date.now()}`});toast("Item added","success");onClose();}}>Add item</button>
        </div>
      </div></div>
    );
  }

  /* ── Kid Mode App ── */
  function KidModeApp() {
    const kid = kidById(activeKid);
    const [kmTab, setKmTab] = useState("chores");
    if (!kid) return null;
    const pal = PALETTE[kid.colorIdx%PALETTE.length];
    return (
      <div className="km-wrap">
        {!online && ready && <div className="offline-bar">⚠️ Offline — changes will sync when reconnected</div>}
        <div className="km-header">
          <Avatar initials={kid.initials} colorIdx={kid.colorIdx} size={40}/>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:900}}>{kid.name}</div>
            <div style={{fontSize:11,color:C.text2}}>Level {Math.floor((kid.xp||0)/100)+1} · {kid.xp||0} XP · {cents2(kid.balanceCents||0)}</div>
          </div>
          <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={exitToPicker}>← Home</button>
        </div>
        <div className="km-tabs">
          {[{id:"chores",l:"✓ Tasks"},{id:"summer",l:"☀️ Summer"},{id:"store",l:"🛍 Store"},{id:"money",l:"💰 Money"}].map(t=>(
            <button key={t.id} className={`km-tab${kmTab===t.id?" act":""}`} onClick={()=>setKmTab(t.id)}>{t.l}</button>
          ))}
        </div>
        <div className="km-content">
          <ErrBound>
            {kmTab==="chores" && <ChoresView/>}
            {kmTab==="summer" && (
              <div>
                {isSummerActive() ? (
                  (() => {
                    const dow   = new Date().toLocaleDateString("en-US",{weekday:"long"});
                    const focus = FOCUS_MAP[dow];
                    const sk    = sumKids[kid.id]||{};
                    const today = localDate();
                    const done  = Object.values(sumSessions[kid.id]||{}).some(s=>s.date===today);
                    const streak= sk.currentStreak||0;
                    const hasB  = streak>=5, nearB = streak>=3&&!hasB;
                    const sessXP= hasB?15:10;
                    return (
                      <div className="sum-card">
                        <div style={{fontWeight:800,fontSize:14,marginBottom:10,color:C.primary}}>☀️ Summer Learning</div>
                        <div className="sum-stats">
                          {[{ic:hasB?"🔥":streak>0?"⚡":"○",v:streak,l:"streak"},{ic:"⭐",v:sk.totalXPEarned||0,l:"XP"},{ic:"📚",v:sk.totalSessionsCompleted||0,l:"sessions"}].map(s=>(
                            <div key={s.l} className="sum-stat">
                              <div style={{fontSize:14}}>{s.ic}</div>
                              <div style={{fontSize:16,fontWeight:800}}>{s.v}</div>
                              <div style={{fontSize:10,color:C.text3,textTransform:"uppercase"}}>{s.l}</div>
                            </div>
                          ))}
                        </div>
                        {nearB && <div className="streak-alert" style={{background:"#FFFBEB",border:"1px solid #FCD34D",color:C.amber}}>⚡ {5-streak} more to unlock 🔥 bonus</div>}
                        {hasB  && <div className="streak-alert" style={{background:"#FEF3C7",border:"1px solid #F59E0B",color:"#92400E"}}>🔥 Streak bonus ACTIVE — 15 XP/session!</div>}
                        {!focus ? <div style={{textAlign:"center",color:C.text3,padding:"10px 0",fontSize:13}}>🏖️ No session today</div>
                        : done  ? <div style={{background:C.gLight,border:`1px solid #A7F3D0`,borderRadius:8,padding:"10px 12px",fontSize:13,color:C.green,fontWeight:700}}>✅ Today's session complete!</div>
                        : <div>
                            <div style={{fontSize:12,color:C.text2,marginBottom:8}}>Today: <strong>{focus==="math"?"🔢 Math":"📖 Literacy"}</strong><span style={{float:"right",background:pal.accent,color:"#fff",borderRadius:12,padding:"1px 9px",fontSize:11,fontWeight:700}}>+{sessXP} XP</span></div>
                            <button style={{...BTN.base,...BTN.primary,width:"100%",justifyContent:"center",padding:"14px",fontSize:15,fontWeight:800}}
                              onClick={()=>completeSummerSession(kid.id,kid.name)}>✅ Session Complete</button>
                          </div>
                        }
                      </div>
                    );
                  })()
                ) : <div className="empty"><div style={{fontSize:32,marginBottom:8}}>☀️</div><div>Summer program starts {SUMMER_START}</div></div>}
              </div>
            )}
            {kmTab==="store" && <StoreView/>}
            {kmTab==="money" && <MoneyView/>}
          </ErrBound>
        </div>
      </div>
    );
  }

  /* ══════════════ SCREEN ROUTING ══════════════ */
  const Toasts = () => (
    <div className="toasts">
      {toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
    </div>
  );

  if (screen==="picker") return (
    <>
      <style>{CSS}</style>
      {!online&&ready&&<div className="offline-bar">⚠️ Offline</div>}
      {showCfg&&<FirebaseCfgModal onSave={saveCfg} onSkip={()=>setShowCfg(false)}/>}
      <div className="picker">
        <div style={{fontSize:28,fontWeight:900,color:C.primary,marginBottom:4}}>WattsHub</div>
        <div style={{fontSize:14,color:C.text2,marginBottom:32}}>Who's using the app?</div>
        <div className="picker-grid">
          {kids.map(k=>{const pal=PALETTE[k.colorIdx%PALETTE.length];return(
            <div key={k.id} className="pcard" onClick={()=>enterKid(k.id)}>
              <Avatar initials={k.initials} colorIdx={k.colorIdx} size={52}/>
              <div style={{fontSize:15,fontWeight:800}}>{k.name}</div>
              <div style={{fontSize:11,color:C.text2}}>Age {k.age}</div>
              {(sumKids[k.id]?.currentStreak||0)>0&&<span style={{fontSize:12,fontWeight:800,color:pal.accent}}>{sumKids[k.id].currentStreak>=5?"🔥":"⚡"}{sumKids[k.id].currentStreak} streak</span>}
            </div>
          );})}
          <div className="pcard" onClick={goParentPin}>
            <div style={{width:52,height:52,borderRadius:"50%",background:"#FFFBEB",color:C.amber,fontSize:24,display:"flex",alignItems:"center",justifyContent:"center"}}>🔑</div>
            <div style={{fontSize:15,fontWeight:800}}>Parent</div>
            <div style={{fontSize:11,color:C.text2}}>PIN required</div>
          </div>
        </div>
        {!ready&&<div style={{marginTop:24,fontSize:12,color:C.text3}}>Demo mode — <button onClick={()=>setShowCfg(true)} style={{...BTN.base,...BTN.ghost,...BTN.sm}}>Connect Firebase</button></div>}
      </div>
      <Toasts/>
    </>
  );

  if (screen==="pin-set")    return (<><style>{CSS}</style><PINScreen mode="set"    onSuccess={enterParent} onBack={()=>setScreen("picker")}/></>);
  if (screen==="pin-verify") return (<><style>{CSS}</style><PINScreen mode="verify" onSuccess={enterParent} onBack={()=>setScreen("picker")}/></>);
  if (screen==="kid")        return (<><style>{CSS}</style><ErrBound><KidModeApp/></ErrBound><Toasts/></>);

  /* ── Parent App ── */
  const NAV = [
    {id:"dashboard",ic:"⊞",l:"Dashboard"},
    {id:"chores",   ic:"✓",l:"Chores"},
    {id:"store",    ic:"🛍️",l:"Store"},
    {id:"money",    ic:"💵",l:"Money"},
    {id:"activity", ic:"↻",l:"Activity"},
    {id:"summer",   ic:"☀️",l:"Summer"},
    {id:"settings", ic:"⚙",l:"Settings"},
  ];
  const BNAV = [
    {id:"dashboard",ic:"⊞",l:"Home"},
    {id:"chores",   ic:"✓",l:"Chores"},
    {id:"summer",   ic:"☀️",l:"Summer"},
    {id:"store",    ic:"🛍️",l:"Store"},
    {id:"activity", ic:"↻",l:"Log"},
  ];
  const TITLES = { dashboard:"Dashboard", chores:"Chores", store:"Store", money:"Money", activity:"Activity", summer:"Summer Program", settings:"Settings" };

  return (
    <>
      <style>{CSS}</style>
      {!online&&ready&&<div className="offline-bar">⚠️ Offline — changes will sync when reconnected</div>}
      {showCfg           && <FirebaseCfgModal onSave={saveCfg} onSkip={()=>setShowCfg(false)}/>}
      {showChoreModal    && <ChoreModal key={editingChore?.id||"new"} init={editingChore||null} onClose={()=>{setShowChoreModal(false);setEditingChore(null);}}/>}
      {showKidModal      && <KidModal onClose={()=>setShowKidModal(false)}/>}
      {showItemModal     && <StoreItemModal onClose={()=>setShowItemModal(false)}/>}
      {showTimer         && <FocusTimerModal kids={kids} onClose={()=>setShowTimer(false)} onAwardXp={awardXp}/>}

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="slogo">
            WattsHub
            {!ready && <span style={{fontSize:9,background:C.amber,color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:800,marginLeft:6}}>DEMO</span>}
            {ready&&!online && <span style={{fontSize:9,background:C.red,color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:800,marginLeft:6}}>OFFLINE</span>}
          </div>
          <div className="snav">
            <div className="sdiv">Navigate</div>
            {NAV.map(n=>(
              <button key={n.id} className={`sni${view===n.id?" act":""}`}
                onClick={()=>{setView(n.id);if(!["chores","store","money"].includes(n.id))setActiveKid(null);}}>
                <span className="sni-ic">{n.ic}</span>{n.l}
                {n.id==="chores"&&pendCount>0&&<span className="sbadge">{pendCount}</span>}
              </button>
            ))}
            <div className="sdiv" style={{marginTop:8}}>Kids</div>
            {kids.map(k=>(
              <button key={k.id} className={`skid${activeKid===k.id?" act":""}`}
                onClick={()=>{setActiveKid(k.id);setSelDate(localDate());setView("chores");}}>
                <Avatar initials={k.initials} colorIdx={k.colorIdx} size={22}/>
                <span style={{flex:1}}>{k.name}</span>
                <span style={{fontSize:11,color:C.amber,fontWeight:700}}>{cents2(k.balanceCents||0)}</span>
              </button>
            ))}
            {activeKid&&(
              <button className="skid" style={{color:C.text3}} onClick={()=>{setActiveKid(null);setView("dashboard");}}>
                <span style={{width:22,textAlign:"center"}}>←</span>All kids
              </button>
            )}
          </div>
          <div className="sfoot">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:600,color:C.text2}}>Parent mode</span>
              <label className="sw"><input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/><div className="sw-t"/><div className="sw-th"/></label>
            </div>
            <button className="sni" style={{color:C.text3}} onClick={exitToPicker}><span className="sni-ic">←</span>Profile picker</button>
            <button className="sni" style={{color:C.text3}} onClick={()=>setShowCfg(true)}><span className="sni-ic">⚙</span>Firebase setup</button>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          <div className="topbar">
            <div>
              <div style={{fontSize:16,fontWeight:800}}>{TITLES[view]||view}</div>
              <div style={{fontSize:11,color:C.text2,marginTop:1}}>
                {view==="chores"?(activeKid?kidById(activeKid)?.name+" · ":"")+( isToday?"Today":parseLocal(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})):
                 view==="money"?(activeKid?kidById(activeKid)?.name+"'s balance":"All balances"):
                 view==="store"?"Spend your coins":""}
              </div>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {ready && <span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:5,background:online?C.gLight:C.aLight,color:online?C.green:C.amber}}>{online?"● Live":"⚠ Offline"}</span>}
              {pendCount>0&&parentMode && <span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:5,background:C.aLight,color:C.amber}}>{pendCount} pending</span>}
              {parentMode && <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={()=>setShowTimer(true)} title="Focus timer">⏱</button>}
              {parentMode&&view==="store" && <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={()=>setShowItemModal(true)}>+ Item</button>}
              {parentMode && <button style={{...BTN.base,...BTN.primary,...BTN.sm}} onClick={()=>{setEditingChore(null);setShowChoreModal(true);}}>+ Chore</button>}
              {parentMode && <button style={{...BTN.base,...BTN.ghost,...BTN.sm}} onClick={()=>setShowKidModal(true)}>+ Kid</button>}
            </div>
          </div>
          <div className="content">
            <ErrBound>
              {view==="dashboard" && <DashboardView/>}
              {view==="chores"    && <ChoresView/>}
              {view==="store"     && <StoreView/>}
              {view==="money"     && <MoneyView/>}
              {view==="activity"  && <ActivityView/>}
              {view==="summer"    && <SummerView/>}
              {view==="settings"  && <SettingsView/>}
            </ErrBound>
          </div>
        </main>
      </div>

      {/* Bottom nav */}
      <nav className="bnav"><div className="bnav-in">
        {BNAV.map(n=>(
          <button key={n.id} className={`bnav-btn${view===n.id?" act":""}`}
            onClick={()=>{setView(n.id);if(!["chores","store"].includes(n.id))setActiveKid(null);}}>
            <span className="bnav-ic">{n.ic}</span>{n.l}
          </button>
        ))}
      </div></nav>
      <Toasts/>
    </>
  );
}

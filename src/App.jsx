import{useState,useEffect,useCallback,useMemo,useRef}from"react";
import{SummerView,KidSummerCard,SummerNavBadge}from"./components/summer/SummerModule";

/* ─── Firebase loader ─────────────────────────────────────────────────────── */
let _db=null,_ref=null,_set=null,_update=null,_on=null,_off=null,_remove=null,_push=null,_auth=null,_anon=null,_authState=null;
async function initFirebase(cfg){
  try{
    const{initializeApp,getApps,getApp}=await import("https://esm.sh/firebase/app");
    const{getDatabase,ref,set,update,onValue,off,remove,push}=await import("https://esm.sh/firebase/database");
    const{getAuth,signInAnonymously,onAuthStateChanged}=await import("https://esm.sh/firebase/auth");
    const app=getApps().length?getApp():initializeApp(cfg);
    _db=getDatabase(app);_ref=ref;_set=set;_update=update;_on=onValue;_off=off;_remove=remove;_push=push;
    _auth=getAuth(app);_anon=signInAnonymously;_authState=onAuthStateChanged;
    return true;
  }catch(e){console.warn("Firebase init failed",e);return false;}
}

/* ─── useFirebase hook ────────────────────────────────────────────────────── */
/* FIX: all db ops use stable refs — never stale regardless of render timing  */
function useFirebase(cfg){
  const[ready,setReady]=useState(false);
  const[uid,setUid]=useState(null);
  const[dbInst,setDbInst]=useState(null);
  const listenersRef=useRef([]);
  /* stable function refs that always read current _db */
  const fn={
    listen:useCallback((path,cb)=>{
      if(!_db)return()=>{};
      const r=_ref(_db,path);_on(r,s=>cb(s.val()));
      const u=()=>_off(r);listenersRef.current.push(u);return u;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    },[dbInst]),
    write:useCallback((path,val)=>{if(_db)return _set(_ref(_db,path),val);},[dbInst]),
    merge:useCallback((path,val)=>{if(_db)return _update(_ref(_db,path),val);},[dbInst]),
    del:useCallback((path)=>{if(_db)return _remove(_ref(_db,path));},[dbInst]),
    push:useCallback((path,val)=>{if(_db)return _push(_ref(_db,path),val);},[dbInst]),
  };
  /* store latest fns in ref so closures inside action fns always get current */
  const fnRef=useRef(fn);fnRef.current=fn;
  useEffect(()=>{
    if(!cfg)return;
    initFirebase(cfg).then(ok=>{
      if(!ok)return;
      setDbInst(_db);
      _authState(_auth,async u=>{
        if(u){setUid(u.uid);setReady(true);}
        else{try{await _anon(_auth);}catch(e){console.warn("anon auth",e);setReady(true);}}
      });
    });
    return()=>{listenersRef.current.forEach(f=>f());listenersRef.current=[];};
  },[cfg]);
  return{ready,uid,db:dbInst,fnRef,...fn};
}

/* ─── Toast hook ──────────────────────────────────────────────────────────── */
function useToasts(){
  const[toasts,setToasts]=useState([]);
  const add=useCallback((msg,type="info",dur=3200)=>{
    const id=Date.now()+Math.random();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),dur);
  },[]);
  return{toasts,add};
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const today=()=>new Date().toISOString().split("T")[0];
const parseDate=s=>new Date(s+"T00:00:00");
const weekKey=d=>{const dt=parseDate(d),j=new Date(dt.getFullYear(),0,1),wk=Math.ceil(((dt-j)/86400000+j.getDay()+1)/7);return`${dt.getFullYear()}-W${String(wk).padStart(2,"0")}`;}
const monthKey=d=>{const dt=parseDate(d);return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;}
const ckey=(cId,kId)=>`${cId}_${kId}`;
const fmtDollars=c=>`$${((c||0)/100).toFixed(2)}`;
const COLORS=[
  {bg:"rgba(124,111,247,0.18)",tx:"#a99df9",ring:"#7c6ff7"},
  {bg:"rgba(45,212,167,0.18)",tx:"#2dd4a7",ring:"#2dd4a7"},
  {bg:"rgba(248,122,176,0.18)",tx:"#f87ab0",ring:"#e879a0"},
  {bg:"rgba(74,158,255,0.18)",tx:"#4a9eff",ring:"#4a9eff"},
  {bg:"rgba(245,166,35,0.18)",tx:"#f5a623",ring:"#f5a623"},
];

/* ─── Seed data ───────────────────────────────────────────────────────────── */
const KIDS0=[
  {id:"k1",name:"Tayonna",age:17,colorIdx:0,xp:0,streak:0,initials:"TW",balanceCents:0,goal:{weeklyXpTarget:80,weeklyBonusCents:400,monthlyXpTarget:300,monthlyBonusCents:1500,overageRate:10}},
  {id:"k2",name:"Brianna",age:14,colorIdx:1,xp:0,streak:0,initials:"BW",balanceCents:0,goal:{weeklyXpTarget:60,weeklyBonusCents:300,monthlyXpTarget:240,monthlyBonusCents:1200,overageRate:10}},
  {id:"k3",name:"Leon",  age:10,colorIdx:2,xp:0,streak:0,initials:"LW",balanceCents:0,goal:{weeklyXpTarget:40,weeklyBonusCents:200,monthlyXpTarget:160,monthlyBonusCents:800,overageRate:10}},
];
const CHORES0=[
  {id:"c1",title:"Make bed",diff:"easy",scheduleType:"daily",scheduleDays:[],assignedTo:["k1","k2","k3"],requiresApproval:false,xp:10},
  {id:"c2",title:"Clean room",diff:"medium",scheduleType:"daily",scheduleDays:[],assignedTo:["k1","k2","k3"],requiresApproval:false,xp:20},
  {id:"c3",title:"Dishes",diff:"medium",scheduleType:"weekly",scheduleDays:["Mon","Tue","Wed","Thu","Fri"],assignedTo:["k1","k2"],requiresApproval:false,xp:20},
  {id:"c4",title:"Take out trash",diff:"easy",scheduleType:"weekly",scheduleDays:["Sun"],assignedTo:["k3"],requiresApproval:true,xp:15},
  {id:"c5",title:"Vacuum",diff:"hard",scheduleType:"weekly",scheduleDays:["Sat"],assignedTo:["k1","k2","k3"],requiresApproval:true,xp:35},
];

/* ─── CSS ─────────────────────────────────────────────────────────────────── */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#0c0c14;--s1:#13131f;--s2:#1a1a2e;--s3:#22223d;--s4:#2c2c50;
  --b1:rgba(255,255,255,0.06);--b2:rgba(255,255,255,0.12);--b3:rgba(255,255,255,0.2);
  --tx1:#eeeeff;--tx2:#8888bb;--tx3:#44447a;
  --pu:#7c6ff7;--pul:#a99df9;--pud:#4a42c8;
  --te:#2dd4a7;--am:#f5a623;--co:#f06060;--pk:#e879a0;--bl:#4a9eff;--gn:#4ade80;
  --r:12px;--rl:18px;--rs:7px;--sh:0 4px 32px rgba(0,0,0,0.5);
  --f:'Outfit',sans-serif;--fm:'DM Mono',monospace;
}
html,body{background:var(--bg);color:var(--tx1);font-family:var(--f);min-height:100vh;min-height:-webkit-fill-available;-webkit-tap-highlight-color:transparent;}
::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px;}
button,input,select,textarea{font-family:var(--f);-webkit-appearance:none;}
.app{display:-webkit-flex;display:flex;min-height:100vh;min-height:-webkit-fill-available;}
.sidebar{width:210px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;height:100vh;height:-webkit-fill-available;position:sticky;top:0;overflow-y:auto;}
.main{-webkit-flex:1;flex:1;min-width:0;overflow-y:auto;height:100vh;height:-webkit-fill-available;}
.topbar{padding:13px 22px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--s1);z-index:10;}
.tb-t{font-size:16px;font-weight:800;}.tb-s{font-size:11px;color:var(--tx3);margin-top:1px;}.tb-r{display:flex;gap:7px;align-items:center;}
.content{padding:20px 22px 40px;}
.shead{padding:14px 12px 6px;display:flex;align-items:center;gap:8px;}
.slogo{font-size:15px;font-weight:900;color:var(--pul);}
.sdemo{font-size:9px;background:var(--am);color:#000;border-radius:3px;padding:1px 5px;font-weight:800;}
.nlbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--tx3);padding:10px 12px 4px;}
.ni{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;font-weight:600;padding:7px 12px;border-radius:8px;transition:all .15s;text-align:left;position:relative;}
.ni:hover{background:var(--b1);color:var(--tx1);}.ni.act{background:var(--b2);color:var(--pul);}
.ic{font-size:14px;width:18px;text-align:center;}
.kni{display:flex;align-items:center;gap:7px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;transition:all .15s;}
.kni:hover{background:var(--b1);color:var(--tx1);}.kni.act{background:var(--b2);color:var(--tx1);}
.nav-badge{background:var(--am);color:#000;font-size:9px;font-weight:900;border-radius:8px;padding:1px 5px;margin-left:auto;}
.sfoot{margin-top:auto;padding:10px 12px;border-top:1px solid var(--b1);}
.swrow{display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:11px;font-weight:600;color:var(--tx2);}
.sw{position:relative;display:inline-block;width:32px;height:18px;cursor:pointer;}
.sw input{opacity:0;width:0;height:0;}
.sw-tr{position:absolute;inset:0;background:var(--s4);border-radius:9px;transition:.2s;}
.sw input:checked+.sw-tr{background:var(--pu);}
.sw-th{position:absolute;left:2px;top:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:.2s;}
.sw input:checked~.sw-th{transform:translateX(14px);}
.btn{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;}
.btn-p{background:var(--pu);color:#fff;}.btn-p:hover{background:var(--pud);}
.btn-g{background:var(--s3);color:var(--tx1);border:1px solid var(--b2);}.btn-g:hover{background:var(--s4);}
.btn-sm{padding:5px 10px;font-size:11px;}
.btn-te{background:rgba(45,212,167,.15);color:var(--te);border:1px solid rgba(45,212,167,.3);}
.btn-co{background:rgba(240,96,96,.15);color:var(--co);border:1px solid rgba(240,96,96,.3);}
.card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:16px;}
.card+.card{margin-top:12px;}
.ch{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:10px;}
.kcard{background:var(--s2);border:1px solid var(--b1);border-radius:var(--rl);padding:16px;display:flex;flex-direction:column;gap:10px;cursor:pointer;transition:border-color .15s;}
.kcard:hover{border-color:var(--b2);}
.kcard-head{display:flex;align-items:center;gap:12px;}
.av{display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:900;flex-shrink:0;}
.av-xs{display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:900;font-size:9px;}
.kname{font-size:15px;font-weight:800;}.kage{font-size:11px;color:var(--tx3);}
.chips{display:flex;gap:6px;flex-wrap:wrap;}
.chip{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--s3);color:var(--tx2);}
.ccard{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .15s;margin-bottom:8px;}
.ccard:hover{border-color:var(--b2);}.ccard.done{opacity:.55;}.ccard.pending{border-color:rgba(245,166,35,.35);}
.ccheck{width:22px;height:22px;border-radius:6px;border:2px solid var(--b3);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}
.ccheck.done{background:var(--te);border-color:var(--te);}.ccheck.pending{background:var(--am);border-color:var(--am);}
.ctitle{font-size:13px;font-weight:700;flex:1;}
.cdiff{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;}
.diff-easy{background:rgba(74,222,128,.12);color:var(--gn);}
.diff-medium{background:rgba(245,166,35,.12);color:var(--am);}
.diff-hard{background:rgba(240,96,96,.12);color:var(--co);}
.cxp{font-size:11px;font-weight:800;color:var(--pul);}
.store-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;}
.sitem{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:14px;display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:all .15s;}
.sitem:hover{border-color:var(--b2);}.sitem.can-afford{border-color:rgba(245,166,35,.4);}
.sitem-em{font-size:28px;text-align:center;}.sitem-name{font-size:13px;font-weight:700;text-align:center;}
.sitem-price{font-size:12px;font-weight:800;color:var(--am);text-align:center;}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}
.modal{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:22px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;}
.modal-h{font-size:16px;font-weight:800;margin-bottom:16px;}
.fg{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
.fl{font-size:12px;font-weight:700;color:var(--tx2);}
.fi{background:var(--s3);border:1px solid var(--b2);border-radius:8px;padding:9px 12px;color:var(--tx1);font-size:13px;outline:none;}
.fi:focus{border-color:var(--pu);}
.fax{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}
.toasts{position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:8px;z-index:200;}
.toast{background:var(--s3);border:1px solid var(--b2);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;box-shadow:var(--sh);animation:slideIn .2s ease;}
@keyframes slideIn{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast-info{border-color:rgba(124,111,247,.4);color:var(--pul);}
.toast-success{border-color:rgba(45,212,167,.4);color:var(--te);}
.toast-warn{border-color:rgba(245,166,35,.4);color:var(--am);}
.toast-err{border-color:rgba(240,96,96,.4);color:var(--co);}
.dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.mbar-wrap{display:flex;flex-direction:column;gap:4px;margin:8px 0;}
.mbar-row{display:flex;align-items:center;gap:8px;font-size:11px;}
.mbar-label{width:40px;color:var(--tx3);}
.mbar-track{flex:1;height:6px;background:var(--s4);border-radius:3px;overflow:hidden;}
.mbar-fill{height:100%;border-radius:3px;transition:width .4s ease;}
.mbar-val{width:48px;text-align:right;font-weight:700;color:var(--tx2);}
.alog{display:flex;flex-direction:column;}
.alog-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--b1);}
.alog-row:last-child{border-bottom:none;}
.alog-time{font-size:10px;color:var(--tx3);width:70px;flex-shrink:0;}
.alog-msg{font-size:13px;flex:1;}.alog-xp{font-size:11px;font-weight:800;color:var(--pul);}
.picker-wrap{min-height:100vh;min-height:-webkit-fill-available;display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;background:var(--bg);padding:24px;}
.picker-title{font-size:22px;font-weight:900;color:var(--pul);margin-bottom:6px;}
.picker-sub{font-size:13px;color:var(--tx3);margin-bottom:32px;}
.picker-grid{display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;gap:14px;-webkit-justify-content:center;justify-content:center;max-width:520px;}
.picker-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:20px 24px;display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;-webkit-align-items:center;align-items:center;gap:10px;cursor:pointer;transition:all .2s;min-width:120px;}
.picker-card:hover{border-color:var(--pu);background:var(--s3);}
.pin-wrap{min-height:100vh;min-height:-webkit-fill-available;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;-webkit-justify-content:center;justify-content:center;background:var(--bg);}
.pin-box{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:28px 24px;width:min(300px,90vw);display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;-webkit-align-items:center;align-items:center;gap:16px;}
.pin-title{font-size:16px;font-weight:800;}
.pin-dots{display:-webkit-flex;display:flex;gap:12px;}
.pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--b3);transition:all .15s;}
.pin-dot.filled{background:var(--pu);border-color:var(--pu);}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;}
.pin-btn{background:var(--s3);border:1px solid var(--b2);border-radius:10px;color:var(--tx1);font-size:18px;font-weight:700;padding:14px;cursor:pointer;transition:all .15s;-webkit-appearance:none;}
.pin-btn:hover{background:var(--s4);}.pin-err{font-size:12px;color:var(--co);height:16px;}
.km-wrap{display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;min-height:100vh;min-height:-webkit-fill-available;background:var(--bg);}
.km-header{padding:16px 16px 10px;display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;gap:12px;border-bottom:1px solid var(--b1);}
.km-name{font-size:18px;font-weight:900;}.km-sub{font-size:11px;color:var(--tx3);margin-top:1px;}
.km-back{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px;font-weight:600;padding:5px 10px;border-radius:7px;margin-left:auto;-webkit-appearance:none;}
.km-back:hover{background:var(--b1);color:var(--tx1);}
.km-tabs{display:-webkit-flex;display:flex;border-bottom:1px solid var(--b1);}
.km-tab{-webkit-flex:1;flex:1;background:none;border:none;color:var(--tx3);cursor:pointer;font-size:13px;font-weight:700;padding:11px 0;transition:all .15s;-webkit-appearance:none;}
.km-tab.act{color:var(--pul);border-bottom:2px solid var(--pu);}
.km-content{padding:14px 14px 80px;}
.bnav{display:none;position:fixed;bottom:0;left:0;right:0;width:100%;background:var(--s1);border-top:1px solid var(--b1);z-index:50;}
.bnav-inner{display:-webkit-flex;display:flex;width:100%;padding-bottom:env(safe-area-inset-bottom,0px);}
.bnav-btn{-webkit-flex:1;flex:1;background:none;border:none;color:var(--tx3);cursor:pointer;display:-webkit-flex;display:flex;-webkit-flex-direction:column;flex-direction:column;-webkit-align-items:center;align-items:center;gap:2px;padding:8px 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;transition:color .15s;min-width:0;}
.bnav-btn.act{color:var(--pul);}.bnav-ic{font-size:18px;line-height:1;}
.ftimer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:150;}
.ftimer-box{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:32px 28px;width:320px;text-align:center;}
.ftimer-ring{width:140px;height:140px;margin:0 auto 20px;position:relative;}
.ftimer-svg{transform:rotate(-90deg);}
.ftimer-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;font-family:var(--fm);}
.dev-card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.dev-uid{font-size:11px;font-family:var(--fm);color:var(--tx3);flex:1;word-break:break-all;}
.dev-role{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;}
.dev-admin{background:rgba(124,111,247,.15);color:var(--pul);}.dev-user{background:rgba(45,212,167,.12);color:var(--te);}
.set-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--b1);}
.set-row:last-child{border-bottom:none;}.set-label{font-size:13px;font-weight:600;}.set-sub{font-size:11px;color:var(--tx3);margin-top:2px;}
/* summary report */
.rep-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;margin-top:12px;}
.rep-card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--rl);overflow:hidden;}
.rep-head{padding:10px 14px;background:var(--s3);display:flex;justify-content:space-between;align-items:center;}
.rep-stat-row{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--b1);}
.rep-stat{padding:8px 6px;text-align:center;border-right:1px solid var(--b1);}
.rep-stat:last-child{border-right:none;}
.rep-stat-val{font-size:15px;font-weight:800;color:var(--tx1);}
.rep-stat-lbl{font-size:9px;color:var(--tx3);text-transform:uppercase;letter-spacing:.05em;}
.rep-bar-row{display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:5px;}
@media(max-width:680px){
  .sidebar{display:none;}
  .bnav{display:-webkit-flex;display:flex;}
  .content{padding:14px 14px 90px;}.topbar{padding:11px 14px;}
  .dash-grid{grid-template-columns:1fr;}.store-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));}
}
@media print{.sidebar,.bnav,.topbar,.no-print{display:none!important;}.main{height:auto;overflow:visible;}body{background:#fff!important;color:#000!important;}}
`;

/* ─── ProfilePicker ───────────────────────────────────────────────────────── */
function ProfilePicker({kids,onSelectKid,onSelectParent}){
  return(
    <div className="picker-wrap">
      <div className="picker-title">WattsHub</div>
      <div className="picker-sub">Who's using the app?</div>
      <div className="picker-grid">
        {kids.map(k=>{const cc=COLORS[k.colorIdx]||COLORS[0];return(
          <div key={k.id} className="picker-card" onClick={()=>onSelectKid(k.id)}>
            <div style={{width:52,height:52,borderRadius:"50%",background:cc.bg,color:cc.tx,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{k.initials}</div>
            <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
            <div style={{fontSize:11,color:"var(--tx3)"}}>Age {k.age}</div>
          </div>
        );})}
        <div className="picker-card" onClick={onSelectParent}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(245,166,35,0.15)",color:"var(--am)",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>🔑</div>
          <div style={{fontSize:14,fontWeight:800}}>Parent</div>
          <div style={{fontSize:11,color:"var(--tx3)"}}>PIN required</div>
        </div>
      </div>
    </div>
  );
}

/* ─── PINScreen ───────────────────────────────────────────────────────────── */
async function sha256(str){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");}
function PINScreen({mode,onSuccess,onBack}){
  const[pin,setPin]=useState("");const[err,setErr]=useState("");
  const[newPin,setNewPin]=useState("");const[step,setStep]=useState(mode==="set"?"enter":"verify");
  const append=d=>{
    if(pin.length>=4)return;
    const next=pin+d;setPin(next);setErr("");
    if(next.length===4){
      if(mode==="set"){
        if(step==="enter"){setNewPin(next);setPin("");setStep("confirm");}
        else if(next===newPin){sha256(next).then(h=>{localStorage.setItem("wh_pin",h);onSuccess();});}
        else{setErr("PINs don't match");setPin("");setNewPin("");setStep("enter");}
      }else{
        const stored=localStorage.getItem("wh_pin");
        sha256(next).then(h=>{if(h===stored){onSuccess();}else{setErr("Wrong PIN");setPin("");}});
      }
    }
  };
  const label=mode==="set"?(step==="enter"?"Set a parent PIN":"Confirm PIN"):"Enter parent PIN";
  return(
    <div className="pin-wrap"><div className="pin-box">
      <div className="pin-title">{label}</div>
      <div className="pin-dots">{[0,1,2,3].map(i=><div key={i} className={`pin-dot${pin.length>i?" filled":""}`}/>)}</div>
      <div className="pin-err">{err}</div>
      <div className="pin-pad">
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
          <button key={i} className="pin-btn" style={d===""?{visibility:"hidden"}:{}}
            onClick={()=>{if(d==="⌫"){setPin(p=>p.slice(0,-1));setErr("");}else{append(String(d));}}}>{d}</button>
        ))}
      </div>
      {onBack&&<button className="btn btn-g btn-sm" style={{marginTop:4}} onClick={onBack}>← Back</button>}
    </div></div>
  );
}

/* ─── FirebaseCfgModal ────────────────────────────────────────────────────── */
function FirebaseCfgModal({onSave,onSkip}){
  const[cfg,setCfg]=useState({apiKey:"",authDomain:"",databaseURL:"",projectId:"",storageBucket:"",messagingSenderId:"",appId:""});
  const fields=[{k:"apiKey",lbl:"API Key"},{k:"authDomain",lbl:"Auth Domain",hint:"project.firebaseapp.com"},{k:"databaseURL",lbl:"Database URL",hint:"https://project-rtdb.firebaseio.com"},{k:"projectId",lbl:"Project ID"},{k:"appId",lbl:"App ID"}];
  return(
    <div className="overlay"><div className="modal">
      <div className="modal-h">🔥 Connect Firebase</div>
      <p style={{fontSize:12,color:"var(--tx3)",marginBottom:16,lineHeight:1.5}}>Firebase Console → Project Settings → Your apps → Web → Config. Enable Realtime Database and Anonymous Auth.</p>
      {fields.map(f=>(
        <div className="fg" key={f.k}><label className="fl">{f.lbl}</label>
          <input className="fi" placeholder={f.hint||f.lbl} value={cfg[f.k]} onChange={e=>setCfg(c=>({...c,[f.k]:e.target.value}))}/></div>
      ))}
      <div className="fax">
        <button className="btn btn-g" onClick={onSkip}>Demo mode</button>
        <button className="btn btn-p" onClick={()=>onSave(cfg)} disabled={!cfg.apiKey||!cfg.databaseURL}>Connect →</button>
      </div>
    </div></div>
  );
}

/* ─── FocusTimerModal ─────────────────────────────────────────────────────── */
function FocusTimerModal({onClose,kids,onAwardXp}){
  const DURATION=25*60;
  const[secs,setSecs]=useState(DURATION);const[running,setRunning]=useState(false);
  const[done,setDone]=useState(false);const[selKid,setSelKid]=useState(kids[0]?.id||"");
  const timerRef=useRef(null);
  const start=()=>{setRunning(true);timerRef.current=setInterval(()=>{setSecs(s=>{if(s<=1){clearInterval(timerRef.current);setRunning(false);setDone(true);return 0;}return s-1;});},1000);};
  const pause=()=>{clearInterval(timerRef.current);setRunning(false);};
  const reset=()=>{clearInterval(timerRef.current);setRunning(false);setDone(false);setSecs(DURATION);};
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  const r=56,circ=2*Math.PI*r,pct=(secs/DURATION)*100;
  const mm=String(Math.floor(secs/60)).padStart(2,"0"),ss=String(secs%60).padStart(2,"0");
  return(
    <div className="ftimer-overlay"><div className="ftimer-box">
      <div style={{fontSize:15,fontWeight:800,marginBottom:16}}>⏱ Focus Timer</div>
      <div className="ftimer-ring">
        <svg className="ftimer-svg" width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--s3)" strokeWidth="8"/>
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--pu)" strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={circ*(1-pct/100)} strokeLinecap="round"/>
        </svg>
        <div className="ftimer-num">{mm}:{ss}</div>
      </div>
      {done?(
        <div style={{marginBottom:16}}>
          <div style={{color:"var(--te)",fontWeight:800,marginBottom:10}}>🎉 Session complete!</div>
          <div className="fg"><label className="fl">Award bonus XP to:</label>
            <select className="fi" value={selKid} onChange={e=>setSelKid(e.target.value)}>
              <option value="">No bonus</option>
              {kids.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
        </div>
      ):(
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
          {!running?<button className="btn btn-p" onClick={start}>▶ Start</button>:<button className="btn btn-g" onClick={pause}>⏸ Pause</button>}
          <button className="btn btn-g" onClick={reset}>↺ Reset</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {done&&selKid&&<button className="btn btn-te" onClick={()=>{onAwardXp(selKid,15);onClose();}}>+15 XP & Close</button>}
        <button className="btn btn-g" onClick={onClose}>Close</button>
      </div>
    </div></div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function WattsHub(){
  /* ── Firebase ── */
  const[fbCfg,setFbCfg]=useState(()=>{
    const keys=["wh_fbcfg","wh3_cfg","wh_fb","wh_firebase","wattshub_cfg"];
    try{for(const k of keys){const s=localStorage.getItem(k);if(s){const p=JSON.parse(s);if(p?.apiKey&&p?.databaseURL)return p;}}}catch{}
    return null;
  });
  const[showCfg,setShowCfg]=useState(false);
  const{ready,uid,db,fnRef,listen,write,merge,del}=useFirebase(fbCfg);
  /* FIX: action helpers always call through fnRef.current so they get the
     latest write/merge/del even after Firebase finishes async init         */
  const fw=(path,val)=>fnRef.current.write(path,val);
  const fm=(path,val)=>fnRef.current.merge(path,val);
  const fd=(path)=>fnRef.current.del(path);

  /* ── Core state ── */
  const[kids,setKids]=useState(KIDS0);
  const[chores,setChores]=useState(CHORES0);
  const[comps,setComps]=useState({});
  const[weekXp,setWeekXp]=useState({});
  const[storeItems,setStoreItems]=useState([]);
  const[txLog,setTxLog]=useState([]);
  const[allowedUids,setAllowedUids]=useState({});
  const[summerKids,setSummerKids]=useState({});
  const[summerWeekly,setSummerWeekly]=useState({});
  const[summerMonthly,setSummerMonthly]=useState({});
  const[summerSessions,setSummerSessions]=useState({});

  /* ── UI state ── */
  const[view,setView]=useState("dashboard");
  const[activeKid,setActiveKid]=useState(null);
  const[parentMode,setParentMode]=useState(false);
  const[screen,setScreen]=useState("picker");
  const[selDate,setSelDate]=useState(today());
  const[showAddChore,setShowAddChore]=useState(false);
  const[showAddKid,setShowAddKid]=useState(false);
  const[showAddItem,setShowAddItem]=useState(false);
  const[showFocusTimer,setShowFocusTimer]=useState(false);
  const[editChore,setEditChore]=useState(null);

  const{toasts,add:toast}=useToasts();

  /* ── Firebase listeners ── */
  useEffect(()=>{
    if(!ready)return;
    const u=[
      listen("wh/kids",       v=>{if(v)setKids(Object.values(v).filter(Boolean));}),
      listen("wh/chores",     v=>{if(v)setChores(Object.values(v).filter(Boolean));}),
      listen("wh/comps",      v=>{setComps(v||{});}),
      listen("wh/weekXp",     v=>{setWeekXp(v||{});}),
      listen("wh/store",      v=>{if(v)setStoreItems(Object.values(v).filter(Boolean));}),
      listen("wh/txlog",      v=>{if(v)setTxLog(Object.values(v).filter(Boolean).sort((a,b)=>b.ts-a.ts));}),
      listen("wh/allowedUids",v=>{setAllowedUids(v||{});}),
      listen("wh/summerProgram/kids",v=>{setSummerKids(v||{});}),
      listen("wh/summerSessions",    v=>{setSummerSessions(v||{});}),
      listen("wh/reports/weekly",    v=>{setSummerWeekly(v||{});}),
      listen("wh/reports/monthly",   v=>{setSummerMonthly(v||{});}),
    ];
    return()=>u.forEach(f=>f&&f());
  },[ready,listen]);

  /* Seed on first connect */
  useEffect(()=>{
    if(!ready)return;
    listen("wh/kids",v=>{
      if(!v){KIDS0.forEach(k=>fw(`wh/kids/${k.id}`,k));CHORES0.forEach(c=>fw(`wh/chores/${c.id}`,c));}
    });
  },[ready]);

  /* ── Helpers ── */
  const kidById=id=>kids.find(k=>k.id===id);
  const getComp=(dk,cId,kId)=>comps[dk]?.[ckey(cId,kId)]||null;
  const isScheduled=(c,ds)=>{
    if(c.scheduleType==="daily")return true;
    if(c.scheduleType==="weekly"){
      const dow=parseDate(ds).toLocaleDateString("en-US",{weekday:"short"});
      return(c.scheduleDays||[]).includes(dow);
    }
    return true;
  };
  const pendCount=useMemo(()=>{
    let n=0;
    chores.forEach(c=>{if(!c.requiresApproval)return;kids.forEach(k=>{if(getComp(today(),c.id,k.id)?.status==="pending")n++;});});
    return n;
  },[chores,kids,comps]);
  const isAdmin=uid&&allowedUids[uid]?.role==="admin";
  const hasPIN=!!localStorage.getItem("wh_pin");

  /* ── Actions — all use fw/fm/fd which route through fnRef ── */
  async function completeChore(choreId,kidId){
    const chore=chores.find(c=>c.id===choreId);
    const kid=kidById(kidId);
    if(!chore||!kid)return;
    const dk=selDate;
    const existing=getComp(dk,choreId,kidId);
    if(existing?.status==="approved"||existing?.status==="done")return;
    const status=chore.requiresApproval?"pending":"done";
    const xpAmt=Math.round((chore.xp||10)*(dk!==today()?0.75:1));
    await fm(`wh/comps/${dk}/${ckey(choreId,kidId)}`,{status,ts:Date.now(),choreId,kidId,xp:xpAmt});
    if(status==="done"){
      await fm(`wh/kids/${kidId}`,{xp:(kid.xp||0)+xpAmt,lastActiveDate:dk});
      const wk=weekKey(dk);
      await fw(`wh/weekXp/${wk}/${kidId}`,(weekXp[wk]?.[kidId]||0)+xpAmt);
      await fw(`wh/txlog/tx_${Date.now()}_${kidId}`,{id:`tx_${Date.now()}`,kidId,type:"chore",xp:xpAmt,cents:0,desc:chore.title,ts:Date.now()});
      toast(`+${xpAmt} XP for ${kid.name}!`,"success");
    }else{toast(`${chore.title} submitted for approval`,"info");}
  }

  async function approveComp(dk,choreId,kidId){
    const chore=chores.find(c=>c.id===choreId);
    const kid=kidById(kidId);if(!chore||!kid)return;
    const comp=getComp(dk,choreId,kidId);if(!comp)return;
    await fm(`wh/comps/${dk}/${ckey(choreId,kidId)}`,{status:"approved",approvedAt:Date.now()});
    const xpAmt=comp.xp||chore.xp||10;
    await fm(`wh/kids/${kidId}`,{xp:(kid.xp||0)+xpAmt});
    await fw(`wh/weekXp/${weekKey(dk)}/${kidId}`,(weekXp[weekKey(dk)]?.[kidId]||0)+xpAmt);
    await fw(`wh/txlog/tx_${Date.now()}_${kidId}`,{id:`tx_${Date.now()}`,kidId,type:"chore",xp:xpAmt,cents:0,desc:chore.title+" (approved)",ts:Date.now()});
    toast(`Approved! +${xpAmt} XP for ${kid.name}`,"success");
  }

  async function awardXp(kidId,amount){
    const kid=kidById(kidId);if(!kid)return;
    await fm(`wh/kids/${kidId}`,{xp:(kid.xp||0)+amount});
    await fw(`wh/weekXp/${weekKey(today())}/${kidId}`,(weekXp[weekKey(today())]?.[kidId]||0)+amount);
    toast(`+${amount} XP for ${kid.name}`,"success");
  }

  async function saveChore(data){
    const id=data.id||`c${Date.now()}`;
    await fw(`wh/chores/${id}`,{...data,id});
    toast(data.id?"Chore updated ✓":"Chore added ✓","success");
  }

  async function deleteChore(id){
    await fd(`wh/chores/${id}`);
    toast("Chore deleted","warn");
  }

  async function saveKid(data){
    const id=data.id||`k${Date.now()}`;
    await fw(`wh/kids/${id}`,{...data,id,xp:data.xp||0,streak:0,balanceCents:data.balanceCents||0,colorIdx:data.colorIdx!==undefined?data.colorIdx:kids.length%COLORS.length});
    toast(data.id?"Kid updated ✓":"Kid added ✓","success");
  }

  async function saveStoreItem(data){
    const id=`si${Date.now()}`;
    await fw(`wh/store/${id}`,{...data,id});
    toast("Store item added","success");
  }

  async function buyItem(item){
    if(!activeKid){toast("Select a kid first","warn");return;}
    const kid=kidById(activeKid);
    if((kid?.balanceCents||0)<item.priceCents){toast("Not enough coins","warn");return;}
    await fm(`wh/kids/${activeKid}`,{balanceCents:(kid.balanceCents||0)-item.priceCents});
    const txId=`tx_${Date.now()}_${activeKid}`;
    await fw(`wh/txlog/${txId}`,{id:txId,kidId:activeKid,type:"purchase",xp:0,cents:-item.priceCents,desc:item.name,ts:Date.now()});
    toast(`Purchased: ${item.name}!`,"success");
  }

  /* ── Auth helpers ── */
  function saveCfg(cfg){
    ["wh_fbcfg","wh3_cfg"].forEach(k=>localStorage.setItem(k,JSON.stringify(cfg)));
    setFbCfg(cfg);setShowCfg(false);
  }
  function handlePickerKid(kidId){setActiveKid(kidId);setParentMode(false);setScreen("kid");setView("chores");}
  function handlePickerParent(){setScreen(hasPIN?"pin-verify":"pin-set");}
  function enterParentMode(){setParentMode(true);setScreen("app");setView("dashboard");setActiveKid(null);}
  function exitToPicker(){setParentMode(false);setScreen("picker");setActiveKid(null);}

  /* ── vmeta ── */
  const vmeta={
    dashboard:{t:"Dashboard",s:"Family overview"},
    chores:{t:activeKid?`${kidById(activeKid)?.name}'s Chores`:"All Chores",s:selDate===today()?"Today":parseDate(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})},
    store:{t:"Family Store",s:"Spend your coins"},
    money:{t:"Money",s:activeKid?`${kidById(activeKid)?.name}'s balance`:"All balances"},
    activity:{t:"Activity",s:"Completed tasks"},
    summer:{t:"Summer Program",s:"Learning · XP · Reports"},
    devices:{t:"Devices",s:"Manage access"},
    settings:{t:"Settings",s:"Family & app preferences"},
  };
  const vm=vmeta[view]||{t:view,s:""};

  /* ════════════════════════════════ VIEWS ════════════════════════════════ */

  function DashboardView(){
    return(
      <div>
        {pendCount>0&&parentMode&&(
          <div style={{background:"rgba(245,166,35,0.1)",border:"1px solid rgba(245,166,35,0.3)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"var(--am)",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>⏳ {pendCount} chore{pendCount!==1?"s":""} pending approval</span>
            <button className="btn btn-g btn-sm" onClick={()=>setView("chores")}>Review →</button>
          </div>
        )}
        <div className="dash-grid">
          {kids.map(k=>{
            const cc=COLORS[k.colorIdx]||COLORS[0];
            const xp=k.xp||0,lvl=Math.floor(xp/100)+1,pct=((xp%100)/100)*100;
            const wk=weekKey(today()),wxp=weekXp[wk]?.[k.id]||0,goal=k.goal?.weeklyXpTarget||100;
            const gpct=Math.min(100,Math.round((wxp/goal)*100));
            const sk=summerKids[k.id];
            return(
              <div key={k.id} className="kcard" onClick={()=>{setActiveKid(k.id);setView("chores");setScreen("kid");setParentMode(false);}}>
                <div className="kcard-head">
                  <div style={{width:42,height:42,borderRadius:"50%",background:cc.bg,color:cc.tx,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,flexShrink:0}}>{k.initials}</div>
                  <div style={{flex:1}}>
                    <div className="kname">{k.name}</div>
                    <div className="kage">Age {k.age} · Level {lvl}</div>
                  </div>
                  {sk?.currentStreak>0&&<div style={{fontSize:12,fontWeight:800,color:sk.currentStreak>=5?"var(--am)":"var(--pul)"}}>{sk.currentStreak>=5?"🔥":"⚡"}{sk.currentStreak}</div>}
                </div>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--tx3)",marginBottom:4}}><span>XP {xp%100}/100</span><span>Level {lvl}</span></div>
                  <div style={{background:"var(--s4)",borderRadius:4,height:6,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:cc.ring,borderRadius:4,transition:"width .4s"}}/></div>
                </div>
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--tx3)",marginBottom:4}}><span>Weekly {wxp}/{goal} XP</span><span style={{color:gpct>=100?"var(--te)":"var(--tx3)"}}>{gpct}%</span></div>
                  <div style={{background:"var(--s4)",borderRadius:4,height:5,overflow:"hidden"}}><div style={{width:`${gpct}%`,height:"100%",background:gpct>=100?"var(--te)":cc.ring,borderRadius:4,transition:"width .4s"}}/></div>
                </div>
                {sk&&<div className="chips">
                  <span className="chip">☀️ {sk.totalSessionsCompleted||0} sess.</span>
                  <span className="chip">⭐ {sk.totalXPEarned||0} XP</span>
                  {(sk.currentStreak||0)>0&&<span className="chip">{sk.currentStreak>=5?"🔥":"⚡"}{sk.currentStreak} streak</span>}
                </div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function ChoresView(){
    const filtered=chores.filter(c=>(!activeKid||c.assignedTo?.includes(activeKid))&&isScheduled(c,selDate));
    const dateLabel=selDate===today()?"Today":parseDate(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    /* FIX: kid mode completion works because we pass isKidMode flag */
    const isKidMode=screen==="kid";
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button className="btn btn-g btn-sm" onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(d.toISOString().split("T")[0]);}}>‹</button>
          <span style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700}}>{dateLabel}</span>
          <button className="btn btn-g btn-sm" disabled={selDate===today()} onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);const s=d.toISOString().split("T")[0];if(s<=today())setSelDate(s);}}>›</button>
        </div>
        {parentMode&&pendCount>0&&(
          <div className="card" style={{marginBottom:12}}>
            <div className="ch">Pending Approval</div>
            {chores.filter(c=>c.requiresApproval).flatMap(c=>
              kids.map(k=>{
                const comp=getComp(selDate,c.id,k.id);
                if(comp?.status!=="pending")return null;
                return(
                  <div key={k.id+c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--b1)"}}>
                    <span style={{flex:1,fontSize:13}}><strong>{k.name}</strong> – {c.title}</span>
                    <button className="btn btn-te btn-sm" onClick={()=>approveComp(selDate,c.id,k.id)}>✓ Approve</button>
                    <button className="btn btn-co btn-sm" onClick={()=>fd(`wh/comps/${selDate}/${ckey(c.id,k.id)}`)}>✗</button>
                  </div>
                );
              }).filter(Boolean)
            )}
          </div>
        )}
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:"var(--tx3)"}}>
            {parentMode?"No chores scheduled — add one with + Chore":"No chores today! 🎉"}
          </div>
        ):(
          filtered.map(c=>{
            const kidsForChore=activeKid?[kidById(activeKid)]:kids.filter(k=>c.assignedTo?.includes(k.id));
            return kidsForChore.map(k=>{
              if(!k)return null;
              const comp=getComp(selDate,c.id,k.id);
              const status=comp?.status||"none";
              const cc=COLORS[k.colorIdx]||COLORS[0];
              /* FIX: allow tap in kid mode (isKidMode) OR when parentMode is off */
              const canTap=isKidMode||!parentMode;
              return(
                <div key={c.id+k.id} className={`ccard${status==="done"||status==="approved"?" done":status==="pending"?" pending":""}`}
                  onClick={()=>canTap&&completeChore(c.id,k.id)}>
                  <div className={`ccheck${status==="done"||status==="approved"?" done":status==="pending"?" pending":""}`}>
                    {(status==="done"||status==="approved")&&<span style={{fontSize:12,color:"#000"}}>✓</span>}
                    {status==="pending"&&<span style={{fontSize:10}}>⏳</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div className="ctitle">{c.title}</div>
                    {!activeKid&&<div style={{fontSize:11,color:cc.tx,marginTop:1}}>{k.name}</div>}
                  </div>
                  <span className={`cdiff diff-${c.diff||"easy"}`}>{c.diff||"easy"}</span>
                  <span className="cxp">+{c.xp||10} XP</span>
                  {parentMode&&(
                    <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                      <button className="btn btn-g btn-sm" onClick={()=>{setEditChore({...c});setShowAddChore(true);}}>✏️</button>
                      <button className="btn btn-co btn-sm" onClick={()=>{if(window.confirm("Delete this chore?"))deleteChore(c.id);}}>🗑</button>
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

  function StoreView(){
    const kid=activeKid?kidById(activeKid):null;
    const balance=kid?(kid.balanceCents||0):null;
    const defaultItems=[
      {id:"si_d1",name:"30 min screen time",emoji:"📱",priceCents:50},
      {id:"si_d2",name:"Pick dinner",emoji:"🍕",priceCents:100},
      {id:"si_d3",name:"Stay up 30 min",emoji:"🌙",priceCents:80},
      {id:"si_d4",name:"Skip one chore",emoji:"🎯",priceCents:150},
      {id:"si_d5",name:"Movie night pick",emoji:"🎬",priceCents:120},
      {id:"si_d6",name:"Cash out $1",emoji:"💵",priceCents:100},
    ];
    const items=[...defaultItems,...storeItems];
    return(
      <div>
        {balance!==null&&<div style={{fontSize:13,color:"var(--am)",fontWeight:800,marginBottom:14}}>💰 Balance: {fmtDollars(balance)}</div>}
        {!activeKid&&<div style={{fontSize:12,color:"var(--tx3)",marginBottom:12}}>Select a kid to buy items.</div>}
        <div className="store-grid">
          {items.map(item=>(
            <div key={item.id} className={`sitem${balance!==null&&balance>=item.priceCents?" can-afford":""}`} onClick={()=>buyItem(item)}>
              <div className="sitem-em">{item.emoji}</div>
              <div className="sitem-name">{item.name}</div>
              <div className="sitem-price">{fmtDollars(item.priceCents)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function MoneyView(){
    const buckets=[{key:"save",label:"Save",color:"var(--te)",pct:50},{key:"spend",label:"Spend",color:"var(--am)",pct:40},{key:"share",label:"Share",color:"var(--pk)",pct:10}];
    return(
      <div>
        <div className="dash-grid">
          {kids.map(k=>{
            const cc=COLORS[k.colorIdx]||COLORS[0],bal=k.balanceCents||0;
            return(
              <div key={k.id} className="card">
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:36,height:36,borderRadius:"50%",background:cc.bg,color:cc.tx,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{k.initials}</div>
                  <div><div style={{fontSize:14,fontWeight:800}}>{k.name}</div><div style={{fontSize:13,color:"var(--am)",fontWeight:800}}>{fmtDollars(bal)}</div></div>
                </div>
                <div className="mbar-wrap">
                  {buckets.map(b=>(
                    <div key={b.key} className="mbar-row">
                      <div className="mbar-label">{b.label}</div>
                      <div className="mbar-track"><div className="mbar-fill" style={{width:`${b.pct}%`,background:b.color}}/></div>
                      <div className="mbar-val">{fmtDollars(bal*(b.pct/100))}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="card" style={{marginTop:14}}>
          <div className="ch">Recent transactions</div>
          <div className="alog">
            {txLog.slice(0,20).map(tx=>{
              const k=kidById(tx.kidId);
              return(
                <div key={tx.id} className="alog-row">
                  <div className="alog-time">{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                  <div className="alog-msg"><strong>{k?.name||"?"}</strong> – {tx.desc}</div>
                  {tx.xp>0&&<div className="alog-xp">+{tx.xp} XP</div>}
                  {tx.cents!==0&&<div style={{fontSize:11,fontWeight:800,color:tx.cents>0?"var(--te)":"var(--co)"}}>{tx.cents>0?"+":""}{fmtDollars(Math.abs(tx.cents))}</div>}
                </div>
              );
            })}
            {txLog.length===0&&<div style={{color:"var(--tx3)",fontSize:13,padding:"12px 0"}}>No transactions yet.</div>}
          </div>
        </div>
      </div>
    );
  }

  function ActivityView(){
    return(
      <div className="card">
        <div className="ch">Activity log</div>
        <div className="alog">
          {txLog.slice(0,50).map(tx=>{
            const k=kidById(tx.kidId);
            return(
              <div key={tx.id} className="alog-row">
                <div className="alog-time">{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})} {new Date(tx.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>
                <div className="alog-msg"><strong>{k?.name||"?"}</strong> – {tx.desc}</div>
                {tx.xp>0&&<div className="alog-xp">+{tx.xp} XP</div>}
              </div>
            );
          })}
          {txLog.length===0&&<div style={{color:"var(--tx3)",fontSize:13,padding:"12px 0"}}>No activity yet.</div>}
        </div>
      </div>
    );
  }

  function DevicesView(){
    return(
      <div>
        <div className="card">
          <div className="ch">Your device</div>
          <div className="dev-card">
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700,marginBottom:3}}>This device UID</div><div className="dev-uid">{uid||"Not signed in"}</div></div>
            <div className={`dev-role ${isAdmin?"dev-admin":"dev-user"}`}>{isAdmin?"admin":"user"}</div>
          </div>
          {!isAdmin&&<div style={{fontSize:12,color:"var(--tx3)",marginTop:10,lineHeight:1.5}}>To get admin: copy UID above → Firebase Console → Realtime Database → <code>wh/allowedUids/{"{your-uid}"}</code> → add <code>role: "admin"</code></div>}
        </div>
        <div className="card" style={{marginTop:12}}>
          <div className="ch">Allowed devices</div>
          {Object.entries(allowedUids).map(([id,data])=>(
            <div key={id} className="dev-card">
              <div className="dev-uid">{id}</div>
              <div className={`dev-role ${data.role==="admin"?"dev-admin":"dev-user"}`}>{data.role||"user"}</div>
            </div>
          ))}
          {Object.keys(allowedUids).length===0&&<div style={{color:"var(--tx3)",fontSize:13,padding:"8px 0"}}>No devices yet.</div>}
        </div>
      </div>
    );
  }

  function SettingsView(){
    return(
      <div className="card">
        <div className="set-row"><div><div className="set-label">Firebase</div><div className="set-sub">{ready?"🟢 Connected":"🔴 Demo mode"}</div></div><button className="btn btn-g btn-sm" onClick={()=>setShowCfg(true)}>Configure</button></div>
        <div className="set-row"><div><div className="set-label">Parent PIN</div><div className="set-sub">{hasPIN?"PIN set":"No PIN set"}</div></div><button className="btn btn-g btn-sm" onClick={()=>setScreen("pin-set")}>{hasPIN?"Change PIN":"Set PIN"}</button></div>
        <div className="set-row"><div><div className="set-label">Summer program</div><div className="set-sub">10 XP/session · Mon–Thu · Streak bonus at 5 days</div></div><button className="btn btn-g btn-sm" onClick={()=>setView("summer")}>View</button></div>
        <div className="set-row"><div><div className="set-label">Focus timer</div><div className="set-sub">25-min Pomodoro with XP bonus</div></div><button className="btn btn-g btn-sm" onClick={()=>setShowFocusTimer(true)}>Start</button></div>
        <div className="set-row"><div><div className="set-label">Devices</div><div className="set-sub">Manage access & UIDs</div></div><button className="btn btn-g btn-sm" onClick={()=>setView("devices")}>View</button></div>
      </div>
    );
  }

  /* ── ChoreModal — FIX: uses key prop to force remount when editChore changes ── */
  function ChoreModal({initialData,onClose}){
    const blank={title:"",diff:"easy",scheduleType:"daily",scheduleDays:[],assignedTo:[],requiresApproval:false,xp:10};
    const[form,setForm]=useState(initialData||blank);
    const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const toggleDay=d=>setForm(f=>({...f,scheduleDays:f.scheduleDays?.includes(d)?f.scheduleDays.filter(x=>x!==d):[...(f.scheduleDays||[]),d]}));
    const toggleKid=id=>setForm(f=>({...f,assignedTo:f.assignedTo?.includes(id)?f.assignedTo.filter(x=>x!==id):[...(f.assignedTo||[]),id]}));
    return(
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-h">{initialData?"Edit Chore":"Add Chore"}</div>
          <div className="fg"><label className="fl">Title</label><input className="fi" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Difficulty</label>
            <select className="fi" value={form.diff} onChange={e=>setForm(f=>({...f,diff:e.target.value}))}>
              <option value="easy">Easy (+10 XP)</option><option value="medium">Medium (+20 XP)</option><option value="hard">Hard (+35 XP)</option>
            </select>
          </div>
          <div className="fg"><label className="fl">XP reward</label><input className="fi" type="number" min="1" max="500" value={form.xp||10} onChange={e=>setForm(f=>({...f,xp:+e.target.value}))}/></div>
          <div className="fg"><label className="fl">Schedule</label>
            <select className="fi" value={form.scheduleType} onChange={e=>setForm(f=>({...f,scheduleType:e.target.value}))}>
              <option value="daily">Every day</option><option value="weekly">Specific days</option>
            </select>
          </div>
          {form.scheduleType==="weekly"&&(
            <div className="fg"><label className="fl">Days</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {days.map(d=><button key={d} className={`btn btn-sm ${form.scheduleDays?.includes(d)?"btn-p":"btn-g"}`} onClick={()=>toggleDay(d)}>{d}</button>)}
              </div>
            </div>
          )}
          <div className="fg"><label className="fl">Assign to</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {kids.map(k=><button key={k.id} className={`btn btn-sm ${form.assignedTo?.includes(k.id)?"btn-p":"btn-g"}`} onClick={()=>toggleKid(k.id)}>{k.name}</button>)}
            </div>
          </div>
          <div className="fg" style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
            <label className="fl">Requires approval</label>
            <label className="sw"><input type="checkbox" checked={!!form.requiresApproval} onChange={e=>setForm(f=>({...f,requiresApproval:e.target.checked}))}/><div className="sw-tr"/><div className="sw-th"/></label>
          </div>
          <div className="fax">
            {initialData&&<button className="btn btn-co" onClick={()=>{deleteChore(initialData.id);onClose();}}>Delete</button>}
            <button className="btn btn-g" onClick={onClose}>Cancel</button>
            <button className="btn btn-p" onClick={()=>{if(!form.title.trim())return;saveChore(form);onClose();}}>
              {initialData?"Save changes":"Add chore"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function AddKidModal(){
    const[form,setForm]=useState({name:"",age:"",initials:""});
    return(
      <div className="overlay" onClick={()=>setShowAddKid(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">Add Kid</div>
        <div className="fg"><label className="fl">Name</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Age</label><input className="fi" type="number" value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Initials (2 chars)</label><input className="fi" maxLength={2} value={form.initials} onChange={e=>setForm(f=>({...f,initials:e.target.value.toUpperCase()}))}/></div>
        <div className="fax">
          <button className="btn btn-g" onClick={()=>setShowAddKid(false)}>Cancel</button>
          <button className="btn btn-p" onClick={()=>{if(!form.name.trim())return;saveKid(form);setShowAddKid(false);}}>Add kid</button>
        </div>
      </div></div>
    );
  }

  function AddItemModal(){
    const[form,setForm]=useState({name:"",emoji:"🎁",desc:"",priceCents:100});
    return(
      <div className="overlay" onClick={()=>setShowAddItem(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-h">Add Store Item</div>
        <div className="fg"><label className="fl">Name</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Emoji</label><input className="fi" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Description</label><input className="fi" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Price (cents, e.g. 100 = $1.00)</label><input className="fi" type="number" value={form.priceCents} onChange={e=>setForm(f=>({...f,priceCents:+e.target.value}))}/></div>
        <div className="fax">
          <button className="btn btn-g" onClick={()=>setShowAddItem(false)}>Cancel</button>
          <button className="btn btn-p" onClick={()=>{if(!form.name.trim())return;saveStoreItem(form);setShowAddItem(false);}}>Add item</button>
        </div>
      </div></div>
    );
  }

  /* ── Kid Mode ── */
  function KidModeApp(){
    const kid=kidById(activeKid);
    const[kmTab,setKmTab]=useState("chores");
    const cc=COLORS[kid?.colorIdx||0];
    if(!kid)return null;
    return(
      <div className="km-wrap">
        <div className="km-header">
          <div style={{width:40,height:40,borderRadius:"50%",background:cc.bg,color:cc.tx,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900}}>{kid.initials}</div>
          <div><div className="km-name">{kid.name}</div><div className="km-sub">Level {Math.floor((kid.xp||0)/100)+1} · {kid.xp||0} XP · {fmtDollars(kid.balanceCents||0)}</div></div>
          <button className="km-back" onClick={exitToPicker}>← Home</button>
        </div>
        <div className="km-tabs">
          {[{id:"chores",lbl:"Tasks"},{id:"summer",lbl:"☀️ Summer"},{id:"store",lbl:"Store"},{id:"money",lbl:"Money"}].map(t=>(
            <button key={t.id} className={`km-tab${kmTab===t.id?" act":""}`} onClick={()=>setKmTab(t.id)}>{t.lbl}</button>
          ))}
        </div>
        <div className="km-content">
          {kmTab==="chores"&&<div><KidSummerCard db={db} kidId={activeKid} kidName={kid.name}/><ChoresView/></div>}
          {kmTab==="summer"&&<KidSummerCard db={db} kidId={activeKid} kidName={kid.name}/>}
          {kmTab==="store"&&<StoreView/>}
          {kmTab==="money"&&<MoneyView/>}
        </div>
      </div>
    );
  }

  /* ── Screen routing ── */
  if(screen==="picker") return(<><style>{CSS}</style>{showCfg&&<FirebaseCfgModal onSave={saveCfg} onSkip={()=>setShowCfg(false)}/>}<ProfilePicker kids={kids} onSelectKid={handlePickerKid} onSelectParent={handlePickerParent}/><div className="toasts">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div></>);
  if(screen==="pin-set") return(<><style>{CSS}</style><PINScreen mode="set" onSuccess={enterParentMode} onBack={()=>setScreen("picker")}/></>);
  if(screen==="pin-verify") return(<><style>{CSS}</style><PINScreen mode="verify" onSuccess={enterParentMode} onBack={()=>setScreen("picker")}/></>);
  if(screen==="kid") return(<><style>{CSS}</style><KidModeApp/><div className="toasts">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div></>);

  /* ── Parent app ── */
  const navItems=[
    {id:"dashboard",ic:"⬡",lbl:"Dashboard"},
    {id:"chores",ic:"✓",lbl:"Chores"},
    {id:"store",ic:"🛍️",lbl:"Store"},
    {id:"money",ic:"💵",lbl:"Money"},
    {id:"activity",ic:"↻",lbl:"Activity"},
    {id:"summer",ic:"☀️",lbl:"Summer"},
    {id:"devices",ic:"⊞",lbl:"Devices"},
    {id:"settings",ic:"⚙",lbl:"Settings"},
  ];
  const bnav=[{id:"dashboard",ic:"⬡",lbl:"Home"},{id:"chores",ic:"✓",lbl:"Chores"},{id:"summer",ic:"☀️",lbl:"Summer"},{id:"store",ic:"🛍️",lbl:"Store"},{id:"activity",ic:"↻",lbl:"Log"}];

  return(
    <>
      <style>{CSS}</style>
      {showCfg&&<FirebaseCfgModal onSave={saveCfg} onSkip={()=>setShowCfg(false)}/>}
      {/* FIX: key forces ChoreModal to remount with fresh state when editChore changes */}
      {showAddChore&&<ChoreModal key={editChore?.id||"new"} initialData={editChore||null} onClose={()=>{setShowAddChore(false);setEditChore(null);}}/>}
      {showAddKid&&<AddKidModal/>}
      {showAddItem&&<AddItemModal/>}
      {showFocusTimer&&<FocusTimerModal kids={kids} onClose={()=>setShowFocusTimer(false)} onAwardXp={awardXp}/>}

      <div className="app">
        <aside className="sidebar">
          <div className="shead">
            <div className="slogo">WattsHub</div>
            {!ready&&<div className="sdemo">DEMO</div>}
          </div>
          <div style={{padding:"0 9px",marginBottom:4}}>
            <div className="nlbl">Navigate</div>
            {navItems.map(n=>(
              <button key={n.id} className={`ni${view===n.id?" act":""}`}
                onClick={()=>{setView(n.id);if(!["chores","store","money"].includes(n.id))setActiveKid(null);}}>
                <span className="ic">{n.ic}</span>{n.lbl}
                {n.id==="chores"&&pendCount>0&&<span className="nav-badge">{pendCount}</span>}
                {n.id==="summer"&&<SummerNavBadge db={db} kidId={null}/>}
              </button>
            ))}
          </div>
          <div style={{padding:"0 9px"}}>
            <div className="nlbl">Kids</div>
            {kids.map(k=>{const cc=COLORS[k.colorIdx]||COLORS[0];return(
              <button key={k.id} className={`kni${activeKid===k.id?" act":""}`}
                onClick={()=>{setActiveKid(k.id);setSelDate(today());setView("chores");}}>
                <div className="av-xs" style={{width:22,height:22,background:cc.bg,color:cc.tx}}>{k.initials}</div>
                {k.name}
              </button>
            );})}
            {activeKid&&<button className="kni" style={{color:"var(--tx3)"}} onClick={()=>{setActiveKid(null);setView("dashboard");}}>
              <span style={{width:22,textAlign:"center"}}>←</span>All kids
            </button>}
          </div>
          <div className="sfoot">
            <div className="swrow"><span>Parent mode</span>
              <label className="sw"><input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/><div className="sw-tr"/><div className="sw-th"/></label>
            </div>
            <button className="ni" style={{color:"var(--tx3)"}} onClick={exitToPicker}><span className="ic">←</span>Profile picker</button>
            <button className="ni" style={{color:"var(--tx3)"}} onClick={()=>setShowCfg(true)}><span className="ic">⚙</span>Firebase setup</button>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div><div className="tb-t">{vm.t}</div><div className="tb-s">{vm.s}</div></div>
            <div className="tb-r">
              {pendCount>0&&parentMode&&<span style={{background:"rgba(245,166,35,0.13)",color:"var(--am)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>{pendCount} pending</span>}
              {ready&&<span style={{background:"rgba(45,212,167,0.09)",color:"var(--te)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>● Live</span>}
              {parentMode&&<button className="btn btn-g btn-sm" onClick={()=>setShowFocusTimer(true)}>⏱</button>}
              {parentMode&&view==="store"&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddItem(true)}>+ Item</button>}
              {parentMode&&<button className="btn btn-p btn-sm" onClick={()=>{setEditChore(null);setShowAddChore(true);}}>+ Chore</button>}
              {parentMode&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddKid(true)}>+ Kid</button>}
            </div>
          </div>
          <div className="content">
            {view==="dashboard"&&<DashboardView/>}
            {view==="chores"&&<ChoresView/>}
            {view==="store"&&<StoreView/>}
            {view==="money"&&<MoneyView/>}
            {view==="activity"&&<ActivityView/>}
            {view==="summer"&&<SummerView db={db} kids={kids} summerKids={summerKids} summerSessions={summerSessions} weekly={summerWeekly} monthly={summerMonthly}/>}
            {view==="devices"&&<DevicesView/>}
            {view==="settings"&&<SettingsView/>}
          </div>
        </main>
      </div>

      <nav className="bnav"><div className="bnav-inner">
        {bnav.map(n=>(
          <button key={n.id} className={`bnav-btn${view===n.id?" act":""}`}
            onClick={()=>{setView(n.id);if(!["chores","store"].includes(n.id))setActiveKid(null);}}>
            <span className="bnav-ic">{n.ic}</span>{n.lbl}
          </button>
        ))}
      </div></nav>

      <div className="toasts">{toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}</div>
    </>
  );
}

import{useState,useEffect,useCallback,useMemo,useRef}from"react";
import{SummerView,KidSummerCard,SummerNavBadge}from"./components/summer/SummerModule";

/* ─── Firebase loader ──────────────────────────────────────────────────────── */
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

/* ─── useFirebase hook ──────────────────────────────────────────────────────── */
function useFirebase(cfg){
  const[ready,setReady]=useState(false);
  const[uid,setUid]=useState(null);
  const listenersRef=useRef([]);
  useEffect(()=>{
    if(!cfg)return;
    initFirebase(cfg).then(ok=>{
      if(!ok)return;
      _authState(_auth,async u=>{
        if(u){setUid(u.uid);setReady(true);}
        else{try{await _anon(_auth);}catch(e){console.warn("anon auth fail",e);setReady(true);}}
      });
    });
    return()=>listenersRef.current.forEach(f=>f());
  },[cfg]);
  const listen=useCallback((path,cb)=>{
    if(!_db)return()=>{};
    const r=_ref(_db,path);
    _on(r,s=>cb(s.val()));
    const unsub=()=>_off(r);
    listenersRef.current.push(unsub);
    return unsub;
  },[]);
  const write=useCallback((path,val)=>{if(_db)return _set(_ref(_db,path),val);},[]);
  const merge=useCallback((path,val)=>{if(_db)return _update(_ref(_db,path),val);},[]);
  const del=useCallback((path)=>{if(_db)return _remove(_ref(_db,path));},[]);
  const push=useCallback((path,val)=>{if(_db)return _push(_ref(_db,path),val);},[]);
  return{ready,uid,listen,write,merge,del,push};
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
const weekKey=d=>{const dt=parseDate(d),jan1=new Date(dt.getFullYear(),0,1),wk=Math.ceil(((dt-jan1)/86400000+jan1.getDay()+1)/7);return`${dt.getFullYear()}-W${String(wk).padStart(2,"0")}`;}
const ckey=(cId,kId)=>`${cId}_${kId}`;
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
  {id:"c1",title:"Make bed",diff:"easy",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:["k1","k2","k3"],requiresApproval:false,xp:10},
  {id:"c2",title:"Clean room",diff:"medium",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:["k1","k2","k3"],requiresApproval:false,xp:20},
  {id:"c3",title:"Dishes",diff:"medium",freq:"daily",scheduleType:"weekly",scheduleDays:["Mon","Tue","Wed","Thu","Fri"],assignedTo:["k1","k2"],requiresApproval:false,xp:20},
  {id:"c4",title:"Take out trash",diff:"easy",freq:"weekly",scheduleType:"weekly",scheduleDays:["Sun"],assignedTo:["k3"],requiresApproval:true,xp:15},
  {id:"c5",title:"Vacuum",diff:"hard",freq:"weekly",scheduleType:"weekly",scheduleDays:["Sat"],assignedTo:["k1","k2","k3"],requiresApproval:true,xp:35},
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
  --r:12px;--rl:18px;--rs:7px;
  --sh:0 4px 32px rgba(0,0,0,0.5);
  --f:'Outfit',sans-serif;--fm:'DM Mono',monospace;
}
html,body{background:var(--bg);color:var(--tx1);font-family:var(--f);min-height:100vh;-webkit-tap-highlight-color:transparent;}
::-webkit-scrollbar{width:3px;height:3px;}::-webkit-scrollbar-thumb{background:var(--s4);border-radius:2px;}
button,input,select,textarea{font-family:var(--f);}

/* Layout */
.app{display:flex;min-height:100vh;}
.sidebar{width:210px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow-y:auto;}
.main{flex:1;min-width:0;overflow-y:auto;height:100vh;}
.topbar{padding:13px 22px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--s1);z-index:10;}
.tb-t{font-size:16px;font-weight:800;}
.tb-s{font-size:11px;color:var(--tx3);margin-top:1px;}
.tb-r{display:flex;gap:7px;align-items:center;}
.content{padding:20px 22px 40px;}

/* Sidebar */
.shead{padding:14px 12px 6px;display:flex;align-items:center;gap:8px;}
.slogo{font-size:15px;font-weight:900;color:var(--pul);}
.sdemo{font-size:9px;background:var(--am);color:#000;border-radius:3px;padding:1px 5px;font-weight:800;}
.nlbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--tx3);padding:10px 12px 4px;}
.ni{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;font-weight:600;padding:7px 12px;border-radius:8px;transition:all .15s;text-align:left;position:relative;}
.ni:hover{background:var(--b1);color:var(--tx1);}
.ni.act{background:var(--b2);color:var(--pul);}
.ic{font-size:14px;width:18px;text-align:center;}
.kni{display:flex;align-items:center;gap:7px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:12px;font-weight:600;padding:6px 12px;border-radius:8px;transition:all .15s;}
.kni:hover{background:var(--b1);color:var(--tx1);}
.kni.act{background:var(--b2);color:var(--tx1);}
.nav-badge{background:var(--am);color:#000;font-size:9px;font-weight:900;border-radius:8px;padding:1px 5px;margin-left:auto;}
.sfoot{margin-top:auto;padding:10px 12px;border-top:1px solid var(--b1);}
.swrow{display:flex;align-items:center;justify-content:space-between;padding:6px 0;font-size:11px;font-weight:600;color:var(--tx2);}
.sw{position:relative;display:inline-block;width:32px;height:18px;cursor:pointer;}
.sw input{opacity:0;width:0;height:0;}
.sw-tr{position:absolute;inset:0;background:var(--s4);border-radius:9px;transition:.2s;}
.sw input:checked+.sw-tr{background:var(--pu);}
.sw-th{position:absolute;left:2px;top:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:.2s;}
.sw input:checked~.sw-th{transform:translateX(14px);}

/* Buttons */
.btn{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;}
.btn-p{background:var(--pu);color:#fff;}
.btn-p:hover{background:var(--pud);}
.btn-g{background:var(--s3);color:var(--tx1);border:1px solid var(--b2);}
.btn-g:hover{background:var(--s4);}
.btn-sm{padding:5px 10px;font-size:11px;}
.btn-te{background:rgba(45,212,167,.15);color:var(--te);border:1px solid rgba(45,212,167,.3);}
.btn-co{background:rgba(240,96,96,.15);color:var(--co);border:1px solid rgba(240,96,96,.3);}

/* Cards */
.card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:16px;}
.card+.card{margin-top:12px;}
.ch{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:10px;}

/* Kid cards */
.kcard{background:var(--s2);border:1px solid var(--b1);border-radius:var(--rl);padding:16px;display:flex;flex-direction:column;gap:10px;}
.kcard-head{display:flex;align-items:center;gap:12px;}
.av{display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:900;flex-shrink:0;}
.av-sm{width:38px;height:38px;font-size:13px;}
.av-xs{display:flex;align-items:center;justify-content:center;border-radius:50%;font-weight:900;font-size:9px;}
.kname{font-size:15px;font-weight:800;}
.kage{font-size:11px;color:var(--tx3);}
.chips{display:flex;gap:6px;flex-wrap:wrap;}
.chip{font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--s3);color:var(--tx2);}

/* Chore cards */
.ccard{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:12px 14px;display:flex;align-items:center;gap:12px;cursor:pointer;transition:all .15s;}
.ccard:hover{border-color:var(--b2);}
.ccard.done{opacity:.55;}
.ccard.pending{border-color:rgba(245,166,35,.35);}
.ccheck{width:22px;height:22px;border-radius:6px;border:2px solid var(--b3);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}
.ccheck.done{background:var(--te);border-color:var(--te);}
.ccheck.pending{background:var(--am);border-color:var(--am);}
.ctitle{font-size:13px;font-weight:700;flex:1;}
.cdiff{font-size:10px;padding:2px 7px;border-radius:20px;font-weight:700;}
.diff-easy{background:rgba(74,222,128,.12);color:var(--gn);}
.diff-medium{background:rgba(245,166,35,.12);color:var(--am);}
.diff-hard{background:rgba(240,96,96,.12);color:var(--co);}
.cxp{font-size:11px;font-weight:800;color:var(--pul);}

/* Store */
.store-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;}
.sitem{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:14px;display:flex;flex-direction:column;gap:8px;cursor:pointer;transition:all .15s;}
.sitem:hover{border-color:var(--b2);}
.sitem.can-afford{border-color:rgba(245,166,35,.4);}
.sitem-em{font-size:28px;text-align:center;}
.sitem-name{font-size:13px;font-weight:700;text-align:center;}
.sitem-price{font-size:12px;font-weight:800;color:var(--am);text-align:center;}

/* Modals */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}
.modal{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:22px;width:100%;max-width:440px;max-height:90vh;overflow-y:auto;}
.modal-h{font-size:16px;font-weight:800;margin-bottom:16px;}
.fg{display:flex;flex-direction:column;gap:5px;margin-bottom:12px;}
.fl{font-size:12px;font-weight:700;color:var(--tx2);}
.fi{background:var(--s3);border:1px solid var(--b2);border-radius:8px;padding:9px 12px;color:var(--tx1);font-size:13px;outline:none;}
.fi:focus{border-color:var(--pu);}
.fax{display:flex;gap:8px;justify-content:flex-end;margin-top:16px;}

/* Toast */
.toasts{position:fixed;bottom:24px;right:24px;display:flex;flex-direction:column;gap:8px;z-index:200;}
.toast{background:var(--s3);border:1px solid var(--b2);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;box-shadow:var(--sh);animation:slideIn .2s ease;}
@keyframes slideIn{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}
.toast-info{border-color:rgba(124,111,247,.4);color:var(--pul);}
.toast-success{border-color:rgba(45,212,167,.4);color:var(--te);}
.toast-warn{border-color:rgba(245,166,35,.4);color:var(--am);}
.toast-err{border-color:rgba(240,96,96,.4);color:var(--co);}

/* Dashboard grid */
.dash-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}

/* Money bars */
.mbar-wrap{display:flex;flex-direction:column;gap:4px;margin:8px 0;}
.mbar-row{display:flex;align-items:center;gap:8px;font-size:11px;}
.mbar-label{width:40px;color:var(--tx3);}
.mbar-track{flex:1;height:6px;background:var(--s4);border-radius:3px;overflow:hidden;}
.mbar-fill{height:100%;border-radius:3px;transition:width .4s ease;}
.mbar-val{width:48px;text-align:right;font-weight:700;color:var(--tx2);}

/* Activity log */
.alog{display:flex;flex-direction:column;gap:0;}
.alog-row{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--b1);}
.alog-row:last-child{border-bottom:none;}
.alog-time{font-size:10px;color:var(--tx3);width:52px;flex-shrink:0;}
.alog-msg{font-size:13px;flex:1;}
.alog-xp{font-size:11px;font-weight:800;color:var(--pul);}

/* Profile picker */
.picker-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);padding:24px;}
.picker-title{font-size:22px;font-weight:900;color:var(--pul);margin-bottom:6px;}
.picker-sub{font-size:13px;color:var(--tx3);margin-bottom:32px;}
.picker-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:480px;}
.picker-card{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:20px 24px;display:flex;flex-direction:column;align-items:center;gap:10px;cursor:pointer;transition:all .2s;min-width:120px;}
.picker-card:hover{border-color:var(--pu);background:var(--s3);}

/* PIN screen */
.pin-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);}
.pin-box{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:28px 24px;width:300px;display:flex;flex-direction:column;align-items:center;gap:16px;}
.pin-title{font-size:16px;font-weight:800;color:var(--tx1);}
.pin-dots{display:flex;gap:12px;}
.pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--b3);transition:all .15s;}
.pin-dot.filled{background:var(--pu);border-color:var(--pu);}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;}
.pin-btn{background:var(--s3);border:1px solid var(--b2);border-radius:10px;color:var(--tx1);font-size:18px;font-weight:700;padding:14px;cursor:pointer;transition:all .15s;}
.pin-btn:hover{background:var(--s4);}
.pin-err{font-size:12px;color:var(--co);height:16px;}

/* Kid mode */
.km-wrap{display:flex;flex-direction:column;min-height:100vh;background:var(--bg);}
.km-header{padding:16px 16px 10px;display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--b1);}
.km-name{font-size:18px;font-weight:900;}
.km-sub{font-size:11px;color:var(--tx3);margin-top:1px;}
.km-back{background:none;border:none;color:var(--tx3);cursor:pointer;font-size:12px;font-weight:600;padding:5px 10px;border-radius:7px;margin-left:auto;}
.km-back:hover{background:var(--b1);color:var(--tx1);}
.km-tabs{display:flex;border-bottom:1px solid var(--b1);}
.km-tab{flex:1;background:none;border:none;color:var(--tx3);cursor:pointer;font-size:13px;font-weight:700;padding:11px 0;transition:all .15s;}
.km-tab.act{color:var(--pul);border-bottom:2px solid var(--pu);}
.km-content{padding:14px 14px 80px;}

/* Bottom nav (mobile) */
.bnav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--s1);border-top:1px solid var(--b1);z-index:50;padding-bottom:env(safe-area-inset-bottom);}
.bnav-inner{display:flex;}
.bnav-btn{flex:1;background:none;border:none;color:var(--tx3);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;transition:color .15s;}
.bnav-btn.act{color:var(--pul);}
.bnav-ic{font-size:18px;}

/* Focus timer */
.ftimer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:150;}
.ftimer-box{background:var(--s2);border:1px solid var(--b2);border-radius:var(--rl);padding:32px 28px;width:320px;text-align:center;}
.ftimer-ring{width:140px;height:140px;margin:0 auto 20px;position:relative;}
.ftimer-svg{transform:rotate(-90deg);}
.ftimer-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;font-family:var(--fm);}

/* Devices view */
.dev-card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;display:flex;align-items:center;gap:12px;margin-bottom:10px;}
.dev-uid{font-size:11px;font-family:var(--fm);color:var(--tx3);flex:1;word-break:break-all;}
.dev-role{font-size:10px;font-weight:800;padding:2px 8px;border-radius:20px;}
.dev-admin{background:rgba(124,111,247,.15);color:var(--pul);}
.dev-user{background:rgba(45,212,167,.12);color:var(--te);}

/* Settings */
.set-row{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--b1);}
.set-row:last-child{border-bottom:none;}
.set-label{font-size:13px;font-weight:600;}
.set-sub{font-size:11px;color:var(--tx3);margin-top:2px;}

/* Summer specific */
.sum-prog-banner{background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.25);border-radius:10px;padding:8px 14px;font-size:12px;color:var(--pul);margin-bottom:16px;}
.sum-inactive-banner{background:rgba(45,212,167,0.08);border:1px solid rgba(45,212,167,0.2);border-radius:10px;padding:8px 14px;font-size:12px;color:var(--te);margin-bottom:16px;}

@media(max-width:680px){
  .sidebar{display:none;}
  .bnav{display:flex;}
  .content{padding:14px 14px 90px;}
  .topbar{padding:11px 14px;}
  .dash-grid{grid-template-columns:1fr;}
  .store-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr));}
}
@media print{
  .sidebar,.bnav,.topbar,.summer-no-print{display:none!important;}
  .main{height:auto;overflow:visible;}
  body{background:#fff!important;color:#000!important;}
}
`;

/* ─── Profile Picker ──────────────────────────────────────────────────────── */
function ProfilePicker({kids,onSelectKid,onSelectParent}){
  return(
    <div className="picker-wrap">
      <div className="picker-title">WattsHub</div>
      <div className="picker-sub">Who's using the app?</div>
      <div className="picker-grid">
        {kids.map(k=>{
          const cc=COLORS[k.colorIdx]||COLORS[0];
          return(
            <div key={k.id} className="picker-card" onClick={()=>onSelectKid(k.id)}>
              <div className="av av-sm" style={{width:52,height:52,background:cc.bg,color:cc.tx,fontSize:18}}>{k.initials}</div>
              <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
              <div style={{fontSize:11,color:"var(--tx3)"}}>Age {k.age}</div>
            </div>
          );
        })}
        <div className="picker-card" onClick={onSelectParent}>
          <div className="av av-sm" style={{width:52,height:52,background:"rgba(245,166,35,0.15)",color:"var(--am)",fontSize:22}}>🔑</div>
          <div style={{fontSize:14,fontWeight:800}}>Parent</div>
          <div style={{fontSize:11,color:"var(--tx3)"}}>PIN required</div>
        </div>
      </div>
    </div>
  );
}

/* ─── PIN Screen ──────────────────────────────────────────────────────────── */
async function sha256(str){const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(str));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");}
function PINScreen({mode,onSuccess,onBack}){
  const[pin,setPin]=useState("");
  const[err,setErr]=useState("");
  const[newPin,setNewPin]=useState("");
  const[step,setStep]=useState(mode==="set"?"enter":"verify"); // set mode: enter->confirm
  const append=d=>{
    if(pin.length>=4)return;
    const next=pin+d;
    setPin(next);setErr("");
    if(next.length===4){
      if(mode==="set"){
        if(step==="enter"){setNewPin(next);setPin("");setStep("confirm");}
        else{
          if(next===newPin){sha256(next).then(h=>{localStorage.setItem("wh_pin",h);onSuccess();});}
          else{setErr("PINs don't match");setPin("");setNewPin("");setStep("enter");}
        }
      } else {
        const stored=localStorage.getItem("wh_pin");
        sha256(next).then(h=>{
          if(h===stored){onSuccess();}
          else{setErr("Wrong PIN");setPin("");}
        });
      }
    }
  };
  const backspace=()=>{setPin(p=>p.slice(0,-1));setErr("");};
  const label=mode==="set"?(step==="enter"?"Set a parent PIN":"Confirm PIN"):"Enter parent PIN";
  return(
    <div className="pin-wrap">
      <div className="pin-box">
        <div className="pin-title">{label}</div>
        <div className="pin-dots">
          {[0,1,2,3].map(i=><div key={i} className={`pin-dot${pin.length>i?" filled":""}`}/>)}
        </div>
        <div className="pin-err">{err}</div>
        <div className="pin-pad">
          {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
            <button key={i} className="pin-btn"
              style={d===""?{visibility:"hidden"}:{}}
              onClick={()=>d==="⌫"?backspace():append(String(d))}
            >{d}</button>
          ))}
        </div>
        {onBack&&<button className="btn btn-g btn-sm" style={{marginTop:4}} onClick={onBack}>Back</button>}
      </div>
    </div>
  );
}

/* ─── Firebase Config Modal ───────────────────────────────────────────────── */
function FirebaseCfgModal({onSave,onSkip}){
  const[cfg,setCfg]=useState({apiKey:"",authDomain:"",databaseURL:"",projectId:"",storageBucket:"",messagingSenderId:"",appId:""});
  const fields=[
    {k:"apiKey",lbl:"API Key"},
    {k:"authDomain",lbl:"Auth Domain",hint:"your-project.firebaseapp.com"},
    {k:"databaseURL",lbl:"Database URL",hint:"https://your-project-default-rtdb.firebaseio.com"},
    {k:"projectId",lbl:"Project ID"},
    {k:"appId",lbl:"App ID"},
  ];
  return(
    <div className="overlay">
      <div className="modal">
        <div className="modal-h">🔥 Connect Firebase</div>
        <p style={{fontSize:12,color:"var(--tx3)",marginBottom:16,lineHeight:1.5}}>
          Firebase Console → Project Settings → Your apps → Web → Config object.
          Enable Realtime Database and Anonymous Auth.
        </p>
        {fields.map(f=>(
          <div className="fg" key={f.k}>
            <label className="fl">{f.lbl}</label>
            <input className="fi" placeholder={f.hint||f.lbl} value={cfg[f.k]}
              onChange={e=>setCfg(c=>({...c,[f.k]:e.target.value}))}/>
          </div>
        ))}
        <div className="fax">
          <button className="btn btn-g" onClick={onSkip}>Demo mode</button>
          <button className="btn btn-p" onClick={()=>onSave(cfg)} disabled={!cfg.apiKey||!cfg.databaseURL}>Connect →</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Focus Timer ─────────────────────────────────────────────────────────── */
function FocusTimerModal({onClose,kids,onAwardXp}){
  const DURATION=25*60;
  const[secs,setSecs]=useState(DURATION);
  const[running,setRunning]=useState(false);
  const[done,setDone]=useState(false);
  const[selKid,setSelKid]=useState(kids[0]?.id||"");
  const timerRef=useRef(null);
  const start=()=>{setRunning(true);timerRef.current=setInterval(()=>{setSecs(s=>{if(s<=1){clearInterval(timerRef.current);setRunning(false);setDone(true);return 0;}return s-1;});},1000);};
  const pause=()=>{clearInterval(timerRef.current);setRunning(false);};
  const reset=()=>{clearInterval(timerRef.current);setRunning(false);setDone(false);setSecs(DURATION);};
  useEffect(()=>()=>clearInterval(timerRef.current),[]);
  const pct=(secs/DURATION)*100;
  const r=56;const circ=2*Math.PI*r;
  const mm=String(Math.floor(secs/60)).padStart(2,"0");
  const ss=String(secs%60).padStart(2,"0");
  return(
    <div className="ftimer-overlay">
      <div className="ftimer-box">
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
            <div className="fg">
              <label className="fl">Award bonus XP to:</label>
              <select className="fi" value={selKid} onChange={e=>setSelKid(e.target.value)}>
                <option value="">No bonus</option>
                {kids.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
          </div>
        ):(
          <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
            {!running?<button className="btn btn-p" onClick={start}>▶ Start</button>
              :<button className="btn btn-g" onClick={pause}>⏸ Pause</button>}
            <button className="btn btn-g" onClick={reset}>↺ Reset</button>
          </div>
        )}
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          {done&&selKid&&<button className="btn btn-te" onClick={()=>{onAwardXp(selKid,15);onClose();}}>+15 XP & Close</button>}
          <button className="btn btn-g" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ────────────────────────────────────────────────────────────── */
export default function WattsHub(){
  /* Firebase config */
  const[fbCfg,setFbCfg]=useState(()=>{try{const s=localStorage.getItem("wh_fbcfg");return s?JSON.parse(s):null;}catch{return null;}});
  const[showCfg,setShowCfg]=useState(false);
  const{ready,uid,listen,write,merge,del,push}=useFirebase(fbCfg);

  /* Core state */
  const[kids,setKids]=useState(KIDS0);
  const[chores,setChores]=useState(CHORES0);
  const[comps,setComps]=useState({});
  const[weekXp,setWeekXp]=useState({});
  const[storeItems,setStoreItems]=useState([]);
  const[txLog,setTxLog]=useState([]);
  const[allowedUids,setAllowedUids]=useState({});

  /* Summer program state */
  const[summerKids,setSummerKids]=useState({});
  const[summerWeekly,setSummerWeekly]=useState({});
  const[summerMonthly,setSummerMonthly]=useState({});

  /* UI state */
  const[view,setView]=useState("dashboard");
  const[activeKid,setActiveKid]=useState(null);
  const[parentMode,setParentMode]=useState(false);
  const[screen,setScreen]=useState("picker"); // picker|pin-set|pin-verify|app|kid
  const[selDate,setSelDate]=useState(today());
  const[calMonth,setCalMonth]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});

  /* Modal state */
  const[showAddChore,setShowAddChore]=useState(false);
  const[showAddKid,setShowAddKid]=useState(false);
  const[showAddItem,setShowAddItem]=useState(false);
  const[showFocusTimer,setShowFocusTimer]=useState(false);
  const[editChore,setEditChore]=useState(null);
  const[goalKid,setGoalKid]=useState(null);

  /* Forms */
  const[cf,setCf]=useState({title:"",diff:"easy",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:[],requiresApproval:false,xp:10});
  const[kf,setKf]=useState({name:"",age:"",initials:""});
  const[itemf,setItemf]=useState({name:"",emoji:"🎁",desc:"",priceCents:100});

  const{toasts,add:toast}=useToasts();

  /* Firebase listeners */
  useEffect(()=>{
    if(!ready)return;
    const unsubs=[
      listen("wh/kids",       v=>{if(v)setKids(Object.values(v).filter(Boolean));}),
      listen("wh/chores",     v=>{if(v)setChores(Object.values(v).filter(Boolean));}),
      listen("wh/comps",      v=>{setComps(v||{});}),
      listen("wh/weekXp",     v=>{setWeekXp(v||{});}),
      listen("wh/store",      v=>{if(v)setStoreItems(Object.values(v).filter(Boolean));}),
      listen("wh/txlog",      v=>{if(v)setTxLog(Object.values(v).filter(Boolean).sort((a,b)=>b.ts-a.ts));}),
      listen("wh/allowedUids",v=>{setAllowedUids(v||{});}),
      // Summer program listeners
      listen("wh/summerProgram/kids", v=>{setSummerKids(v||{});}),
      listen("wh/reports/weekly",     v=>{setSummerWeekly(v||{});}),
      listen("wh/reports/monthly",    v=>{setSummerMonthly(v||{});}),
    ];
    return()=>unsubs.forEach(f=>f&&f());
  },[ready,listen]);

  /* Seed data on first connect */
  useEffect(()=>{
    if(!ready)return;
    listen("wh/kids",v=>{
      if(!v){
        KIDS0.forEach(k=>write(`wh/kids/${k.id}`,k));
        CHORES0.forEach(c=>write(`wh/chores/${c.id}`,c));
      }
    });
  },[ready]);

  /* Helpers */
  const kidById=id=>kids.find(k=>k.id===id);
  const getComp=(dk,choreId,kidId)=>comps[dk]?.[ckey(choreId,kidId)]||null;
  const isScheduled=(chore,dateStr)=>{
    if(chore.scheduleType==="daily")return true;
    if(chore.scheduleType==="weekly"){
      const dow=parseDate(dateStr).toLocaleDateString("en-US",{weekday:"short"});
      return(chore.scheduleDays||[]).includes(dow);
    }
    return true;
  };
  const pendCount=useMemo(()=>{
    let n=0;
    chores.forEach(c=>{if(!c.requiresApproval)return;kids.forEach(k=>{const comp=getComp(today(),c.id,k.id);if(comp?.status==="pending")n++;});});
    return n;
  },[chores,kids,comps]);

  /* Actions */
  async function completeChore(choreId,kidId){
    const chore=chores.find(c=>c.id===choreId);
    const kid=kidById(kidId);
    if(!chore||!kid)return;
    const dk=selDate;
    const existing=getComp(dk,choreId,kidId);
    if(existing?.status==="approved"||existing?.status==="done")return;
    const status=chore.requiresApproval?"pending":"done";
    const xpMulti=dk!==today()?0.75:1;
    const xpAmt=Math.round((chore.xp||10)*xpMulti);
    await merge(`wh/comps/${dk}/${ckey(choreId,kidId)}`,{status,ts:Date.now(),choreId,kidId,xp:xpAmt});
    if(status==="done"){
      const newXp=(kid.xp||0)+xpAmt;
      await merge(`wh/kids/${kidId}`,{xp:newXp,lastActiveDate:dk});
      const wk=weekKey(dk);
      const wkXp=(weekXp[wk]?.[kidId]||0)+xpAmt;
      await write(`wh/weekXp/${wk}/${kidId}`,wkXp);
      const txId=`tx_${Date.now()}_${kidId}`;
      await write(`wh/txlog/${txId}`,{id:txId,kidId,type:"chore",xp:xpAmt,cents:0,desc:chore.title,ts:Date.now()});
      toast(`+${xpAmt} XP for ${kid.name}!`,"success");
    } else {
      toast(`${chore.title} submitted for approval`,"info");
    }
  }

  async function approveComp(dk,choreId,kidId){
    const chore=chores.find(c=>c.id===choreId);
    const kid=kidById(kidId);
    if(!chore||!kid)return;
    const comp=getComp(dk,choreId,kidId);
    if(!comp)return;
    await merge(`wh/comps/${dk}/${ckey(choreId,kidId)}`,{status:"approved",approvedAt:Date.now()});
    const xpAmt=comp.xp||chore.xp||10;
    const newXp=(kid.xp||0)+xpAmt;
    await merge(`wh/kids/${kidId}`,{xp:newXp});
    const wk=weekKey(dk);
    const wkXp=(weekXp[wk]?.[kidId]||0)+xpAmt;
    await write(`wh/weekXp/${wk}/${kidId}`,wkXp);
    const txId=`tx_${Date.now()}_${kidId}`;
    await write(`wh/txlog/${txId}`,{id:txId,kidId,type:"chore",xp:xpAmt,cents:0,desc:chore.title+" (approved)",ts:Date.now()});
    toast(`Approved! +${xpAmt} XP for ${kid.name}`,"success");
  }

  async function awardXp(kidId,amount){
    const kid=kidById(kidId);if(!kid)return;
    await merge(`wh/kids/${kidId}`,{xp:(kid.xp||0)+amount});
    const wk=weekKey(today());
    await write(`wh/weekXp/${wk}/${kidId}`,(weekXp[wk]?.[kidId]||0)+amount);
    toast(`+${amount} XP for ${kid.name}`,"success");
  }

  async function saveChore(data){
    const id=data.id||`c${Date.now()}`;
    await write(`wh/chores/${id}`,{...data,id});
    toast(data.id?"Chore updated":"Chore added","success");
  }

  async function deleteChore(id){
    await del(`wh/chores/${id}`);
    toast("Chore deleted","warn");
  }

  async function saveKid(data){
    const id=data.id||`k${Date.now()}`;
    const colorIdx=kids.length%COLORS.length;
    await write(`wh/kids/${id}`,{...data,id,xp:0,streak:0,balanceCents:0,colorIdx});
    toast("Kid added","success");
  }

  async function saveStoreItem(data){
    const id=`si${Date.now()}`;
    await write(`wh/store/${id}`,{...data,id});
    toast("Store item added","success");
  }

  /* Auth helpers */
  const isAdmin=uid&&allowedUids[uid]?.role==="admin";
  const hasPIN=!!localStorage.getItem("wh_pin");

  function handlePickerParent(){
    if(!hasPIN){setScreen("pin-set");}
    else{setScreen("pin-verify");}
  }

  function handlePickerKid(kidId){
    setActiveKid(kidId);
    setParentMode(false);
    setScreen("kid");
    setView("chores");
  }

  function enterParentMode(){
    setParentMode(true);
    setScreen("app");
    setView("dashboard");
    setActiveKid(null);
  }

  function exitToPickerFromApp(){
    setParentMode(false);
    setScreen("picker");
    setActiveKid(null);
  }

  /* vmeta */
  const vmeta={
    dashboard:{t:"Dashboard",s:"Family overview"},
    chores:{t:activeKid?`${kidById(activeKid)?.name}'s Chores`:"All Chores",s:selDate===today()?"Today":parseDate(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})},
    store:{t:"Family Store",s:"Spend your XP"},
    money:{t:"Money",s:activeKid?`${kidById(activeKid)?.name}'s balance`:"All balances"},
    activity:{t:"Activity",s:"Completed tasks"},
    summer:{t:"Summer Program",s:"Learning · XP · Reports"},
    devices:{t:"Devices",s:"Manage access"},
    settings:{t:"Settings",s:"Family & app preferences"},
  };
  const vm=vmeta[view]||{t:view,s:""};

  /* ── Views ── */

  function DashboardView(){
    return(
      <div>
        {pendCount>0&&parentMode&&(
          <div style={{background:"rgba(245,166,35,0.1)",border:"1px solid rgba(245,166,35,0.3)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"var(--am)",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>⏳ {pendCount} chore{pendCount>1?"s":""} pending approval</span>
            <button className="btn btn-g btn-sm" onClick={()=>setView("chores")}>Review →</button>
          </div>
        )}
        <div className="dash-grid">
          {kids.map(k=>{
            const cc=COLORS[k.colorIdx]||COLORS[0];
            const xp=k.xp||0;
            const lvl=Math.floor(xp/100)+1;
            const pct=((xp%100)/100)*100;
            const wk=weekKey(today());
            const wxp=weekXp[wk]?.[k.id]||0;
            const goal=k.goal?.weeklyXpTarget||100;
            const gpct=Math.min(100,Math.round((wxp/goal)*100));
            const sk=summerKids[k.id];
            return(
              <div key={k.id} className="kcard" onClick={()=>{setActiveKid(k.id);setView("chores");setScreen("kid");setParentMode(false);}}>
                <div className="kcard-head">
                  <div className="av av-sm" style={{width:42,height:42,background:cc.bg,color:cc.tx,fontSize:15}}>{k.initials}</div>
                  <div style={{flex:1}}>
                    <div className="kname">{k.name}</div>
                    <div className="kage">Age {k.age} · Level {lvl}</div>
                  </div>
                  {sk?.currentStreak>0&&(
                    <div style={{fontSize:12,fontWeight:800,color:sk.currentStreak>=5?"var(--am)":"var(--pul)"}}>
                      {sk.currentStreak>=5?"🔥":"⚡"}{sk.currentStreak}
                    </div>
                  )}
                </div>
                {/* XP bar */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--tx3)",marginBottom:4}}>
                    <span>XP {xp%100}/100</span><span>Level {lvl}</span>
                  </div>
                  <div style={{background:"var(--s4)",borderRadius:4,height:6,overflow:"hidden"}}>
                    <div style={{width:`${pct}%`,height:"100%",background:cc.ring,borderRadius:4,transition:"width .4s"}}/>
                  </div>
                </div>
                {/* Weekly goal bar */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--tx3)",marginBottom:4}}>
                    <span>Weekly goal {wxp}/{goal} XP</span><span style={{color:gpct>=100?"var(--te)":"var(--tx3)"}}>{gpct}%</span>
                  </div>
                  <div style={{background:"var(--s4)",borderRadius:4,height:5,overflow:"hidden"}}>
                    <div style={{width:`${gpct}%`,height:"100%",background:gpct>=100?"var(--te)":cc.ring,borderRadius:4,transition:"width .4s"}}/>
                  </div>
                </div>
                {/* Summer mini stats */}
                {sk&&(
                  <div className="chips">
                    <span className="chip">☀️ {sk.totalSessionsCompleted||0} sessions</span>
                    <span className="chip">⭐ {sk.totalXPEarned||0} XP</span>
                    {sk.currentStreak>0&&<span className="chip">{sk.currentStreak>=5?"🔥":"⚡"}{sk.currentStreak} streak</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function ChoresView(){
    const filtered=chores.filter(c=>
      (!activeKid||c.assignedTo?.includes(activeKid))&&isScheduled(c,selDate)
    );
    const dateLabel=selDate===today()?"Today":parseDate(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    return(
      <div>
        {/* Date nav */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button className="btn btn-g btn-sm" onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()-1);setSelDate(d.toISOString().split("T")[0]);}}>‹</button>
          <span style={{flex:1,textAlign:"center",fontSize:13,fontWeight:700}}>{dateLabel}</span>
          <button className="btn btn-g btn-sm" disabled={selDate===today()} onClick={()=>{const d=new Date(selDate);d.setDate(d.getDate()+1);const s=d.toISOString().split("T")[0];if(s<=today())setSelDate(s);}}>›</button>
        </div>
        {/* Pending approvals (parent mode) */}
        {parentMode&&pendCount>0&&(
          <div className="card" style={{marginBottom:12}}>
            <div className="ch">Pending Approval</div>
            {chores.filter(c=>c.requiresApproval).map(c=>
              kids.map(k=>{
                const comp=getComp(selDate,c.id,k.id);
                if(comp?.status!=="pending")return null;
                return(
                  <div key={k.id+c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--b1)"}}>
                    <span style={{flex:1,fontSize:13}}><strong>{k.name}</strong> – {c.title}</span>
                    <button className="btn btn-te btn-sm" onClick={()=>approveComp(selDate,c.id,k.id)}>✓ Approve</button>
                    <button className="btn btn-co btn-sm" onClick={()=>del(`wh/comps/${selDate}/${ckey(c.id,k.id)}`)}>✗</button>
                  </div>
                );
              })
            )}
          </div>
        )}
        {/* Chore list */}
        {filtered.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:"var(--tx3)"}}>
            {parentMode?"No chores scheduled. Add one with + Chore.":"No chores today! 🎉"}
          </div>
        ):(
          filtered.map(c=>{
            const kidsForChore=activeKid?[kidById(activeKid)]:kids.filter(k=>c.assignedTo?.includes(k.id));
            return kidsForChore.map(k=>{
              if(!k)return null;
              const comp=getComp(selDate,c.id,k.id);
              const status=comp?.status||"none";
              const cc=COLORS[k.colorIdx]||COLORS[0];
              return(
                <div key={c.id+k.id} className={`ccard${status==="done"||status==="approved"?" done":status==="pending"?" pending":""}`}
                  onClick={()=>!parentMode&&completeChore(c.id,k.id)}>
                  <div className={`ccheck${status==="done"||status==="approved"?" done":status==="pending"?" pending":""}`}>
                    {(status==="done"||status==="approved")&&<span style={{fontSize:12,color:"#000"}}>✓</span>}
                    {status==="pending"&&<span style={{fontSize:10}}>⏳</span>}
                  </div>
                  <div style={{flex:1}}>
                    <div className="ctitle">{c.title}</div>
                    {!activeKid&&<div style={{fontSize:11,color:cc.tx,marginTop:1}}>{k.name}</div>}
                  </div>
                  <span className={`cdiff diff-${c.diff}`}>{c.diff}</span>
                  <span className="cxp">+{c.xp||10} XP</span>
                  {parentMode&&(
                    <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                      <button className="btn btn-g btn-sm" onClick={()=>{setEditChore(c);setShowAddChore(true);}}>✏️</button>
                      <button className="btn btn-co btn-sm" onClick={()=>{if(confirm("Delete this chore?"))deleteChore(c.id);}}>🗑</button>
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
      {id:"si_default_1",name:"30 min screen time",emoji:"📱",desc:"Extra screen time",priceCents:50},
      {id:"si_default_2",name:"Pick dinner",emoji:"🍕",desc:"You choose dinner",priceCents:100},
      {id:"si_default_3",name:"Stay up 30 min",emoji:"🌙",desc:"Later bedtime",priceCents:80},
      {id:"si_default_4",name:"Skip one chore",emoji:"🎯",desc:"One free pass",priceCents:150},
      {id:"si_default_5",name:"Movie night pick",emoji:"🎬",desc:"You choose the movie",priceCents:120},
      {id:"si_default_6",name:"Cash out $1",emoji:"💵",desc:"Real money",priceCents:100},
    ];
    const items=[...defaultItems,...storeItems];
    const buyItem=async(item)=>{
      if(!activeKid){toast("Select a kid first","warn");return;}
      const kid=kidById(activeKid);
      if((kid?.balanceCents||0)<item.priceCents){toast("Not enough coins","warn");return;}
      await merge(`wh/kids/${activeKid}`,{balanceCents:(kid.balanceCents||0)-item.priceCents});
      const txId=`tx_${Date.now()}_${activeKid}`;
      await write(`wh/txlog/${txId}`,{id:txId,kidId:activeKid,type:"purchase",xp:0,cents:-item.priceCents,desc:item.name,ts:Date.now()});
      toast(`Purchased: ${item.name}!`,"success");
    };
    return(
      <div>
        {balance!==null&&<div style={{fontSize:13,color:"var(--am)",fontWeight:800,marginBottom:14}}>💰 Balance: ${(balance/100).toFixed(2)}</div>}
        <div className="store-grid">
          {items.map(item=>(
            <div key={item.id} className={`sitem${balance!==null&&balance>=item.priceCents?" can-afford":""}`} onClick={()=>buyItem(item)}>
              <div className="sitem-em">{item.emoji}</div>
              <div className="sitem-name">{item.name}</div>
              <div className="sitem-price">${(item.priceCents/100).toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function MoneyView(){
    const buckets=[
      {key:"save",label:"Save",color:"var(--te)",pct:50},
      {key:"spend",label:"Spend",color:"var(--am)",pct:40},
      {key:"share",label:"Share",color:"var(--pk)",pct:10},
    ];
    return(
      <div>
        <div className="dash-grid">
          {kids.map(k=>{
            const cc=COLORS[k.colorIdx]||COLORS[0];
            const bal=k.balanceCents||0;
            return(
              <div key={k.id} className="card">
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div className="av av-sm" style={{width:36,height:36,background:cc.bg,color:cc.tx,fontSize:13}}>{k.initials}</div>
                  <div>
                    <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
                    <div style={{fontSize:13,color:"var(--am)",fontWeight:800}}>${(bal/100).toFixed(2)}</div>
                  </div>
                </div>
                <div className="mbar-wrap">
                  {buckets.map(b=>(
                    <div key={b.key} className="mbar-row">
                      <div className="mbar-label">{b.label}</div>
                      <div className="mbar-track"><div className="mbar-fill" style={{width:`${b.pct}%`,background:b.color}}/></div>
                      <div className="mbar-val">${((bal*(b.pct/100))/100).toFixed(2)}</div>
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
                  {tx.cents!==0&&<div style={{fontSize:11,fontWeight:800,color:tx.cents>0?"var(--te)":"var(--co)"}}>{tx.cents>0?"+":""}{(tx.cents/100).toFixed(2)}</div>}
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
          {txLog.slice(0,40).map(tx=>{
            const k=kidById(tx.kidId);
            return(
              <div key={tx.id} className="alog-row">
                <div className="alog-time">{new Date(tx.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div>
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
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>This device</div>
              <div className="dev-uid">{uid||"Not signed in"}</div>
            </div>
            <div className={`dev-role ${isAdmin?"dev-admin":"dev-user"}`}>{isAdmin?"admin":"user"}</div>
          </div>
          {!isAdmin&&(
            <div style={{fontSize:12,color:"var(--tx3)",marginTop:10,lineHeight:1.5}}>
              To get admin access: copy your UID above and add it to Firebase Console → Realtime Database → <code>wh/allowedUids</code> with <code>role: "admin"</code>.
            </div>
          )}
        </div>
        <div className="card" style={{marginTop:12}}>
          <div className="ch">Allowed devices</div>
          {Object.entries(allowedUids).map(([id,data])=>(
            <div key={id} className="dev-card">
              <div className="dev-uid">{id}</div>
              <div className={`dev-role ${data.role==="admin"?"dev-admin":"dev-user"}`}>{data.role||"user"}</div>
            </div>
          ))}
          {Object.keys(allowedUids).length===0&&<div style={{color:"var(--tx3)",fontSize:13,padding:"8px 0"}}>No devices configured yet.</div>}
        </div>
      </div>
    );
  }

  function SettingsView(){
    return(
      <div className="card">
        <div className="set-row">
          <div><div className="set-label">Firebase</div><div className="set-sub">Connection status: {ready?"🟢 Connected":"🔴 Demo mode"}</div></div>
          <button className="btn btn-g btn-sm" onClick={()=>setShowCfg(true)}>Configure</button>
        </div>
        <div className="set-row">
          <div><div className="set-label">Parent PIN</div><div className="set-sub">{hasPIN?"PIN is set":"No PIN set"}</div></div>
          <button className="btn btn-g btn-sm" onClick={()=>setScreen("pin-set")}>
            {hasPIN?"Change PIN":"Set PIN"}
          </button>
        </div>
        <div className="set-row">
          <div><div className="set-label">Summer program</div><div className="set-sub">June 9 – Aug 15, 2026 · 10 XP/session</div></div>
          <button className="btn btn-g btn-sm" onClick={()=>setView("summer")}>View</button>
        </div>
        <div className="set-row">
          <div><div className="set-label">Focus timer</div><div className="set-sub">25-min Pomodoro with XP bonus</div></div>
          <button className="btn btn-g btn-sm" onClick={()=>setShowFocusTimer(true)}>Start</button>
        </div>
        <div className="set-row">
          <div><div className="set-label">Devices</div><div className="set-sub">Manage access</div></div>
          <button className="btn btn-g btn-sm" onClick={()=>setView("devices")}>View</button>
        </div>
      </div>
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
          <div className="av av-sm" style={{width:40,height:40,background:cc.bg,color:cc.tx,fontSize:14}}>{kid.initials}</div>
          <div>
            <div className="km-name">{kid.name}</div>
            <div className="km-sub">Level {Math.floor((kid.xp||0)/100)+1} · {kid.xp||0} XP</div>
          </div>
          <button className="km-back" onClick={exitToPickerFromApp}>← Home</button>
        </div>
        <div className="km-tabs">
          {[{id:"chores",lbl:"Tasks"},{id:"summer",lbl:"☀️ Summer"},{id:"store",lbl:"Store"},{id:"money",lbl:"Money"}].map(t=>(
            <button key={t.id} className={`km-tab${kmTab===t.id?" act":""}`} onClick={()=>setKmTab(t.id)}>{t.lbl}</button>
          ))}
        </div>
        <div className="km-content">
          {kmTab==="chores"&&(
            <div>
              <KidSummerCard kidId={activeKid} kidName={kid.name}/>
              <ChoresView/>
            </div>
          )}
          {kmTab==="summer"&&(
            <KidSummerCard kidId={activeKid} kidName={kid.name}/>
          )}
          {kmTab==="store"&&<StoreView/>}
          {kmTab==="money"&&<MoneyView/>}
        </div>
      </div>
    );
  }

  /* ── Add/Edit Chore Modal ── */
  function ChoreModal(){
    const[form,setForm]=useState(editChore||cf);
    const days=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    return(
      <div className="overlay" onClick={()=>{setShowAddChore(false);setEditChore(null);}}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-h">{editChore?"Edit Chore":"Add Chore"}</div>
          <div className="fg"><label className="fl">Title</label>
            <input className="fi" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Difficulty</label>
            <select className="fi" value={form.diff} onChange={e=>setForm(f=>({...f,diff:e.target.value}))}>
              <option value="easy">Easy (+10 XP)</option>
              <option value="medium">Medium (+20 XP)</option>
              <option value="hard">Hard (+35 XP)</option>
            </select></div>
          <div className="fg"><label className="fl">XP reward</label>
            <input className="fi" type="number" value={form.xp||10} onChange={e=>setForm(f=>({...f,xp:+e.target.value}))}/></div>
          <div className="fg"><label className="fl">Schedule</label>
            <select className="fi" value={form.scheduleType} onChange={e=>setForm(f=>({...f,scheduleType:e.target.value}))}>
              <option value="daily">Every day</option>
              <option value="weekly">Specific days</option>
            </select></div>
          {form.scheduleType==="weekly"&&(
            <div className="fg"><label className="fl">Days</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {days.map(d=>(
                  <button key={d} className={`btn btn-sm ${form.scheduleDays?.includes(d)?"btn-p":"btn-g"}`}
                    onClick={()=>setForm(f=>({...f,scheduleDays:f.scheduleDays?.includes(d)?f.scheduleDays.filter(x=>x!==d):[...(f.scheduleDays||[]),d]}))}>
                    {d}
                  </button>
                ))}
              </div></div>
          )}
          <div className="fg"><label className="fl">Assign to</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {kids.map(k=>(
                <button key={k.id} className={`btn btn-sm ${form.assignedTo?.includes(k.id)?"btn-p":"btn-g"}`}
                  onClick={()=>setForm(f=>({...f,assignedTo:f.assignedTo?.includes(k.id)?f.assignedTo.filter(x=>x!==k.id):[...(f.assignedTo||[]),k.id]}))}>
                  {k.name}
                </button>
              ))}
            </div></div>
          <div className="fg" style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
            <label className="fl">Requires approval</label>
            <label className="sw"><input type="checkbox" checked={form.requiresApproval} onChange={e=>setForm(f=>({...f,requiresApproval:e.target.checked}))}/><div className="sw-tr"/><div className="sw-th"/></label>
          </div>
          <div className="fax">
            {editChore&&<button className="btn btn-co" onClick={()=>{deleteChore(editChore.id);setShowAddChore(false);setEditChore(null);}}>Delete</button>}
            <button className="btn btn-g" onClick={()=>{setShowAddChore(false);setEditChore(null);}}>Cancel</button>
            <button className="btn btn-p" onClick={()=>{if(!form.title)return;saveChore(form);setShowAddChore(false);setEditChore(null);setCf({title:"",diff:"easy",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:[],requiresApproval:false,xp:10});}}>
              {editChore?"Save changes":"Add chore"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  function AddKidModal(){
    const[form,setForm]=useState(kf);
    return(
      <div className="overlay" onClick={()=>setShowAddKid(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-h">Add Kid</div>
          <div className="fg"><label className="fl">Name</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Age</label><input className="fi" type="number" value={form.age} onChange={e=>setForm(f=>({...f,age:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Initials (2 chars)</label><input className="fi" maxLength={2} value={form.initials} onChange={e=>setForm(f=>({...f,initials:e.target.value.toUpperCase()}))}/></div>
          <div className="fax">
            <button className="btn btn-g" onClick={()=>setShowAddKid(false)}>Cancel</button>
            <button className="btn btn-p" onClick={()=>{if(!form.name)return;saveKid(form);setShowAddKid(false);setKf({name:"",age:"",initials:""});}}>Add kid</button>
          </div>
        </div>
      </div>
    );
  }

  function AddItemModal(){
    const[form,setForm]=useState(itemf);
    return(
      <div className="overlay" onClick={()=>setShowAddItem(false)}>
        <div className="modal" onClick={e=>e.stopPropagation()}>
          <div className="modal-h">Add Store Item</div>
          <div className="fg"><label className="fl">Name</label><input className="fi" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Emoji</label><input className="fi" value={form.emoji} onChange={e=>setForm(f=>({...f,emoji:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Description</label><input className="fi" value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))}/></div>
          <div className="fg"><label className="fl">Price (cents)</label><input className="fi" type="number" value={form.priceCents} onChange={e=>setForm(f=>({...f,priceCents:+e.target.value}))}/></div>
          <div className="fax">
            <button className="btn btn-g" onClick={()=>setShowAddItem(false)}>Cancel</button>
            <button className="btn btn-p" onClick={()=>{if(!form.name)return;saveStoreItem(form);setShowAddItem(false);}}>Add item</button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Screen routing ── */
  if(screen==="picker"){
    return(
      <>
        <style>{CSS}</style>
        {showCfg&&<FirebaseCfgModal onSave={cfg=>{localStorage.setItem("wh_fbcfg",JSON.stringify(cfg));setFbCfg(cfg);setShowCfg(false);}} onSkip={()=>setShowCfg(false)}/>}
        <ProfilePicker kids={kids} onSelectKid={handlePickerKid} onSelectParent={handlePickerParent}/>
      </>
    );
  }

  if(screen==="pin-set"){
    return(
      <>
        <style>{CSS}</style>
        <PINScreen mode="set" onSuccess={enterParentMode} onBack={()=>setScreen("picker")}/>
      </>
    );
  }

  if(screen==="pin-verify"){
    return(
      <>
        <style>{CSS}</style>
        <PINScreen mode="verify" onSuccess={enterParentMode} onBack={()=>setScreen("picker")}/>
      </>
    );
  }

  if(screen==="kid"){
    return(
      <>
        <style>{CSS}</style>
        <KidModeApp/>
        {toasts.length>0&&(
          <div className="toasts">
            {toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
          </div>
        )}
      </>
    );
  }

  /* ── Parent mode app ── */
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

  const bnav=[
    {id:"dashboard",ic:"⬡",lbl:"Home"},
    {id:"chores",ic:"✓",lbl:"Chores"},
    {id:"summer",ic:"☀️",lbl:"Summer"},
    {id:"store",ic:"🛍️",lbl:"Store"},
    {id:"activity",ic:"↻",lbl:"Log"},
  ];

  return(
    <>
      <style>{CSS}</style>

      {/* Modals */}
      {showCfg&&<FirebaseCfgModal onSave={cfg=>{localStorage.setItem("wh_fbcfg",JSON.stringify(cfg));setFbCfg(cfg);setShowCfg(false);}} onSkip={()=>setShowCfg(false)}/>}
      {showAddChore&&<ChoreModal/>}
      {showAddKid&&<AddKidModal/>}
      {showAddItem&&<AddItemModal/>}
      {showFocusTimer&&<FocusTimerModal kids={kids} onClose={()=>setShowFocusTimer(false)} onAwardXp={awardXp}/>}

      <div className="app">
        {/* Sidebar */}
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
                {n.id==="summer"&&<SummerNavBadge kidId={null}/>}
              </button>
            ))}
          </div>

          <div style={{padding:"0 9px"}}>
            <div className="nlbl">Kids</div>
            {kids.map(k=>{
              const cc=COLORS[k.colorIdx]||COLORS[0];
              return(
                <button key={k.id} className={`kni${activeKid===k.id?" act":""}`}
                  onClick={()=>{setActiveKid(k.id);setSelDate(today());setView("chores");}}>
                  <div className="av-xs" style={{width:22,height:22,background:cc.bg,color:cc.tx,fontSize:9}}>{k.initials}</div>
                  {k.name}
                </button>
              );
            })}
            {activeKid&&(
              <button className="kni" style={{color:"var(--tx3)"}} onClick={()=>{setActiveKid(null);setView("dashboard");}}>
                <span style={{width:22,textAlign:"center"}}>←</span>All kids
              </button>
            )}
          </div>

          <div className="sfoot">
            <div className="swrow">
              <span>Parent mode</span>
              <label className="sw">
                <input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/>
                <div className="sw-tr"/><div className="sw-th"/>
              </label>
            </div>
            <button className="ni" style={{color:"var(--tx3)",marginTop:2}} onClick={exitToPickerFromApp}>
              <span className="ic">←</span>Profile picker
            </button>
            <button className="ni" style={{color:"var(--tx3)"}} onClick={()=>setShowCfg(true)}>
              <span className="ic">⚙</span>Firebase setup
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="main">
          <div className="topbar">
            <div><div className="tb-t">{vm.t}</div><div className="tb-s">{vm.s}</div></div>
            <div className="tb-r">
              {pendCount>0&&parentMode&&<span style={{background:"rgba(245,166,35,0.13)",color:"var(--am)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>{pendCount} pending</span>}
              {ready&&<span style={{background:"rgba(45,212,167,0.09)",color:"var(--te)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>● Live</span>}
              {parentMode&&<button className="btn btn-g btn-sm" onClick={()=>setShowFocusTimer(true)}>⏱ Focus</button>}
              {parentMode&&view==="store"&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddItem(true)}>+ Item</button>}
              {parentMode&&<button className="btn btn-p btn-sm" onClick={()=>setShowAddChore(true)}>+ Chore</button>}
              {parentMode&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddKid(true)}>+ Kid</button>}
            </div>
          </div>

          <div className="content">
            {view==="dashboard"&&<DashboardView/>}
            {view==="chores"&&<ChoresView/>}
            {view==="store"&&<StoreView/>}
            {view==="money"&&<MoneyView/>}
            {view==="activity"&&<ActivityView/>}
            {view==="summer"&&(
              <SummerView
                kids={kids}
                summerKids={summerKids}
                weekly={summerWeekly}
                monthly={summerMonthly}
              />
            )}
            {view==="devices"&&<DevicesView/>}
            {view==="settings"&&<SettingsView/>}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bnav">
        <div className="bnav-inner">
          {bnav.map(n=>(
            <button key={n.id} className={`bnav-btn${view===n.id?" act":""}`}
              onClick={()=>{setView(n.id);if(!["chores","store"].includes(n.id))setActiveKid(null);}}>
              <span className="bnav-ic">{n.ic}</span>{n.lbl}
            </button>
          ))}
        </div>
      </nav>

      {/* Toasts */}
      {toasts.length>0&&(
        <div className="toasts">
          {toasts.map(t=><div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
        </div>
      )}
    </>
  );
}

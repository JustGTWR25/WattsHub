import{useState,useEffect,useRef,useCallback,useMemo,Component}from"react";

/* ─── FIREBASE ────────────────────────────────────────────── */
let _db=null,_auth=null;
let _ref,_set,_update,_onValue,_off,_remove,_push,_signInAnon,_onAuthState;
async function bootFirebase(cfg){
  try{
    const[fa,fd,fauth]=await Promise.all([import("https://esm.sh/firebase/app"),import("https://esm.sh/firebase/database"),import("https://esm.sh/firebase/auth")]);
    const app=fa.getApps().length?fa.getApp():fa.initializeApp(cfg);
    _db=fd.getDatabase(app);_auth=fauth.getAuth(app);
    _ref=fd.ref;_set=fd.set;_update=fd.update;_onValue=fd.onValue;_off=fd.off;_remove=fd.remove;_push=fd.push;
    _signInAnon=fauth.signInAnonymously;_onAuthState=fauth.onAuthStateChanged;
    return true;
  }catch(e){console.warn("Firebase boot failed",e);return false;}
}
function useFirebase(cfg){
  const[state,setState]=useState({ready:false,uid:null,db:null,online:true});
  const subs=useRef([]);
  const dbRef=useRef(null);
  useEffect(()=>{
    if(!cfg)return;
    bootFirebase(cfg).then(ok=>{
      if(!ok)return;
      dbRef.current=_db;
      setState(s=>({...s,db:_db}));
      _onValue(_ref(_db,".info/connected"),s=>setState(prev=>({...prev,online:!!s.val()})));
      _onAuthState(_auth,async u=>{
        if(u)setState(s=>({...s,uid:u.uid,ready:true}));
        else{try{await _signInAnon(_auth);}catch{setState(s=>({...s,ready:true}));}}
      });
    });
    return()=>{subs.current.forEach(f=>f());subs.current=[];};
  },[cfg]);
  const op=useCallback((fn)=>(...a)=>dbRef.current?fn(dbRef.current,...a):null,[]);
  const listen=useCallback((path,cb)=>{
    if(!dbRef.current)return()=>{};
    const r=_ref(dbRef.current,path);
    _onValue(r,s=>cb(s.val()));
    const u=()=>_off(r);
    subs.current.push(u);return u;
  },[state.db]);
  const atomic=useCallback((upd)=>dbRef.current&&_update(_ref(dbRef.current),upd),[state.db]);
  const write=useCallback((p,v)=>dbRef.current&&_set(_ref(dbRef.current,p),v),[state.db]);
  const del=useCallback((p)=>dbRef.current&&_remove(_ref(dbRef.current,p)),[state.db]);
  return{...state,listen,atomic,write,del};
}

/* ─── UTILS ───────────────────────────────────────────────── */
const ld=()=>new Date().toLocaleDateString("en-CA");
const lp=s=>new Date(s+"T00:00:00");
const wk=d=>{const dt=lp(d),j=new Date(dt.getFullYear(),0,1),n=Math.ceil(((dt-j)/86400000+j.getDay()+1)/7);return`${dt.getFullYear()}-W${String(n).padStart(2,"0")}`;};
const mk=d=>{const dt=lp(d);return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;};
const uid6=()=>Math.random().toString(36).slice(2,8);
const tkid=(id)=>`tx_${Date.now()}_${id}_${uid6()}`;
const c$=(v)=>`$${(Math.round(v||0)/100).toFixed(2)}`;
const DOW=d=>lp(d).toLocaleDateString("en-US",{weekday:"short"});
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SDAYS=new Set([1,2,3,4]);
const SFOCUS={Monday:"math",Tuesday:"literacy",Wednesday:"math",Thursday:"literacy"};
const sumActive=()=>{const n=new Date(),s=new Date("2026-06-01T00:00:00"),e=new Date("2026-08-15T00:00:00");return n>=s&&n<=e;};
const sumWeeks=()=>{const s=new Date("2026-06-01T00:00:00"),n=new Date();return n<s?0:Math.max(1,Math.ceil((n-s)/(7*86400000)));};
const prevSessDay=()=>{const d=new Date();d.setDate(d.getDate()-1);for(let i=0;i<5;i++){if(SDAYS.has(d.getDay()))return d.toLocaleDateString("en-CA");d.setDate(d.getDate()-1);}return null;};

/* ─── CLEANING POOL: intervals + seed ─────────────────────── */
const INTERVAL_DAYS={daily:1,weekly:7,biweekly:14,monthly:30,seasonal:90};
const FREQ_OPTS=["daily","weekly","biweekly","monthly","seasonal"];
const FREQ_LBL={daily:"Daily",weekly:"Weekly",biweekly:"Biweekly",monthly:"Monthly",seasonal:"Seasonal"};
function intervalMsOf(c){const d=(c&&c.intervalDays)||INTERVAL_DAYS[c&&c.freq]||7;return d*86400000;}
// Recurring chores rest until their interval elapses, then become due again.
// Legacy (non-recurring) chores keep the old "available unless completed" behavior.
function isPoolDue(c,now=Date.now()){
  if(c&&c.recurring){ if(!c.lastCompletedAt)return true; return now-c.lastCompletedAt>=intervalMsOf(c); }
  return !(c&&c.completedBy);
}
function daysUntilDue(c,now=Date.now()){ if(isPoolDue(c,now))return 0; return Math.ceil((c.lastCompletedAt+intervalMsOf(c)-now)/86400000); }
function dueLabel(c,now=Date.now()){ const d=daysUntilDue(c,now); if(d===0)return"Due now"; if(d===1)return"Done · back tomorrow"; return `Done · back in ${d} days`; }

const CLEAN_SEED=[
  {id:'cl_kitchen_01',title:'Wipe countertops & stovetop',area:'Kitchen',freq:'daily',intervalDays:1,priceCents:35,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_03',title:'Wipe down sink',area:'Kitchen',freq:'daily',intervalDays:1,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_04',title:'Sweep or vacuum floor',area:'Kitchen',freq:'daily',intervalDays:1,priceCents:35,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_05',title:'Empty trash',area:'Kitchen',freq:'daily',intervalDays:1,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_06',title:'Wipe microwave interior',area:'Kitchen',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_07',title:'Clean stovetop burners & grates',area:'Kitchen',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_08',title:'Wipe cabinet fronts & handles',area:'Kitchen',freq:'weekly',intervalDays:7,priceCents:75,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_09',title:'Mop floor',area:'Kitchen',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_10',title:'Clean refrigerator exterior & handles',area:'Kitchen',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_11',title:'Wipe backsplash',area:'Kitchen',freq:'biweekly',intervalDays:14,priceCents:75,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_12',title:'Clean inside microwave',area:'Kitchen',freq:'biweekly',intervalDays:14,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_13',title:'Clean oven interior',area:'Kitchen',freq:'monthly',intervalDays:30,priceCents:400,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_14',title:'Clean refrigerator interior & drawers',area:'Kitchen',freq:'monthly',intervalDays:30,priceCents:300,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_15',title:'Wash trash can',area:'Kitchen',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_16',title:'Clean range hood & filter',area:'Kitchen',freq:'monthly',intervalDays:30,priceCents:250,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_17',title:'Descale dishwasher & run clean cycle',area:'Kitchen',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_18',title:'Pull out fridge/stove & clean behind',area:'Kitchen',freq:'seasonal',intervalDays:90,priceCents:500,recurring:true,source:"cleaningChecklist"},
  {id:'cl_kitchen_19',title:'Deep clean pantry & check expiry dates',area:'Kitchen',freq:'seasonal',intervalDays:90,priceCents:400,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_01',title:'Wipe toilet seat & exterior',area:'Bathrooms',freq:'daily',intervalDays:1,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_02',title:'Wipe sink & faucet',area:'Bathrooms',freq:'daily',intervalDays:1,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_04',title:'Empty trash',area:'Bathrooms',freq:'weekly',intervalDays:7,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_05',title:'Scrub toilet bowl',area:'Bathrooms',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_06',title:'Clean shower/tub',area:'Bathrooms',freq:'weekly',intervalDays:7,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_07',title:'Mop or scrub floor',area:'Bathrooms',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_08',title:'Wash bath mat',area:'Bathrooms',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_09',title:'Wipe mirrors',area:'Bathrooms',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_10',title:'Restock toiletries & paper products',area:'Bathrooms',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_11',title:'Wipe cabinet faces & light switches',area:'Bathrooms',freq:'biweekly',intervalDays:14,priceCents:75,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_12',title:'Scrub grout',area:'Bathrooms',freq:'monthly',intervalDays:30,priceCents:350,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_13',title:'Clean exhaust fan cover',area:'Bathrooms',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_14',title:'Wash shower curtain & liner',area:'Bathrooms',freq:'monthly',intervalDays:30,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bath_15',title:'Deep clean & organize under-sink cabinet',area:'Bathrooms',freq:'seasonal',intervalDays:90,priceCents:400,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_02',title:'Fluff & straighten cushions',area:'Living room & dining',freq:'daily',intervalDays:1,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_03',title:'Vacuum upholstery & cushions',area:'Living room & dining',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_04',title:'Vacuum carpets & rugs',area:'Living room & dining',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_05',title:'Dust furniture surfaces',area:'Living room & dining',freq:'weekly',intervalDays:7,priceCents:75,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_07',title:'Empty trash & recycling',area:'Living room & dining',freq:'weekly',intervalDays:7,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_08',title:'Dust shelves & decor',area:'Living room & dining',freq:'biweekly',intervalDays:14,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_09',title:'Clean light switches & door handles',area:'Living room & dining',freq:'biweekly',intervalDays:14,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_10',title:'Dust baseboards',area:'Living room & dining',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_11',title:'Clean windows & sills',area:'Living room & dining',freq:'monthly',intervalDays:30,priceCents:200,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_12',title:'Wash throw blankets & pillowcases',area:'Living room & dining',freq:'monthly',intervalDays:30,priceCents:75,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_13',title:'Move furniture & vacuum underneath',area:'Living room & dining',freq:'seasonal',intervalDays:90,priceCents:400,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_14',title:'Clean curtains or drapes',area:'Living room & dining',freq:'seasonal',intervalDays:90,priceCents:350,recurring:true,source:"cleaningChecklist"},
  {id:'cl_living_15',title:'Dust ceiling fan blades',area:'Living room & dining',freq:'seasonal',intervalDays:90,priceCents:200,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_01',title:'Make beds',area:'Bedrooms',freq:'daily',intervalDays:1,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_03',title:'Vacuum or sweep floors',area:'Bedrooms',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_04',title:'Change bed linens',area:'Bedrooms',freq:'weekly',intervalDays:7,priceCents:100,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_05',title:'Dust nightstands & dressers',area:'Bedrooms',freq:'weekly',intervalDays:7,priceCents:75,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_06',title:'Wipe mirrors',area:'Bedrooms',freq:'biweekly',intervalDays:14,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_07',title:'Dust ceiling fan & light fixtures',area:'Bedrooms',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_08',title:'Wipe window sills & blinds',area:'Bedrooms',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_bed_09',title:'Flip / rotate mattress',area:'Bedrooms',freq:'seasonal',intervalDays:90,priceCents:300,recurring:true,source:"cleaningChecklist",suggested:true},
  {id:'cl_bed_10',title:'Wash comforter/duvet & declutter closet',area:'Bedrooms',freq:'seasonal',intervalDays:90,priceCents:400,recurring:true,source:"cleaningChecklist",suggested:true},
  {id:'cl_laundry_01',title:'Wipe washer exterior',area:'Laundry room',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_laundry_02',title:'Clean lint trap',area:'Laundry room',freq:'weekly',intervalDays:7,priceCents:25,recurring:true,source:"cleaningChecklist"},
  {id:'cl_laundry_03',title:'Wipe down dryer exterior',area:'Laundry room',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_laundry_04',title:'Clean washer drum (self-clean cycle)',area:'Laundry room',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_laundry_05',title:'Vacuum behind & under machines',area:'Laundry room',freq:'monthly',intervalDays:30,priceCents:250,recurring:true,source:"cleaningChecklist"},
  {id:'cl_laundry_06',title:'Clean dryer vent & duct',area:'Laundry room',freq:'seasonal',intervalDays:90,priceCents:400,recurring:true,source:"cleaningChecklist"},
  {id:'cl_entry_01',title:'Sweep or vacuum floors',area:'Entryway & hallways',freq:'daily',intervalDays:1,priceCents:35,recurring:true,source:"cleaningChecklist"},
  {id:'cl_entry_02',title:'Wipe down door handles',area:'Entryway & hallways',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_entry_03',title:'Dust light fixtures',area:'Entryway & hallways',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_entry_04',title:'Wipe baseboards & walls',area:'Entryway & hallways',freq:'monthly',intervalDays:30,priceCents:200,recurring:true,source:"cleaningChecklist"},
  {id:'cl_entry_05',title:'Wash exterior windows & door glass',area:'Entryway & hallways',freq:'seasonal',intervalDays:90,priceCents:350,recurring:true,source:"cleaningChecklist"},
  {id:'cl_home_01',title:'Take out all trash & recycling',area:'Whole home',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_home_02',title:'Wipe light switches & door knobs',area:'Whole home',freq:'weekly',intervalDays:7,priceCents:50,recurring:true,source:"cleaningChecklist"},
  {id:'cl_home_03',title:'Dust ceiling corners for cobwebs',area:'Whole home',freq:'monthly',intervalDays:30,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_home_04',title:'Replace HVAC filter',area:'Whole home',freq:'seasonal',intervalDays:90,priceCents:200,recurring:true,source:"cleaningChecklist"},
  {id:'cl_home_05',title:'Test smoke & CO detectors',area:'Whole home',freq:'seasonal',intervalDays:90,priceCents:150,recurring:true,source:"cleaningChecklist"},
  {id:'cl_home_06',title:'Clean windows inside & out',area:'Whole home',freq:'seasonal',intervalDays:90,priceCents:500,recurring:true,source:"cleaningChecklist"},
  {id:'cl_home_07',title:'Wash walls & baseboards',area:'Whole home',freq:'seasonal',intervalDays:90,priceCents:400,recurring:true,source:"cleaningChecklist"},
];

const PAL=[
  {a:"#4F46E5",l:"#EEF2FF",t:"#4338CA"},
  {a:"#059669",l:"#ECFDF5",t:"#047857"},
  {a:"#DC2626",l:"#FEF2F2",t:"#B91C1C"},
  {a:"#D97706",l:"#FFFBEB",t:"#B45309"},
  {a:"#7C3AED",l:"#F5F3FF",t:"#6D28D9"},
  {a:"#0891B2",l:"#ECFEFF",t:"#0E7490"},
];

/* ─── ERROR BOUNDARY ──────────────────────────────────────── */
class ErrBound extends Component{
  constructor(p){super(p);this.state={err:null};}
  static getDerivedStateFromError(e){return{err:e};}
  render(){
    if(this.state.err)return(<div style={{padding:"2rem",textAlign:"center",fontFamily:"system-ui"}}>
      <div style={{fontSize:28,marginBottom:8}}>⚠️</div>
      <div style={{fontWeight:700,marginBottom:4}}>{this.state.err.message}</div>
      <button onClick={()=>this.setState({err:null})} style={{marginTop:8,padding:"6px 16px",border:"1px solid #ccc",borderRadius:8,cursor:"pointer",background:"#fff"}}>Try again</button>
    </div>);
    return this.props.children;
  }
}

/* ─── TOAST ───────────────────────────────────────────────── */
function useToasts(){
  const[list,setList]=useState([]);
  const add=useCallback((msg,type="info",dur=3000)=>{
    const id=Date.now()+Math.random();
    setList(l=>[...l,{id,msg,type}]);
    setTimeout(()=>setList(l=>l.filter(x=>x.id!==id)),dur);
  },[]);
  return{list,add};
}

/* ─── SEEDS ───────────────────────────────────────────────── */
const SK=[
  {id:"k1",name:"Tayonna",age:17,colorIdx:0,initials:"TW",balanceCents:0,goal:{weeklyTargetCents:400}},
  {id:"k2",name:"Brianna",age:14,colorIdx:1,initials:"BW",balanceCents:0,goal:{weeklyTargetCents:300}},
  {id:"k3",name:"Leon",   age:10,colorIdx:2,initials:"LW",balanceCents:0,goal:{weeklyTargetCents:200}},
];
const SP=[
  {id:"p1",name:"Greg",    initials:"GW",colorIdx:4},
  {id:"p2",name:"Katherine",initials:"KW",colorIdx:5},
];
const SC=[
  {id:"c1",title:"Make bed",      diff:"easy",  scheduleType:"daily", scheduleDays:[],                          assignedTo:["k1","k2","k3"],priceCents:25, requiresApproval:false},
  {id:"c2",title:"Clean room",    diff:"medium",scheduleType:"daily", scheduleDays:[],                          assignedTo:["k1","k2","k3"],priceCents:50, requiresApproval:false},
  {id:"c3",title:"Dishes",        diff:"medium",scheduleType:"weekly",scheduleDays:["Mon","Tue","Wed","Thu","Fri"],assignedTo:["k1","k2"],  priceCents:50, requiresApproval:false},
  {id:"c4",title:"Take out trash",diff:"easy",  scheduleType:"weekly",scheduleDays:["Sun"],                    assignedTo:["k3"],          priceCents:25, requiresApproval:true},
  {id:"c5",title:"Vacuum",        diff:"hard",  scheduleType:"weekly",scheduleDays:["Sat"],                    assignedTo:["k1","k2","k3"],priceCents:100,requiresApproval:true},
];
const SBILLS=[
  {id:"b1",kidId:"k1",name:"Cell phone", amountCents:4500,type:"monthly",active:true},
  {id:"b2",kidId:"k2",name:"Cell phone", amountCents:4500,type:"monthly",active:true},
  {id:"b3",kidId:"k3",name:"Soccer",     amountCents:6000,type:"monthly",active:true},
];
const STORE_DEF=[
  {id:"sd1",name:"30 min screen time",emoji:"📱",priceCents:50},
  {id:"sd2",name:"Pick dinner",        emoji:"🍕",priceCents:100},
  {id:"sd3",name:"Stay up 30 min",     emoji:"🌙",priceCents:80},
  {id:"sd4",name:"Skip one chore",     emoji:"🎯",priceCents:150},
  {id:"sd5",name:"Movie night pick",   emoji:"🎬",priceCents:120},
  {id:"sd6",name:"Cash out $1",        emoji:"💵",priceCents:100},
];

/* ─── CSS ─────────────────────────────────────────────────── */
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#F0F2F5;--sur:#FFFFFF;--bdr:#E5E7EB;--bdr2:#D1D5DB;
  --tx:#111827;--tx2:#6B7280;--tx3:#9CA3AF;
  --pr:#4F46E5;--prl:#EEF2FF;--prd:#4338CA;
  --gr:#059669;--grl:#ECFDF5;
  --re:#DC2626;--rel:#FEF2F2;
  --am:#D97706;--aml:#FFFBEB;
  --bl:#0891B2;--bll:#ECFEFF;
}
html,body{background:var(--bg);color:var(--tx);font-family:'Nunito',system-ui,sans-serif;min-height:100vh;min-height:-webkit-fill-available;-webkit-tap-highlight-color:transparent;font-size:14px;}
button,input,select,textarea{font-family:inherit;-webkit-appearance:none;}
::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px;}

.layout{display:flex;min-height:100vh;min-height:-webkit-fill-available;}
.sidebar{width:224px;flex-shrink:0;background:var(--sur);border-right:1px solid var(--bdr);display:flex;flex-direction:column;height:100vh;height:-webkit-fill-available;position:sticky;top:0;overflow-y:auto;}
.main{flex:1;min-width:0;overflow-y:auto;height:100vh;height:-webkit-fill-available;}
.topbar{background:var(--sur);border-bottom:1px solid var(--bdr);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:20;}
.content{padding:18px 20px 40px;max-width:960px;}
.slogo{padding:16px 14px 12px;font-size:17px;font-weight:900;color:var(--pr);border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px;}
.snav{padding:8px;flex:1;}
.sdiv{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);padding:8px 10px 3px;}
.sni{display:flex;align-items:center;gap:9px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;font-weight:600;padding:8px 10px;border-radius:8px;transition:all .15s;text-align:left;}
.sni:hover{background:var(--bg);color:var(--tx);}
.sni.act{background:var(--prl);color:var(--pr);}
.sbadge{margin-left:auto;background:var(--am);color:#fff;font-size:10px;font-weight:800;border-radius:10px;padding:1px 6px;}
.sfoot{padding:10px;border-top:1px solid var(--bdr);}
.skid{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;font-weight:600;padding:7px 10px;border-radius:8px;transition:all .15s;}
.skid:hover{background:var(--bg);color:var(--tx);}
.skid.act{background:var(--prl);color:var(--pr);}

.card{background:var(--sur);border:1px solid var(--bdr);border-radius:12px;padding:16px;}
.card+.card{margin-top:12px;}
.ch{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:10px;}
.dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}
.sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}
.rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}

.btn{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit;}
.bp{background:var(--pr);color:#fff;}.bp:hover{background:var(--prd);}
.bg{background:var(--sur);color:var(--tx);border:1px solid var(--bdr2);}.bg:hover{background:var(--bg);}
.bte{background:var(--grl);color:var(--gr);border:1px solid #A7F3D0;}
.bco{background:var(--rel);color:var(--re);border:1px solid #FECACA;}
.bam{background:var(--aml);color:var(--am);border:1px solid #FCD34D;}
.bbl{background:var(--bll);color:var(--bl);border:1px solid #A5F3FC;}
.bsm{padding:5px 10px;font-size:12px;}
.bxs{padding:3px 8px;font-size:11px;}

.ccard{background:var(--sur);border:1px solid var(--bdr);border-radius:10px;padding:11px 13px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all .15s;margin-bottom:7px;user-select:none;}
.ccard:hover{border-color:var(--bdr2);}
.ccard.done{opacity:.6;background:var(--bg);}
.ccard.pend{border-color:#FCD34D;background:var(--aml);}
.ccard.opt{opacity:.7;}
.ccard.claimed{border-color:#A5F3FC;background:var(--bll);}
.cchk{width:22px;height:22px;border-radius:6px;border:2px solid var(--bdr2);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}
.cchk.done{background:var(--gr);border-color:var(--gr);}
.cchk.pend{background:var(--am);border-color:var(--am);}
.cchk.opt{background:var(--prl);border-color:var(--pr);}
.ctitle{font-size:13px;font-weight:700;flex:1;min-width:0;}
.cdiff{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;flex-shrink:0;}
.de{background:#DCFCE7;color:#15803D;}.dm{background:#FEF9C3;color:#854D0E;}.dh{background:#FEE2E2;color:#991B1B;}
.cprice{font-size:12px;font-weight:800;color:var(--gr);flex-shrink:0;}

.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}
.modal{background:var(--sur);border-radius:16px;padding:22px;width:100%;max-width:460px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);}
.modal-h{font-size:16px;font-weight:800;margin-bottom:14px;}
.fg{display:flex;flex-direction:column;gap:4px;margin-bottom:11px;}
.fl{font-size:12px;font-weight:700;color:var(--tx2);}
.fi{background:var(--bg);border:1px solid var(--bdr2);border-radius:8px;padding:9px 12px;color:var(--tx);font-size:13px;outline:none;transition:border-color .15s;width:100%;}
.fi:focus{border-color:var(--pr);background:var(--sur);}
textarea.fi{resize:vertical;min-height:70px;}
.frow{display:flex;gap:6px;flex-wrap:wrap;}
.fax{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;}
.sw-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;}
.sw{position:relative;width:36px;height:20px;cursor:pointer;display:inline-block;}
.sw input{opacity:0;width:0;height:0;}
.sw-t{position:absolute;inset:0;background:var(--bdr2);border-radius:10px;transition:.2s;}
.sw input:checked+.sw-t{background:var(--pr);}
.sw-th{position:absolute;left:2px;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}
.sw input:checked~.sw-th{transform:translateX(16px);}

.picker{min-height:100vh;min-height:-webkit-fill-available;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);padding:24px;}
.pgrid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:600px;}
.pcard{background:var(--sur);border:1.5px solid var(--bdr);border-radius:16px;padding:20px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all .2s;min-width:110px;}
.pcard:hover{border-color:var(--pr);box-shadow:0 4px 16px rgba(79,70,229,.15);transform:translateY(-2px);}
.pin-wrap{min-height:100vh;min-height:-webkit-fill-available;display:flex;align-items:center;justify-content:center;background:var(--bg);}
.pin-box{background:var(--sur);border-radius:16px;padding:28px 24px;width:min(300px,92vw);display:flex;flex-direction:column;align-items:center;gap:14px;box-shadow:0 8px 30px rgba(0,0,0,.1);}
.pin-dots{display:flex;gap:12px;}
.pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--bdr2);transition:all .15s;}
.pin-dot.on{background:var(--pr);border-color:var(--pr);}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;}
.pin-btn{background:var(--bg);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:18px;font-weight:700;padding:14px;cursor:pointer;transition:all .15s;}
.pin-btn:hover{background:var(--prl);border-color:var(--pr);}
.pin-err{font-size:12px;color:var(--re);min-height:16px;}

.km-wrap{display:flex;flex-direction:column;min-height:100vh;min-height:-webkit-fill-available;background:var(--bg);}
.km-hdr{background:var(--sur);border-bottom:1px solid var(--bdr);padding:13px 15px;display:flex;align-items:center;gap:11px;}
.km-tabs{background:var(--sur);border-bottom:1px solid var(--bdr);display:flex;}
.km-tab{flex:1;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:12px;font-weight:700;padding:11px 0;transition:all .15s;border-bottom:2px solid transparent;}
.km-tab.act{color:var(--pr);border-bottom-color:var(--pr);}
.km-body{padding:13px 13px 80px;}

.bnav{display:none;position:fixed;bottom:0;left:0;right:0;width:100%;background:var(--sur);border-top:1px solid var(--bdr);z-index:50;}
.bnav-in{display:flex;width:100%;padding-bottom:env(safe-area-inset-bottom,0px);}
.bnav-btn{flex:1;background:none;border:none;color:var(--tx3);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;min-width:0;}
.bnav-btn.act{color:var(--pr);}
.bnav-ic{font-size:19px;line-height:1;}

.toasts{position:fixed;bottom:24px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:200;pointer-events:none;}
.toast{background:var(--sur);border:1px solid var(--bdr);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.1);max-width:280px;animation:tIn .2s ease;}
@keyframes tIn{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
.t-success{border-color:#A7F3D0;color:var(--gr);}
.t-warn{border-color:#FCD34D;color:var(--am);}
.t-err{border-color:#FECACA;color:var(--re);}
.t-info{border-color:#C7D2FE;color:var(--pr);}

.pill{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;}
.pill-gr{background:var(--grl);color:var(--gr);}
.pill-am{background:var(--aml);color:var(--am);}
.pill-pr{background:var(--prl);color:var(--pr);}
.pill-re{background:var(--rel);color:var(--re);}
.pill-bl{background:var(--bll);color:var(--bl);}
.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--bg);color:var(--tx2);border:1px solid var(--bdr);}
.pbar{height:7px;background:var(--bg);border-radius:4px;overflow:hidden;margin-top:4px;}
.pbar-f{height:100%;border-radius:4px;transition:width .5s ease;}
.alog-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr);}
.alog-row:last-child{border-bottom:none;}
.empty{text-align:center;padding:2.5rem 1rem;color:var(--tx3);}
.offline-bar{position:fixed;top:0;left:0;right:0;background:#FCD34D;color:#92400E;font-size:12px;font-weight:700;text-align:center;padding:5px;z-index:300;}
.sum-card{background:var(--sur);border:1.5px solid #C7D2FE;border-radius:12px;padding:14px;margin-bottom:12px;}
.bill-bar{margin-top:8px;}
.bill-header{display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;}
.wk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}
.wk-card{background:var(--sur);border:1px solid var(--bdr);border-radius:12px;padding:14px;}
.wk-stat{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0;border-bottom:1px solid var(--bdr);}
.wk-stat:last-child{border-bottom:none;}

@media(max-width:680px){
  .sidebar{display:none;}.bnav{display:flex;}
  .content{padding:12px 12px 88px;}.topbar{padding:10px 12px;}
  .dgrid,.rgrid{grid-template-columns:1fr;}.sgrid{grid-template-columns:repeat(2,1fr);}
  .wk-grid{grid-template-columns:1fr;}
}
@media print{.sidebar,.bnav,.topbar,.no-print{display:none!important;}.main{height:auto;overflow:visible;}}
`;

/* ─── SHARED COMPONENTS ───────────────────────────────────── */
function Av({initials,colorIdx,size=38}){
  const p=PAL[colorIdx%PAL.length];
  return <div style={{width:size,height:size,borderRadius:"50%",background:p.l,color:p.a,fontSize:size*.36,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{initials}</div>;
}

async function sha256(s){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("");}
function PINScreen({mode,onSuccess,onBack}){
  const[pin,setPin]=useState("");const[pin2,setPin2]=useState("");
  const[step,setStep]=useState(mode==="set"?"a":"v");const[err,setErr]=useState("");
  const tap=d=>{
    if(pin.length>=4)return;
    const nx=pin+d;setPin(nx);setErr("");
    if(nx.length<4)return;
    if(mode==="set"){
      if(step==="a"){setPin2(nx);setPin("");setStep("b");}
      else if(nx===pin2){sha256(nx).then(h=>{localStorage.setItem("wh_pin",h);onSuccess();});}
      else{setErr("PINs don't match");setPin("");setPin2("");setStep("a");}
    }else{
      const stored=localStorage.getItem("wh_pin");
      sha256(nx).then(h=>{if(h===stored)onSuccess();else{setErr("Wrong PIN");setPin("");}});
    }
  };
  const lbl=mode==="set"?(step==="a"?"Create parent PIN":"Confirm PIN"):"Enter parent PIN";
  return(<div className="pin-wrap"><div className="pin-box">
    <div style={{fontSize:22}}>🔑</div>
    <div style={{fontSize:15,fontWeight:800}}>{lbl}</div>
    <div className="pin-dots">{[0,1,2,3].map(i=><div key={i} className={`pin-dot${pin.length>i?" on":""}`}/>)}</div>
    <div className="pin-err">{err}</div>
    <div className="pin-pad">{[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
      <button key={i} className="pin-btn" style={d===""?{visibility:"hidden"}:{}}
        onClick={()=>d==="⌫"?(setPin(p=>p.slice(0,-1)),setErr("")):(tap(String(d)))}>{d}</button>
    ))}</div>
    {onBack&&<button onClick={onBack} className="btn bg bsm">← Back</button>}
  </div></div>);
}

function FbCfgModal({onSave,onSkip}){
  const[cfg,setCfg]=useState({apiKey:"",authDomain:"",databaseURL:"",projectId:"",appId:""});
  return(<div className="overlay"><div className="modal">
    <div className="modal-h">🔥 Connect Firebase</div>
    <p style={{fontSize:12,color:"var(--tx2)",marginBottom:14,lineHeight:1.6}}>Firebase Console → Project Settings → Web app → Config. Enable Realtime Database + Anonymous Auth.</p>
    {[{k:"apiKey",l:"API Key"},{k:"authDomain",l:"Auth Domain",h:"project.firebaseapp.com"},{k:"databaseURL",l:"Database URL",h:"https://project-rtdb.firebaseio.com"},{k:"projectId",l:"Project ID"},{k:"appId",l:"App ID"}].map(f=>(
      <div className="fg" key={f.k}><label className="fl">{f.l}</label>
        <input className="fi" placeholder={f.h||f.l} value={cfg[f.k]} onChange={e=>setCfg(c=>({...c,[f.k]:e.target.value}))}/></div>
    ))}
    <div className="fax">
      <button className="btn bg" onClick={onSkip}>Demo mode</button>
      <button className="btn bp" disabled={!cfg.apiKey||!cfg.databaseURL} onClick={()=>onSave(cfg)}>Connect →</button>
    </div>
  </div></div>);
}

/* ════════════════════════════════════════════════════════════
   MAIN APP
════════════════════════════════════════════════════════════ */
export default function WattsHub(){
  /* Firebase */
  /* Hardcoded config — every device connects automatically */
  const FIREBASE_CFG={
    apiKey:"AIzaSyD6GE7dsUhXUtQR4faVpIVotctG1lS003Y",
    authDomain:"watts-f5205.firebaseapp.com",
    databaseURL:"https://watts-f5205-default-rtdb.firebaseio.com",
    projectId:"watts-f5205",
    storageBucket:"watts-f5205.firebasestorage.app",
    messagingSenderId:"982199951741",
    appId:"1:982199951741:web:a89cebda2dff026f7eac14",
  };
  const[fbCfg,setFbCfg]=useState(()=>{
    /* Check localStorage first in case config was updated via the setup modal */
    for(const k of["wh_fbcfg","wh3_cfg","wh_fb","wattshub_cfg"]){
      try{const p=JSON.parse(localStorage.getItem(k)||"null");if(p?.apiKey&&p?.databaseURL)return p;}catch{}
    }
    return FIREBASE_CFG;
  });
  const[showCfg,setShowCfg]=useState(false);
  const FB=useFirebase(fbCfg);
  const{ready,uid,online}=FB;

  /* Data */
  const[kids,setKids]=useState(SK);
  const[parents,setParents]=useState(SP);
  const[chores,setChores]=useState(SC);
  const[pool,setPool]=useState([]);
  const[comps,setComps]=useState({});
  const[parentLog,setParentLog]=useState({});
  const[storeItems,setStoreItems]=useState([]);
  const[txLog,setTxLog]=useState([]);
  const[bills,setBills]=useState(SBILLS);
  const[billPay,setBillPay]=useState({});
  const[allowedUids,setAllowedUids]=useState({});
  const[sumKids,setSumKids]=useState({});
  const[sumSessions,setSumSessions]=useState({});
  const[weeklyCheckins,setWeeklyCheckins]=useState({});

  /* UI */
  const[screen,setScreen]=useState("picker");
  const[view,setView]=useState("dashboard");
  const[activeKid,setActiveKid]=useState(null);
  const[activeParent,setActiveParent]=useState(null);
  const[parentMode,setParentMode]=useState(false);
  const[selDate,setSelDate]=useState(ld());
  const[optim,setOptim]=useState({});

  /* Modals */
  const[choreModal,setChoreModal]=useState(null); // null | {mode:"add"|"edit"|"quick", data:{}}
  const[editCompModal,setEditCompModal]=useState(null);
  const[billModal,setBillModal]=useState(null);
  const[payBillModal,setPayBillModal]=useState(null);
  const[poolAddModal,setPoolAddModal]=useState(false);
  const[poolEditModal,setPoolEditModal]=useState(null); // null | chore object
  const[parentTaskModal,setParentTaskModal]=useState(null);
  const[checkinModal,setCheckinModal]=useState(false);
  const[showTimer,setShowTimer]=useState(false);
  const[bonusModal,setBonusModal]=useState(null); // {kidId, kidName}
  const[noteModal,setNoteModal]=useState(null);   // {kidId, kidName}

  const{list:toasts,add:toast}=useToasts();

  /* Midnight reset */
  useEffect(()=>{
    const ms=new Date().setHours(24,0,0,0)-Date.now();
    const t=setTimeout(()=>setSelDate(ld()),ms);
    return()=>clearTimeout(t);
  },[]);

  /* Firebase listeners */
  useEffect(()=>{
    if(!ready)return;
    const u=[
      FB.listen("wh/kids",          v=>{if(v)setKids(Object.values(v).filter(Boolean));}),
      FB.listen("wh/parents",        v=>{if(v)setParents(Object.values(v).filter(Boolean));}),
      FB.listen("wh/chores",         v=>{if(v)setChores(Object.values(v).filter(Boolean));}),
      FB.listen("wh/pool",           v=>{if(v)setPool(Object.values(v).filter(Boolean));else setPool([]);}),
      FB.listen("wh/comps",          v=>setComps(v||{})),
      FB.listen("wh/parentLog",      v=>setParentLog(v||{})),
      FB.listen("wh/store",          v=>{if(v)setStoreItems(Object.values(v).filter(Boolean));}),
      FB.listen("wh/txlog",          v=>{if(v)setTxLog(Object.values(v).filter(Boolean).sort((a,b)=>b.ts-a.ts));}),
      FB.listen("wh/bills",          v=>{if(v)setBills(Object.values(v).filter(Boolean));}),
      FB.listen("wh/billPayments",   v=>setBillPay(v||{})),
      FB.listen("wh/allowedUids",    v=>setAllowedUids(v||{})),
      FB.listen("wh/summerProgram/kids",v=>setSumKids(v||{})),
      FB.listen("wh/summerSessions", v=>setSumSessions(v||{})),
      FB.listen("wh/weeklyCheckins", v=>setWeeklyCheckins(v||{})),
    ];
    return()=>u.forEach(f=>f&&f());
  },[ready]);

  /* One-time seed */
  useEffect(()=>{
    if(!ready)return;
    const t=setTimeout(()=>{
      const u=FB.listen("wh/chores",v=>{
        u&&u();
        if(!v){
          const u2=FB.listen("wh/kids",kv=>{u2&&u2();if(!kv)SK.forEach(k=>FB.write(`wh/kids/${k.id}`,k));});
          SC.forEach(c=>FB.write(`wh/chores/${c.id}`,c));
          SBILLS.forEach(b=>FB.write(`wh/bills/${b.id}`,b));
          SP.forEach(p=>FB.write(`wh/parents/${p.id}`,p));
        }
      });
    },1800);
    return()=>clearTimeout(t);
  },[ready]);

  /* Helpers */
  const kidById=id=>kids.find(k=>k.id===id);
  const parById=id=>parents.find(p=>p.id===id);
  const getComp=(dk,cId,aId)=>comps[dk]?.[`${cId}_${aId}`]||null;
  const isToday=selDate===ld();
  const isScheduled=(c,ds)=>{
    if(c.scheduleType==="daily")return true;
    if(c.scheduleType==="weekly")return(c.scheduleDays||[]).includes(DOW(ds));
    return true;
  };
  const getOverride=(c,ds)=>c.overrides?.[ds];

  const pendCount=useMemo(()=>{
    let n=0;
    chores.forEach(c=>{if(!c.requiresApproval)return;kids.forEach(k=>{if(getComp(ld(),c.id,k.id)?.status==="pending")n++;});});
    return n;
  },[chores,kids,comps]);

  const hasPIN=!!localStorage.getItem("wh_pin");
  const isAdmin=uid&&allowedUids[uid]?.role==="admin";

  /* Claimed pool chore for an actor */
  const myClaimedPool=(actorId)=>pool.find(p=>p.claimedBy===actorId);

  /* Earning-related tx types. weekEarned is NET (includes undos/corrections) so
     it matches what actually reached the balance — a gross sum overstates after
     a chore is unchecked or a completion is corrected. */
  const EARN_TYPES=new Set(["chore","pool","summer_bonus","bonus","chore_undo","correction"]);
  const weekEarned=(kidId,weekKey)=>
    txLog.filter(tx=>(tx.actorId===kidId||tx.kidId===kidId)&&EARN_TYPES.has(tx.type)&&wk(new Date(tx.ts).toLocaleDateString("en-CA"))===weekKey).reduce((a,tx)=>a+(tx.cents||0),0);

  /* Parent contributions in a period: chores + pool chores completed by a parent,
     plus manually-logged tasks. cents = value those tasks would have paid a kid
     (i.e. dollars saved). Derived from existing records so it auto-corrects on undo. */
  const parentContrib=(parentId,key,isWeek)=>{
    let cents=0,tasks=0;
    Object.entries(comps).forEach(([dk,entries])=>{
      const inP=isWeek?wk(dk)===key:mk(dk)===key;
      if(!inP)return;
      Object.values(entries||{}).forEach(cp=>{
        if(cp&&cp.isParentActor&&cp.actorId===parentId&&(cp.status==="done"||cp.status==="approved")){cents+=(cp.cents||0);tasks++;}
      });
    });
    pool.forEach(p=>{
      if(p.completedBy!==parentId||!p.completedAt)return;
      const dks=new Date(p.completedAt).toLocaleDateString("en-CA");
      if(isWeek?wk(dks)===key:mk(dks)===key){cents+=(p.priceCents||0);tasks++;}
    });
    Object.entries(parentLog).forEach(([dk,logs])=>{
      const inP=isWeek?wk(dk)===key:mk(dk)===key;
      if(!inP)return;
      Object.values(logs||{}).forEach(l=>{if(l&&l.parentId===parentId){tasks++;cents+=(l.cents||0);}});
    });
    return {cents,tasks};
  };

  /* Bill progress for current month */
  const billProgress=(kidId)=>{
    const mk2=mk(ld());
    return Object.values(billPay[kidId]||{}).filter(p=>p.monthKey===mk2).reduce((a,p)=>a+(p.amountCents||0),0);
  };

  /* ── Actions ── */
  const saveCfg=cfg=>{["wh_fbcfg","wh3_cfg"].forEach(k=>localStorage.setItem(k,JSON.stringify(cfg)));setFbCfg(cfg);setShowCfg(false);};
  const enterKid=id=>{setActiveKid(id);setActiveParent(null);setScreen("kid");setSelDate(ld());};
  const enterParent=()=>{setParentMode(true);setScreen("app");setView("dashboard");setActiveKid(null);setActiveParent(null);};
  const enterParentProfile=id=>{setActiveParent(id);setActiveKid(null);setScreen("kid");setSelDate(ld());};
  const exitToPicker=()=>{setScreen("picker");setParentMode(false);setActiveKid(null);setActiveParent(null);};
  const goPin=()=>setScreen(hasPIN?"pin-verify":"pin-set");

  async function completeChore(choreId,actorId,isParentActor=false,dateKey=null){
    const chore=chores.find(c=>c.id===choreId);
    const kid=isParentActor?null:kidById(actorId);
    if(!chore)return;
    /* Use the date being viewed so past-day completions persist correctly */
    const dk=dateKey||ld();
    const key=`${choreId}_${actorId}`;
    const existing=getComp(dk,choreId,actorId);
    setOptim(o=>({...o,[key]:true}));
    try{
      if(existing&&(existing.status==="done"||existing.status==="approved"||existing.status==="pending")){
        /* Uncheck — reverse money only if it was already paid out.
           done/approved were paid; pending was sent for approval but never paid. */
        const wasPaid=existing.status==="done"||existing.status==="approved";
        const cents=existing.cents||chore.priceCents||25;
        const upd={[`wh/comps/${dk}/${key}`]:null};
        if(wasPaid&&!isParentActor&&kid){
          upd[`wh/kids/${actorId}/balanceCents`]=Math.max(0,(kid.balanceCents||0)-cents);
          upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"chore_undo",cents:-cents,desc:`Unchecked: ${chore.title}`,ts:Date.now()};
        }
        await FB.atomic(upd);
        toast(`${chore.title} unchecked${wasPaid&&!isParentActor?` (-${c$(cents)})`:""}`, "warn");
      }else if(!existing||existing.status==="none"){
        const status=chore.requiresApproval?"pending":"done";
        const cents=chore.priceCents||25;
        const isPastDay=dk!==ld();
        const upd={[`wh/comps/${dk}/${key}`]:{status,ts:Date.now(),choreId,actorId,cents,isParentActor:!!isParentActor,date:dk}};
        if(status==="done"&&!isParentActor&&kid){
          upd[`wh/kids/${actorId}/balanceCents`]=(kid.balanceCents||0)+cents;
          upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"chore",cents,desc:chore.title+(isPastDay?` (${dk})`:""),ts:Date.now()};
        }
        await FB.atomic(upd);
        toast(status==="done"?(isParentActor?`✓ Logged: ${chore.title}`:`+${c$(cents)} for ${kid?.name}!${isPastDay?" (past day)":""}`):`${chore.title} sent for approval`,"success");
      }
    }catch(e){toast("Save failed — check connection","err");}
    finally{setOptim(o=>{const n={...o};delete n[key];return n;});}
  }

  async function approveComp(dk,choreId,actorId){
    const chore=chores.find(c=>c.id===choreId);
    const kid=kidById(actorId);
    const comp=getComp(dk,choreId,actorId);
    if(!chore||!kid||!comp)return;
    const cents=comp.cents||chore.priceCents||25;
    await FB.atomic({
      [`wh/comps/${dk}/${choreId}_${actorId}/status`]:"approved",
      [`wh/comps/${dk}/${choreId}_${actorId}/approvedAt`]:Date.now(),
      [`wh/kids/${actorId}/balanceCents`]:(kid.balanceCents||0)+cents,
      [`wh/txlog/${tkid(actorId)}`]:{actorId,type:"chore",cents,desc:chore.title+" (approved)",ts:Date.now()},
    });
    toast(`Approved +${c$(cents)} for ${kid.name}`,"success");
  }

  async function rejectComp(dk,choreId,actorId){
    await FB.atomic({[`wh/comps/${dk}/${choreId}_${actorId}`]:null});
    toast("Chore rejected","warn");
  }

  async function editComp(dk,choreId,actorId,{newCents,remove,note}){
    const comp=getComp(dk,choreId,actorId);
    const kid=kidById(actorId);
    if(!comp||!kid)return;
    const origCents=comp.cents||0;
    if(remove){
      await FB.atomic({
        [`wh/comps/${dk}/${choreId}_${actorId}`]:null,
        [`wh/kids/${actorId}/balanceCents`]:Math.max(0,(kid.balanceCents||0)-origCents),
        [`wh/txlog/${tkid(actorId)}`]:{actorId,type:"correction",cents:-origCents,desc:`Removed: ${comp.choreId||"chore"}${note?` — ${note}`:""}`,ts:Date.now()},
      });
      toast("Completion removed","warn");
    }else{
      const diff=newCents-origCents;
      await FB.atomic({
        [`wh/comps/${dk}/${choreId}_${actorId}/cents`]:newCents,
        [`wh/comps/${dk}/${choreId}_${actorId}/editNote`]:note||"",
        [`wh/comps/${dk}/${choreId}_${actorId}/editedAt`]:Date.now(),
        [`wh/kids/${actorId}/balanceCents`]:(kid.balanceCents||0)+diff,
        [`wh/txlog/${tkid(actorId)}`]:{actorId,type:"correction",cents:diff,desc:`Adjusted: ${comp.choreId||"chore"}${note?` — ${note}`:""}`,ts:Date.now()},
      });
      toast("Completion updated","success");
    }
    setEditCompModal(null);
  }

  async function claimPool(choreId,actorId){
    if(myClaimedPool(actorId)){toast("Finish your current chore first!","warn");return;}
    const chore=pool.find(p=>p.id===choreId);
    if(chore&&!isPoolDue(chore)){toast(`Not due yet — ${dueLabel(chore)}.`,"warn");return;}
    await FB.atomic({[`wh/pool/${choreId}/claimedBy`]:actorId,[`wh/pool/${choreId}/claimedAt`]:Date.now()});
    toast("Chore claimed — go do it!","info");
  }

  async function completePool(choreId,actorId,isParentActor=false){
    const chore=pool.find(p=>p.id===choreId);
    if(!chore)return;
    if(!isPoolDue(chore)){toast("That one isn't due yet.","warn");return;}
    const kid=isParentActor?null:kidById(actorId);
    const cents=chore.priceCents||25;
    const now=Date.now();
    const upd={
      [`wh/pool/${choreId}/claimedBy`]:null,
      [`wh/pool/${choreId}/claimedAt`]:null,
      [`wh/pool/${choreId}/completedBy`]:actorId,
      [`wh/pool/${choreId}/completedAt`]:now,
    };
    if(chore.recurring){
      // Stay done until the interval elapses, then reappear automatically.
      upd[`wh/pool/${choreId}/lastCompletedAt`]=now;
    }else if(chore.repeating){
      // Legacy repeating: available again immediately.
      upd[`wh/pool/${choreId}/completedBy`]=null;
      upd[`wh/pool/${choreId}/completedAt`]=null;
    }
    if(!isParentActor&&kid){
      upd[`wh/kids/${actorId}/balanceCents`]=(kid.balanceCents||0)+cents;
      upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"pool",cents,desc:`Pool: ${chore.title}`,ts:now};
    }
    await FB.atomic(upd);
    toast(isParentActor?`✓ Pool chore done: ${chore.title}`:`+${c$(cents)} — pool chore complete!`,"success");
  }

  async function logParentTask(parentId,desc){
    const dk=ld();
    const id=`${Date.now()}_${uid6()}`;
    await FB.write(`wh/parentLog/${dk}/${id}`,{parentId,desc,ts:Date.now()});
    toast("Task logged ✓","success");
  }

  async function saveChore(data,oneTimeDate=null){
    const id=data.id||`c${Date.now()}`;
    if(oneTimeDate){
      await FB.atomic({[`wh/chores/${id}/overrides/${oneTimeDate}`]:{assignedTo:data.assignedTo,note:"one-time override"}});
    }else{
      await FB.write(`wh/chores/${id}`,{...data,id});
    }
    toast(data.id?"Chore updated ✓":"Chore added ✓","success");
  }

  async function deleteChore(id){await FB.del(`wh/chores/${id}`);toast("Chore deleted","warn");}

  async function addPoolChore(data){
    const id=`pc${Date.now()}`;
    await FB.write(`wh/pool/${id}`,{...data,id,claimedBy:null,claimedAt:null,completedBy:null});
    toast("Pool chore added","success");
  }

  async function removePoolChore(id){await FB.del(`wh/pool/${id}`);toast("Pool chore removed","warn");}

  async function seedCleaningPool(){
    const existing=new Set(pool.map(p=>p.id));
    const upd={};let n=0;
    CLEAN_SEED.forEach(c=>{
      if(existing.has(c.id))return;
      upd[`wh/pool/${c.id}`]={...c,claimedBy:null,claimedAt:null,completedBy:null,completedAt:null,lastCompletedAt:null};
      n++;
    });
    if(!n){toast("Cleaning chores already added","info");return;}
    await FB.atomic(upd);
    toast(`Added ${n} cleaning chores ✓`,"success");
  }

  async function updatePoolChore(id,patch){
    const upd={};
    Object.entries(patch).forEach(([k,v])=>{upd[`wh/pool/${id}/${k}`]=v;});
    if(patch.freq&&!("intervalDays"in patch))upd[`wh/pool/${id}/intervalDays`]=INTERVAL_DAYS[patch.freq]||7;
    await FB.atomic(upd);
    toast("Pool chore updated ✓","success");
  }

  async function payBill(billId,kidId,amountCents){
    const kid=kidById(kidId);
    if(!kid||(kid.balanceCents||0)<amountCents){toast("Insufficient balance","warn");return;}
    const id=`bp_${Date.now()}_${uid6()}`;
    const monthKey2=mk(ld());
    await FB.atomic({
      [`wh/kids/${kidId}/balanceCents`]:(kid.balanceCents||0)-amountCents,
      [`wh/billPayments/${kidId}/${id}`]:{billId,amountCents,monthKey:monthKey2,date:ld(),ts:Date.now()},
      [`wh/txlog/${tkid(kidId)}`]:{actorId:kidId,type:"bill",cents:-amountCents,desc:`Bill payment`,ts:Date.now()},
    });
    toast(`Payment of ${c$(amountCents)} recorded ✓`,"success");
  }

  async function triggerSummerBonus(kidId){
    const kid=kidById(kidId);
    if(!kid)return;
    const weekK=wk(ld());
    const sk=sumKids[kidId]||{};
    if(sk.weekBonusPaidFor===weekK){toast("Bonus already paid for this week","warn");return;}
    const sessions=Object.values(sumSessions[kidId]||{}).filter(s=>wk(s.date)===weekK);
    if(sessions.length<4){toast(`Only ${sessions.length}/4 sessions this week — bonus not earned`,"warn");return;}
    const bonus=100; // $1.00
    await FB.atomic({
      [`wh/kids/${kidId}/balanceCents`]:(kid.balanceCents||0)+bonus,
      [`wh/summerProgram/kids/${kidId}/weekBonusPaidFor`]:weekK,
      [`wh/txlog/${tkid(kidId)}`]:{actorId:kidId,type:"summer_bonus",cents:bonus,desc:`Summer weekly bonus — week ${weekK}`,ts:Date.now()},
    });
    toast(`+${c$(bonus)} summer bonus for ${kid.name}! 🎉`,"success");
  }

  async function completeSummerSession(kidId,kidName){
    const today=ld();
    const dow=new Date().toLocaleDateString("en-US",{weekday:"long"});
    const focus=SFOCUS[dow];
    if(!focus)return;
    const sessId=`${today}_${uid6()}`;
    await FB.write(`wh/summerSessions/${kidId}/${sessId}`,{date:today,focus,completedAt:Date.now()});
    toast(`Summer session logged — ${focus}!`,"success");
  }

  async function backfillSessions(kidId,kidName,count=4){
    /* Credit past sessions — writes them with dates for Mon–Thu of current week */
    const today2=new Date();
    const dayOfWeek=today2.getDay(); // 0=Sun,1=Mon...
    const upd={};
    const daysBack=[3,2,1,0]; // Thu,Wed,Tue,Mon relative offsets from Thu
    let credited=0;
    for(let i=0;i<7&&credited<count;i++){
      const d=new Date(today2);
      d.setDate(d.getDate()-i);
      const dow=d.getDay();
      if(![1,2,3,4].includes(dow))continue; // Mon–Thu only
      const ds=d.toLocaleDateString("en-CA");
      const focus=["","math","literacy","math","literacy"][dow];
      const sessId=`${ds}_backfill_${uid6()}`;
      // Only add if not already done
      const existing=Object.values(sumSessions[kidId]||{}).find(s=>s.date===ds);
      if(!existing){
        upd[`wh/summerSessions/${kidId}/${sessId}`]={date:ds,focus,completedAt:Date.now(),backfilled:true};
        credited++;
      }
    }
    if(Object.keys(upd).length>0){
      await FB.atomic(upd);
      toast(`${credited} session${credited!==1?"s":""} credited for ${kidName} ✓`,"success");
    }else{
      toast("Sessions already logged for this week","info");
    }
  }

  async function giveBonus(kidId,kidName,amountCents,note){
    const kid=kidById(kidId);if(!kid)return;
    const upd={};
    upd[`wh/kids/${kidId}/balanceCents`]=(kid.balanceCents||0)+amountCents;
    upd[`wh/txlog/${tkid(kidId)}`]={actorId:kidId,type:"bonus",cents:amountCents,desc:`Bonus: ${note||"Great attitude!"}`,ts:Date.now()};
    await FB.atomic(upd);
    toast(`+${c$(amountCents)} bonus for ${kidName}! 🌟`,"success");
  }

  async function saveNote(kidId,note){
    await FB.atomic({[`wh/kids/${kidId}/latestNote`]:note});
    toast("Note saved ✓","success");
  }

  async function awardXp(kidId,amt){
    const kid=kidById(kidId);if(!kid)return;
    await FB.atomic({[`wh/kids/${kidId}/balanceCents`]:(kid.balanceCents||0)+amt,[`wh/txlog/${tkid(kidId)}`]:{actorId:kidId,type:"bonus",cents:amt,desc:"Focus timer bonus",ts:Date.now()}});
    toast(`+${c$(amt)} for ${kid.name}`,"success");
  }

  /* ════════ VIEWS ════════════════════════════════════════════ */

  function ChoresView({actorId,isParent=false,isParentActor=false}){
    const filtered=chores.filter(c=>{
      const override=getOverride(c,selDate);
      const assigned=override?.assignedTo||(c.assignedTo||[]);
      if(actorId&&!assigned.includes(actorId))return false;
      return isScheduled(c,selDate);
    });
    const dateLabel=isToday?"Today":lp(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
    return(
      <div>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
          <button className="btn bg bsm" onClick={()=>{const d=lp(selDate);d.setDate(d.getDate()-1);setSelDate(d.toLocaleDateString("en-CA"));}}>‹</button>
          <span style={{flex:1,textAlign:"center",fontSize:14,fontWeight:700}}>{dateLabel}</span>
          <button className="btn bg bsm" disabled={isToday} onClick={()=>{const d=lp(selDate);d.setDate(d.getDate()+1);const s=d.toLocaleDateString("en-CA");if(s<=ld())setSelDate(s);}}>›</button>
        </div>
        {isParent&&pendCount>0&&(
          <div className="card" style={{marginBottom:12,borderColor:"#FCD34D"}}>
            <div className="ch">⏳ Pending approval</div>
            {chores.filter(c=>c.requiresApproval).flatMap(c=>kids.map(k=>{
              const comp=getComp(ld(),c.id,k.id);
              if(comp?.status!=="pending")return null;
              return(<div key={k.id+c.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid var(--bdr)"}}>
                <span style={{flex:1,fontSize:13}}><strong>{k.name}</strong> — {c.title}</span>
                <button className="btn bte bxs" onClick={()=>approveComp(ld(),c.id,k.id)}>✓</button>
                <button className="btn bco bxs" onClick={()=>rejectComp(ld(),c.id,k.id)}>✗</button>
              </div>);
            }).filter(Boolean))}
          </div>
        )}
        {filtered.length===0?(<div className="empty"><div style={{fontSize:28,marginBottom:6}}>🎉</div><div style={{fontWeight:700}}>Nothing scheduled</div></div>):(
          filtered.map(c=>{
            const override=getOverride(c,selDate);
            const assigned=override?.assignedTo||(c.assignedTo||[]);
            const actors=actorId?[actorId]:assigned;
            return actors.map(aId=>{
              const actor=kidById(aId)||parById(aId);
              if(!actor)return null;
              const key=`${c.id}_${aId}`;
              const comp=getComp(selDate,c.id,aId); /* reads from viewed date */
              const isOpt=optim[key];
              const status=comp?.status||"none";
              const isDone=status==="done"||status==="approved";
              const pal=PAL[(actor.colorIdx||0)%PAL.length];
              const canTap=!isDone||status==="done";
              return(
                <div key={key} className={`ccard${isDone?" done":status==="pending"?" pend":isOpt?" opt":""}`}
                  onClick={()=>canTap&&completeChore(c.id,aId,isParentActor||!!parById(aId),selDate)}>
                  <div className={`cchk${isDone?" done":status==="pending"?" pend":isOpt?" opt":""}`}>
                    {isDone&&<span style={{color:"#fff",fontWeight:900,fontSize:12}}>✓</span>}
                    {status==="pending"&&<span style={{fontSize:10}}>⏳</span>}
                    {isOpt&&!isDone&&<span style={{color:"var(--pr)",fontSize:10}}>…</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div className="ctitle" style={{textDecoration:isDone?"line-through":""}}>{c.title}</div>
                    {!actorId&&<div style={{fontSize:11,color:pal.a,marginTop:1}}>{actor.name}</div>}
                  </div>
                  <span className={`cdiff d${c.diff?.[0]||"e"}`}>{c.diff||"easy"}</span>
                  {!parById(aId)&&<span className="cprice">{c$(c.priceCents||25)}</span>}
                  <div style={{display:"flex",gap:4,flexShrink:0}} onClick={e=>e.stopPropagation()}>
                    {isParent&&(
                      <button className="btn bg bxs" onClick={()=>setChoreModal({mode:"edit",data:{...c}})}>✏️</button>
                    )}
                    {isParent&&isDone&&(
                      <button className="btn bam bxs" onClick={()=>setEditCompModal({dk:selDate,choreId:c.id,actorId:aId,comp})}>📝</button>
                    )}
                  </div>
                </div>
              );
            });
          })
        )}
      </div>
    );
  }

  function PoolView({actorId,isParentActor=false,showManage=false}){
    const myClaimed=myClaimedPool(actorId);
    const available=pool.filter(p=>!p.claimedBy&&isPoolDue(p));
    const resting=pool.filter(p=>!p.claimedBy&&p.recurring&&!isPoolDue(p));
    const done=pool.filter(p=>p.completedBy===actorId&&p.completedAt&&new Date(p.completedAt).toLocaleDateString("en-CA")===ld());
    const FreqPill=({c})=>c&&c.freq?<span className="cdiff" style={{background:"#EEF2FF",color:"#4338CA"}}>{FREQ_LBL[c.freq]||c.freq}</span>:<span className={`cdiff d${c.diff?.[0]||"e"}`}>{c.diff||"easy"}</span>;
    return(
      <div>
        {myClaimed&&(
          <div className="card" style={{marginBottom:12,borderColor:"#A5F3FC",background:"var(--bll)"}}>
            <div className="ch" style={{color:"var(--bl)"}}>🔵 Your claimed chore</div>
            <div className="ccard" style={{background:"#fff",marginBottom:0}}
              onClick={()=>completePool(myClaimed.id,actorId,isParentActor)}>
              <div className="cchk"><span style={{fontSize:10}}>⚡</span></div>
              <div style={{flex:1}}>
                <div className="ctitle">{myClaimed.title}</div>
                <div style={{fontSize:11,color:"var(--tx2)"}}>Tap when done</div>
              </div>
              <span className="cprice">{!isParentActor?c$(myClaimed.priceCents||25):"log only"}</span>
            </div>
          </div>
        )}
        <div className="card" style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div className="ch" style={{marginBottom:0}}>🎯 Available to grab</div>
            {showManage&&<div style={{display:"flex",gap:6}}>
              <button className="btn bg bsm" onClick={()=>seedCleaningPool()}>🧹 Add cleaning set</button>
              <button className="btn bbl bsm" onClick={()=>setPoolAddModal(true)}>+ Add</button>
            </div>}
          </div>
          {available.length===0?<div style={{color:"var(--tx3)",fontSize:13}}>No pool chores due right now.</div>:(
            available.map(p=>(
              <div key={p.id} className="ccard">
                <div className="cchk"/>
                <div style={{flex:1}}>
                  <div className="ctitle">{p.title}</div>
                  {(p.area||p.note)&&<div style={{fontSize:11,color:"var(--tx2)"}}>{p.area?p.area:""}{p.area&&p.note?" · ":""}{p.note||""}</div>}
                </div>
                <FreqPill c={p}/>
                <span className="cprice">{c$(p.priceCents||25)}</span>
                <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}>
                  {actorId&&!myClaimed&&<button className="btn bbl bsm" onClick={()=>claimPool(p.id,actorId)}>Claim</button>}
                  {showManage&&<button className="btn bg bxs" onClick={()=>setPoolEditModal(p)}>✏️</button>}
                  {showManage&&<button className="btn bco bxs" onClick={()=>removePoolChore(p.id)}>🗑</button>}
                </div>
              </div>
            ))
          )}
        </div>
        {resting.length>0&&(
          <div className="card" style={{marginBottom:12}}>
            <div className="ch">😴 Scheduled (resting)</div>
            {resting.map(p=>(
              <div key={p.id} className="ccard">
                <div className="cchk"/>
                <div style={{flex:1}}>
                  <div className="ctitle">{p.title}</div>
                  <div style={{fontSize:11,color:"var(--tx2)"}}>{p.area?p.area+" · ":""}{dueLabel(p)}</div>
                </div>
                <FreqPill c={p}/>
                <span className="cprice">{c$(p.priceCents||25)}</span>
                {showManage&&<div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}>
                  <button className="btn bg bxs" onClick={()=>setPoolEditModal(p)}>✏️</button>
                  <button className="btn bco bxs" onClick={()=>removePoolChore(p.id)}>🗑</button>
                </div>}
              </div>
            ))}
          </div>
        )}
        {done.length>0&&(
          <div className="card">
            <div className="ch">✅ Completed today</div>
            {done.map(p=><div key={p.id} className="ccard done">
              <div className="cchk done"><span style={{color:"#fff",fontWeight:900,fontSize:12}}>✓</span></div>
              <div className="ctitle">{p.title}</div>
              <span className="cprice">{c$(p.priceCents||25)}</span>
            </div>)}
          </div>
        )}
      </div>
    );
  }

  function DashboardView(){
    const curWk=wk(ld());
    return(
      <div>
        {pendCount>0&&parentMode&&(
          <div style={{background:"var(--aml)",border:"1px solid #FCD34D",borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",fontSize:13}}>
            <span style={{fontWeight:700,color:"var(--am)"}}>⏳ {pendCount} chore{pendCount!==1?"s":""} awaiting approval</span>
            <button className="btn bg bsm" onClick={()=>setView("chores")}>Review →</button>
          </div>
        )}
        <div className="dgrid">
          {kids.map(k=>{
            const pal=PAL[k.colorIdx%PAL.length];
            const bal=k.balanceCents||0;
            const goal=k.goal?.weeklyTargetCents||300;
            const earned=weekEarned(k.id,curWk);
            const gpct=Math.min(100,Math.round((earned/goal)*100));
            const sk=sumKids[k.id];
            const kidBills=bills.filter(b=>b.kidId===k.id&&b.active);
            const bal2=k.balanceCents||0;
            const totalBills=kidBills.reduce((a,b)=>a+(b.amountCents||0),0);
            const monthPaid=bal2; // show current balance vs total bills due
            return(
              <div key={k.id} className="kcard" style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:14,padding:16,cursor:"pointer",transition:"box-shadow .15s"}}
                onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 12px rgba(0,0,0,.08)"}
                onMouseLeave={e=>e.currentTarget.style.boxShadow=""}
                onClick={()=>enterKid(k.id)}
                onContextMenu={e=>{e.preventDefault();if(parentMode)setBonusModal({kidId:k.id,kidName:k.name});}}>
                <div style={{display:"flex",alignItems:"center",gap:11,marginBottom:11}}>
                  <Av initials={k.initials} colorIdx={k.colorIdx} size={42}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:800}}>{k.name}</div>
                    <div style={{fontSize:11,color:"var(--tx2)"}}>Age {k.age}</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:17,fontWeight:900,color:"var(--gr)"}}>{c$(bal)}</div>
                    <div style={{fontSize:10,color:"var(--tx3)"}}>balance</div>
                  </div>
                </div>
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--tx2)",marginBottom:3}}>
                    <span>Weekly {c$(earned)} / {c$(goal)}</span>
                    <span style={{color:gpct>=100?"var(--gr)":"var(--tx2)",fontWeight:gpct>=100?800:400}}>{gpct}%{gpct>=100?" 🎯":""}</span>
                  </div>
                  <div className="pbar"><div className="pbar-f" style={{width:`${gpct}%`,background:gpct>=100?"var(--gr)":pal.a}}/></div>
                </div>
                {totalBills>0&&(
                  <div style={{marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"var(--tx2)",marginBottom:3}}>
                      <span>Saved {c$(monthPaid)} / {c$(totalBills)} due Jul 1</span>
                      <span style={{color:monthPaid>=totalBills?"var(--gr)":"var(--am)",fontWeight:700}}>{Math.round((monthPaid/totalBills)*100)}%</span>
                    </div>
                    <div className="pbar"><div className="pbar-f" style={{width:`${Math.min(100,Math.round((monthPaid/totalBills)*100))}%`,background:monthPaid>=totalBills?"var(--gr)":"var(--am)"}}/></div>
                  </div>
                )}
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {sk&&(sk.totalSessionsCompleted||0)>0&&<span className="chip">☀️ {sk.totalSessionsCompleted} sessions</span>}
                  {parentMode&&<button className="btn bte bxs" style={{marginLeft:"auto"}} onClick={e=>{e.stopPropagation();setBonusModal({kidId:k.id,kidName:k.name});}}>🌟</button>}
                  {parentMode&&<button className="btn bbl bxs" onClick={e=>{e.stopPropagation();setNoteModal({kidId:k.id,kidName:k.name});}}>📝</button>}
                </div>
                {k.latestNote&&<div style={{fontSize:11,color:"var(--pr)",fontStyle:"italic",marginTop:6,padding:"5px 8px",background:"var(--prl)",borderRadius:6}}>📝 {k.latestNote}</div>}
              </div>
            );
          })}
        </div>
        {/* Parent contributions */}
        <div style={{marginTop:14}}>
          <div className="card">
            <div className="ch" style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>👨‍👩‍👧‍👦 Parent contributions this week</span>
              {parentMode&&<span style={{color:"var(--gr)",fontWeight:800}}>{c$(parents.reduce((a,p)=>a+parentContrib(p.id,curWk,true).cents,0))} saved</span>}
            </div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              {parents.map(p=>{
                const {cents,tasks}=parentContrib(p.id,curWk,true);
                return(
                  <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,flex:1,minWidth:160}}>
                    <Av initials={p.initials} colorIdx={p.colorIdx} size={32}/>
                    <div>
                      <div style={{fontSize:13,fontWeight:700}}>{p.name}</div>
                      <div style={{fontSize:12,color:"var(--tx2)"}}>{tasks} task{tasks!==1?"s":""} this week{parentMode&&cents>0?` · ${c$(cents)} saved`:""}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function SummaryView(){
    const[period,setPeriod]=useState("week");
    const[selWk,setSelWk]=useState(wk(ld()));
    const[selMk,setSelMk]=useState(mk(ld()));
    const allWks=Array.from(new Set(txLog.map(tx=>wk(new Date(tx.ts).toLocaleDateString("en-CA"))))).sort().reverse();
    const allMks=Array.from(new Set(txLog.map(tx=>mk(new Date(tx.ts).toLocaleDateString("en-CA"))))).sort().reverse();
    const filterTx=tx=>{
      const txDate=new Date(tx.ts).toLocaleDateString("en-CA");
      return period==="week"?wk(txDate)===selWk:mk(txDate)===selMk;
    };
    const periodTx=txLog.filter(filterTx);
    return(
      <div>
        <div style={{display:"flex",gap:6,marginBottom:14,alignItems:"center",flexWrap:"wrap"}} className="no-print">
          <button className={`btn bsm ${period==="week"?"bp":"bg"}`} onClick={()=>setPeriod("week")}>Week</button>
          <button className={`btn bsm ${period==="month"?"bp":"bg"}`} onClick={()=>setPeriod("month")}>Month</button>
          {period==="week"&&<select className="fi" style={{width:"auto",padding:"5px 10px",fontSize:12}} value={selWk} onChange={e=>setSelWk(e.target.value)}>
            {allWks.length?allWks.map(w=><option key={w} value={w}>{w}</option>):<option value={selWk}>{selWk}</option>}
          </select>}
          {period==="month"&&<select className="fi" style={{width:"auto",padding:"5px 10px",fontSize:12}} value={selMk} onChange={e=>setSelMk(e.target.value)}>
            {allMks.length?allMks.map(m=><option key={m} value={m}>{m}</option>):<option value={selMk}>{selMk}</option>}
          </select>}
          <button className="btn bg bsm" onClick={()=>window.print()}>🖨️</button>
        </div>
        <div className="dgrid" style={{marginBottom:14}}>
          {kids.map(k=>{
            const kTx=periodTx.filter(tx=>tx.actorId===k.id&&EARN_TYPES.has(tx.type));
            const gross=kTx.filter(tx=>tx.cents>0).reduce((a,tx)=>a+(tx.cents||0),0);
            const adj=kTx.filter(tx=>tx.cents<0).reduce((a,tx)=>a+(tx.cents||0),0);
            const total=gross+adj;
            const pal=PAL[k.colorIdx%PAL.length];
            return(
              <div key={k.id} style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"10px 14px",background:pal.l,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <Av initials={k.initials} colorIdx={k.colorIdx} size={28}/>
                    <strong style={{color:pal.t}}>{k.name}</strong>
                  </div>
                  <span style={{fontSize:16,fontWeight:900,color:pal.a}}>{c$(total)}</span>
                </div>
                <div style={{padding:"8px 14px"}}>
                  {adj<0&&<div style={{fontSize:11,color:"var(--tx2)",marginBottom:6}}>Earned {c$(gross)} · adjustments {c$(adj)} · <strong>net {c$(total)}</strong></div>}
                  {kTx.length===0?<div style={{fontSize:12,color:"var(--tx3)"}}>No earnings this period.</div>:(
                    kTx.slice(0,8).map((tx,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"4px 0",borderBottom:"1px solid var(--bdr)"}}>
                        <span style={{color:"var(--tx2)"}}>{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                        <span style={{flex:1,marginLeft:8,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.desc}</span>
                        <span style={{color:tx.cents<0?"#DC2626":"var(--gr)",fontWeight:700,marginLeft:8}}>{c$(tx.cents)}</span>
                        {parentMode&&<button className="btn bam bxs" style={{marginLeft:6}} onClick={()=>{const dk=new Date(tx.ts).toLocaleDateString("en-CA");setEditCompModal({dk,choreId:tx.desc,actorId:tx.actorId,comp:{cents:tx.cents},fromTx:tx});}}>✏️</button>}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Parent log summary */}
        <div className="card">
          <div className="ch">Parent tasks</div>
          {parents.map(p=>{
            const {cents:pSaved,tasks:pCount}=parentContrib(p.id,period==="week"?selWk:selMk,period==="week");
            const pTasks=Object.entries(parentLog).filter(([d])=>period==="week"?wk(d)===selWk:mk(d)===selMk).flatMap(([,logs])=>Object.values(logs||{}).filter(l=>l.parentId===p.id));
            return(<div key={p.id} style={{marginBottom:10}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{p.name} — {pCount} task{pCount!==1?"s":""}{parentMode?` · ${c$(pSaved)} saved`:""}</div>
              {pTasks.slice(0,5).map((t,i)=>(
                <div key={i} style={{display:"flex",gap:8,fontSize:12,color:"var(--tx2)",padding:"3px 0"}}>
                  <span>{new Date(t.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  <span>{t.desc}</span>
                </div>
              ))}
            </div>);
          })}
        </div>
      </div>
    );
  }

  function BillsView({kidId=null}){
    const filteredBills=bills.filter(b=>kidId?b.kidId===kidId:true);
    return(
      <div>
        {parentMode&&!kidId&&<div style={{marginBottom:12}}><button className="btn bp bsm" onClick={()=>setBillModal({})}>+ Add Bill</button></div>}
        <div className="rgrid">
          {filteredBills.map(bill=>{
            const kid=kidById(bill.kidId);
            if(!kid)return null;
            const bal=kid.balanceCents||0;
            const needed=bill.amountCents;
            /* Progress = current balance toward the bill amount */
            const savPct=Math.min(100,Math.round((bal/needed)*100));
            /* Days until July 1 */
            const dueDate=new Date("2026-07-01T00:00:00");
            const today2=new Date();
            const daysLeft=Math.max(0,Math.ceil((dueDate-today2)/(1000*60*60*24)));
            /* Earning pace: avg daily from this week × days left */
            const curWkEarned=weekEarned(bill.kidId,wk(ld()));
            const dailyRate=curWkEarned/7;
            const projectedTotal=bal+(dailyRate*daysLeft);
            const onPace=projectedTotal>=needed;
            const pal=PAL[kid.colorIdx%PAL.length];
            const monthK=mk(ld());
            const paid=Object.values(billPay[bill.kidId]||{}).filter(p=>p.billId===bill.id&&p.monthKey===monthK).reduce((a,p)=>a+(p.amountCents||0),0);
            return(
              <div key={bill.id} style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderLeft:`4px solid ${pal.a}`,borderRadius:12,overflow:"hidden"}}>
                <div style={{padding:"11px 14px",borderBottom:"1px solid var(--bdr)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800}}>{bill.name}</div>
                    <div style={{fontSize:11,color:"var(--tx2)"}}>{!kidId&&kid.name+" · "}{daysLeft} days until July 1</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:15,fontWeight:900,color:"var(--re)"}}>{c$(needed)} due</div>
                    <span className={`pill ${onPace?"pill-gr":"pill-am"}`}>{onPace?"On pace":"Behind"}</span>
                  </div>
                </div>
                <div style={{padding:"10px 14px"}}>
                  {/* Balance saved toward bill */}
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--tx2)",marginBottom:4}}>
                    <span>Balance saved</span>
                    <span style={{fontWeight:800,color:savPct>=100?"var(--gr)":"var(--tx)"}}>{c$(bal)} / {c$(needed)} ({savPct}%)</span>
                  </div>
                  <div className="pbar" style={{marginBottom:8}}>
                    <div className="pbar-f" style={{width:`${savPct}%`,background:savPct>=100?"var(--gr)":pal.a}}/>
                  </div>
                  {/* Projected total by due date */}
                  <div style={{fontSize:11,color:"var(--tx3)",marginBottom:8}}>
                    At current pace → projected {c$(Math.round(projectedTotal))} by July 1
                    {!onPace&&<span style={{color:"var(--re)",fontWeight:700}}> (short {c$(Math.max(0,needed-Math.round(projectedTotal)))})</span>}
                  </div>
                  {/* Manual payments made this month */}
                  {paid>0&&<div style={{fontSize:11,color:"var(--tx2)",marginBottom:8}}>Applied this month: <strong style={{color:"var(--gr)"}}>{c$(paid)}</strong></div>}
                  <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                    <button className="btn bte bsm" onClick={()=>setPayBillModal({bill,kidId:bill.kidId})}>Pay bill</button>
                    {parentMode&&<button className="btn bg bsm" onClick={()=>setBillModal(bill)}>Edit</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filteredBills.length===0&&<div className="empty"><div style={{fontSize:28,marginBottom:6}}>💸</div><div>No bills set up yet.</div></div>}
      </div>
    );
  }

  function StoreView({kidId=null}){
    const kid=kidId?kidById(kidId):activeKid?kidById(activeKid):null;
    const bal=kid?.balanceCents||0;
    const items=[...STORE_DEF,...storeItems];
    return(
      <div>
        {kid&&<div style={{fontSize:14,fontWeight:800,color:"var(--am)",marginBottom:12}}>💰 {kid.name}: {c$(bal)}</div>}
        {!kid&&<div className="card" style={{marginBottom:12,fontSize:13,color:"var(--tx2)"}}>👆 Select a kid to make purchases.</div>}
        <div className="sgrid">
          {items.map(item=>{
            const can=kid&&bal>=item.priceCents;
            const cant=kid&&bal<item.priceCents;
            return(<div key={item.id} className={`sitem${can?" afford":cant?" no-afford":""}`}
              style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:10,padding:14,textAlign:"center",cursor:can?"pointer":"default",transition:"all .15s"}}
              onClick={async()=>{
                if(!can)return;
                const id=tkid(kidId||activeKid);
                await FB.atomic({[`wh/kids/${kid.id}/balanceCents`]:bal-item.priceCents,[`wh/txlog/${id}`]:{actorId:kid.id,type:"purchase",cents:-item.priceCents,desc:item.name,ts:Date.now()}});
                toast(`Purchased: ${item.name}! 🎉`,"success");
              }}>
              <div style={{fontSize:28,marginBottom:6}}>{item.emoji}</div>
              <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>{item.name}</div>
              <div style={{fontSize:12,fontWeight:800,color:"var(--am)"}}>{c$(item.priceCents)}</div>
              {kid&&<div style={{fontSize:10,marginTop:4,color:can?"var(--gr)":"var(--re)",fontWeight:700}}>{can?"✓ Can afford":"Need more"}</div>}
            </div>);
          })}
        </div>
      </div>
    );
  }

  function MoneyView({kidId=null}){
    return(
      <div>
        <div className="dgrid" style={{marginBottom:14}}>
          {kids.filter(k=>!kidId||k.id===kidId).map(k=>{
            const pal=PAL[k.colorIdx%PAL.length];
            const bal=k.balanceCents||0;
            const kidBills=bills.filter(b=>b.kidId===k.id&&b.active);
            const totalBillsCents=kidBills.reduce((a,b)=>a+(b.amountCents||0),0);
            /* How much of balance goes toward bill vs is free to spend */
            const towardBill=Math.min(bal,totalBillsCents);
            const billPct=totalBillsCents>0?Math.min(100,Math.round((bal/totalBillsCents)*100)):0;
            const remainder=Math.max(0,bal-totalBillsCents);
            const dueDate=new Date("2026-07-01T00:00:00");
            const daysLeft=Math.max(0,Math.ceil((dueDate-new Date())/(1000*60*60*24)));
            return(<div key={k.id} className="card">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <Av initials={k.initials} colorIdx={k.colorIdx} size={34}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
                  <div style={{fontSize:17,fontWeight:900,color:"var(--am)"}}>{c$(bal)}</div>
                </div>
                {totalBillsCents>0&&<div style={{textAlign:"right"}}>
                  <div style={{fontSize:11,color:"var(--tx3)"}}>{daysLeft}d until Jul 1</div>
                </div>}
              </div>
              {totalBillsCents>0&&(
                <div style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--tx2)",marginBottom:4}}>
                    <span>Bill savings progress</span>
                    <span style={{fontWeight:800,color:billPct>=100?"var(--gr)":pal.a}}>{c$(towardBill)} / {c$(totalBillsCents)} ({billPct}%)</span>
                  </div>
                  <div className="pbar">
                    <div className="pbar-f" style={{width:`${billPct}%`,background:billPct>=100?"var(--gr)":pal.a}}/>
                  </div>
                  {remainder>0&&<div style={{fontSize:11,color:"var(--tx3)",marginTop:4}}>
                    {c$(remainder)} available after bill
                  </div>}
                  {billPct>=100&&<div style={{fontSize:11,color:"var(--gr)",fontWeight:700,marginTop:4}}>
                    🎉 Bill covered! {c$(remainder)} extra saved.
                  </div>}
                </div>
              )}
              {/* Bill breakdown if multiple bills */}
              {kidBills.length>1&&kidBills.map(bill=>{
                const bPct=Math.min(100,Math.round((bal/bill.amountCents)*100));
                return(<div key={bill.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,fontSize:12}}>
                  <span style={{flex:1,color:"var(--tx2)"}}>{bill.name}</span>
                  <div className="pbar" style={{flex:2}}><div className="pbar-f" style={{width:`${bPct}%`,background:bPct>=100?"var(--gr)":pal.a}}/></div>
                  <span style={{width:68,textAlign:"right",fontWeight:700,color:bPct>=100?"var(--gr)":"var(--tx)"}}>{c$(bill.amountCents)}</span>
                </div>);
              })}
            </div>);
          })}
        </div>
        <div className="card">
          <div className="ch">Recent transactions</div>
          {txLog.filter(tx=>!kidId||tx.actorId===kidId).slice(0,25).map((tx,i)=>{
            const k=kidById(tx.actorId)||parById(tx.actorId);
            return(<div key={i} className="alog-row">
              <div style={{fontSize:11,color:"var(--tx3)",width:72,flexShrink:0}}>{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
              <div style={{flex:1,fontSize:13}}><strong>{k?.name||"?"}</strong> — {tx.desc}</div>
              {!!tx.cents&&<span className={`pill ${tx.cents>0?"pill-gr":"pill-am"}`}>{tx.cents>0?"+":""}{c$(Math.abs(tx.cents))}</span>}
            </div>);
          })}
          {txLog.length===0&&<div className="empty" style={{padding:"1rem 0"}}>No transactions yet.</div>}
        </div>
      </div>
    );
  }

  function SummerView({kidId=null}){
    const[tab,setTab]=useState("sessions");
    const today=ld();
    const dow=new Date().toLocaleDateString("en-US",{weekday:"long"});
    const focus=SFOCUS[dow];
    const curWk=wk(today);

    const KidSumCard=({kid})=>{
      const sk=sumKids[kid.id]||{};
      const todayDone=Object.values(sumSessions[kid.id]||{}).some(s=>s.date===today);
      const weekSessions=Object.values(sumSessions[kid.id]||{}).filter(s=>wk(s.date)===curWk);
      const bonusPaid=sk.weekBonusPaidFor===curWk;
      const pal=PAL[kid.colorIdx%PAL.length];
      return(
        <div className="sum-card">
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><Av initials={kid.initials} colorIdx={kid.colorIdx} size={30}/><span style={{fontWeight:800,fontSize:14}}>{kid.name}</span></div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:13,fontWeight:800,color:"var(--pr)"}}>{weekSessions.length}/4 this week</div>
              {bonusPaid&&<span className="pill pill-gr">✓ $1 bonus paid</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:6,marginBottom:8}}>
            {["Mon","Tue","Wed","Thu"].map((d,i)=>{
              const dayDate=Object.keys(sumSessions[kid.id]||{}).map(k=>sumSessions[kid.id][k]).find(s=>wk(s.date)===curWk&&lp(s.date).toLocaleDateString("en-US",{weekday:"short"})===d);
              return(<div key={d} style={{flex:1,textAlign:"center",background:dayDate?"var(--grl)":"var(--bg)",border:`1px solid ${dayDate?"#A7F3D0":"var(--bdr)"}`,borderRadius:7,padding:"4px 2px",fontSize:10,fontWeight:700,color:dayDate?"var(--gr)":"var(--tx3)"}}>
                {d}<br/>{dayDate?"✓":"–"}
              </div>);
            })}
          </div>
          {!focus?<div style={{fontSize:12,color:"var(--tx3)"}}>🏖️ No session today</div>:
          todayDone?<div style={{background:"var(--grl)",border:"1px solid #A7F3D0",borderRadius:8,padding:"8px 12px",fontSize:13,color:"var(--gr)",fontWeight:700}}>✅ Today's session done!</div>:(
            <div>
              <div style={{fontSize:12,color:"var(--tx2)",marginBottom:7}}>Today: <strong>{focus==="math"?"🔢 Math":"📖 Literacy"}</strong></div>
              <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:"11px",fontSize:14,fontWeight:800}} onClick={()=>completeSummerSession(kid.id,kid.name)}>✅ Mark Session Complete</button>
            </div>
          )}
          {parentMode&&weekSessions.length>=4&&!bonusPaid&&(
            <button className="btn bte" style={{width:"100%",justifyContent:"center",marginTop:8,fontSize:13}} onClick={()=>triggerSummerBonus(kid.id)}>
              🎉 Award $1 weekly bonus for {kid.name}
            </button>
          )}
        </div>
      );
    };

    return(
      <div>
        {sumActive()
          ?<div style={{background:"var(--prl)",border:"1px solid #C7D2FE",borderRadius:10,padding:"8px 14px",fontSize:12,color:"var(--pr)",fontWeight:600,marginBottom:12}}>☀️ Program active · Week {sumWeeks()} of ~10 · Complete all 4 Mon–Thu sessions for a $1.00 bonus</div>
          :<div style={{background:"var(--grl)",border:"1px solid #A7F3D0",borderRadius:10,padding:"8px 14px",fontSize:12,color:"var(--gr)",fontWeight:600,marginBottom:12}}>☀️ Summer program starts June 1, 2026</div>}
        <div style={{display:"flex",gap:6,marginBottom:12}} className="no-print">
          {[{id:"sessions",l:"Sessions"},{id:"reports",l:"Reports"}].map(t=>(
            <button key={t.id} className={`btn bsm ${tab===t.id?"bp":"bg"}`} onClick={()=>setTab(t.id)}>{t.l}</button>
          ))}
        </div>
        {tab==="sessions"&&(
          <div>
            {parentMode&&!kidId&&(
              <div className="card" style={{marginBottom:12,background:"var(--prl)",border:"1px solid #C7D2FE"}}>
                <div className="ch" style={{color:"var(--pr)"}}>⚡ Credit past sessions</div>
                <p style={{fontSize:12,color:"var(--tx2)",marginBottom:10,lineHeight:1.6}}>Backfill Mon–Thu sessions for kids who completed them but weren't logged in the app yet.</p>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {kids.map(k=>(
                    <button key={k.id} className="btn bbl bsm" onClick={()=>backfillSessions(k.id,k.name,4)}>
                      Credit {k.name} (4 sessions)
                    </button>
                  ))}
                </div>
              </div>
            )}
            {kidId?<KidSumCard kid={kidById(kidId)}/>:kids.map(k=><KidSumCard key={k.id} kid={k}/>)}
          </div>
        )}
        {tab==="reports"&&(
          <div>
            <button className="btn bte bsm" style={{marginBottom:12}} onClick={async()=>{
              const curWk2=wk(ld());
              const upd={};
              for(const k of kids){
                const sessions=Object.values(sumSessions[k.id]||{}).filter(s=>wk(s.date)===curWk2);
                upd[`wh/summerProgram/reports/${k.id}/${curWk2}`]={generatedAt:Date.now(),kidName:k.name,weekKey:curWk2,sessionsCompleted:sessions.length,sessionsScheduled:4,attendanceRate:(sessions.length/4).toFixed(2),bonusPaid:sumKids[k.id]?.weekBonusPaidFor===curWk2};
              }
              await FB.atomic(upd);toast("Report generated ✓","success");
            }}>⚡ Generate This Week's Report</button>
            <div className="rgrid">
              {kids.map((k,i)=>{
                const curWk2=wk(ld());
                const sessions=Object.values(sumSessions[k.id]||{}).filter(s=>wk(s.date)===curWk2);
                const sk=sumKids[k.id]||{};
                const bonusPaid=sk.weekBonusPaidFor===curWk2;
                const pal=PAL[i%PAL.length];
                return(<div key={k.id} style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderLeft:`4px solid ${pal.a}`,borderRadius:12,overflow:"hidden"}}>
                  <div style={{padding:"9px 13px",background:pal.l,display:"flex",justifyContent:"space-between"}}>
                    <strong style={{color:pal.t}}>{k.name}</strong>
                    <span style={{fontSize:11,color:pal.t}}>{curWk2}</span>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",borderBottom:"1px solid var(--bdr)"}}>
                    {[{v:`${sessions.length}/4`,l:"sessions"},{v:`${Math.round((sessions.length/4)*100)}%`,l:"attend."},{v:bonusPaid?"✓ $1":"–",l:"bonus"}].map((s,j)=>(
                      <div key={j} style={{padding:"8px 6px",textAlign:"center",borderRight:j<2?"1px solid var(--bdr)":"none"}}>
                        <div style={{fontSize:15,fontWeight:800}}>{s.v}</div>
                        <div style={{fontSize:9,color:"var(--tx3)",textTransform:"uppercase",letterSpacing:".05em"}}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                  {parentMode&&sessions.length>=4&&!bonusPaid&&(
                    <div style={{padding:"8px 13px"}}><button className="btn bte bsm" style={{width:"100%",justifyContent:"center"}} onClick={()=>triggerSummerBonus(k.id)}>Award $1 bonus</button></div>
                  )}
                </div>);
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function WeeklyCheckinView(){
    const curWk=wk(ld());
    const kidStats=kids.map(k=>{
      const earned=weekEarned(k.id,curWk);
      const goal=k.goal?.weeklyTargetCents||300;
      const gpct=Math.min(100,Math.round((earned/goal)*100));
      const completions=Object.entries(comps).filter(([d])=>wk(d)===curWk).flatMap(([,dc])=>Object.entries(dc).filter(([key])=>key.includes(k.id)&&dc[key].status==="done"||dc[key].status==="approved"));
      const monthK=mk(ld());
      const billsPaid=k.balanceCents||0; // current balance vs bills due
      const totalBillsAmt=bills.filter(b=>b.kidId===k.id&&b.active).reduce((a,b)=>a+(b.amountCents||0),0);
      const sk=sumKids[k.id]||{};
      const sumSess=Object.values(sumSessions[k.id]||{}).filter(s=>wk(s.date)===curWk).length;
      return{k,earned,goal,gpct,completions:completions.length,billsPaid,totalBillsAmt,sk,sumSess};
    });
    return(
      <div>
        <div style={{background:"var(--prl)",border:"1px solid #C7D2FE",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:"var(--pr)",fontWeight:700}}>
          📋 Weekly check-in — {curWk}
        </div>
        <div className="wk-grid">
          {kidStats.map(({k,earned,goal,gpct,completions,billsPaid,totalBillsAmt,sk,sumSess})=>{
            const pal=PAL[k.colorIdx%PAL.length];
            const onTrack=gpct>=75;
            const billOnTrack=totalBillsAmt===0||billsPaid>=totalBillsAmt;
            return(<div key={k.id} className="wk-card" style={{borderLeft:`4px solid ${pal.a}`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <Av initials={k.initials} colorIdx={k.colorIdx} size={30}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
                  <span className={`pill ${onTrack?"pill-gr":"pill-am"}`}>{onTrack?"On track":"Needs work"}</span>
                </div>
                <div style={{fontSize:16,fontWeight:900,color:"var(--gr)"}}>{c$(earned)}</div>
              </div>
              <div className="wk-stat"><span>Chores completed</span><strong>{completions}</strong></div>
              <div className="wk-stat"><span>Weekly goal</span><strong style={{color:gpct>=100?"var(--gr)":"var(--tx)"}}>{c$(earned)} / {c$(goal)} ({gpct}%)</strong></div>
              {totalBillsAmt>0&&<div className="wk-stat"><span>Bill progress</span><strong style={{color:billOnTrack?"var(--gr)":"var(--re)"}}>{c$(billsPaid)} / {c$(totalBillsAmt)}</strong></div>}
              {sumActive()&&<div className="wk-stat"><span>Summer sessions</span><strong>{sumSess}/4{sumSess>=4?" 🎉":""}</strong></div>}
              <div className="wk-stat"><span>Balance</span><strong style={{color:"var(--am)"}}>{c$(k.balanceCents||0)}</strong></div>
              {sumActive()&&sumSess>=4&&sumKids[k.id]?.weekBonusPaidFor!==curWk&&(
                <button className="btn bte bsm" style={{width:"100%",justifyContent:"center",marginTop:8}} onClick={()=>triggerSummerBonus(k.id)}>
                  🎉 Pay $1 summer bonus
                </button>
              )}
            </div>);
          })}
        </div>
        <div className="card" style={{marginTop:14}}>
          <div className="ch">Parent contributions this week</div>
          {parents.map(p=>{
            const tasks=Object.entries(parentLog).filter(([d])=>wk(d)===curWk).flatMap(([,logs])=>Object.values(logs||{}).filter(l=>l.parentId===p.id));
            return(<div key={p.id} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:13,fontWeight:700,marginBottom:4}}><span>{p.name}</span><span style={{color:"var(--tx2)"}}>{tasks.length} tasks</span></div>
              {tasks.slice(0,4).map((t,i)=><div key={i} style={{fontSize:12,color:"var(--tx2)",paddingLeft:8}}>{t.desc}</div>)}
            </div>);
          })}
        </div>
      </div>
    );
  }

  function SettingsView(){
    return(<div className="card">
      {[
        {l:"Firebase",s:ready?`🟢 Connected${!online?" · ⚠️ Offline":""}`:  "🔴 Demo mode",btn:"Configure",fn:()=>setShowCfg(true)},
        {l:"Parent PIN",s:hasPIN?"PIN is set":"No PIN set",btn:hasPIN?"Change":"Set PIN",fn:()=>setScreen("pin-set")},
        {l:"Parent mode",s:"Manage chores, approve, edit",custom:true},
      ].map(r=>(
        <div key={r.l} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:"1px solid var(--bdr)"}}>
          <div><div style={{fontWeight:700,fontSize:13}}>{r.l}</div><div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{r.s}</div></div>
          {r.custom?<label className="sw"><input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/><div className="sw-t"/><div className="sw-th"/></label>
            :<button className="btn bg bsm" onClick={r.fn}>{r.btn}</button>}
        </div>
      ))}
    </div>);
  }

  /* ── Modals ── */
  function ChoreModalComp(){
    const m=choreModal;
    const isQuick=m?.mode==="quick";
    const blank={title:"",diff:"easy",scheduleType:"daily",scheduleDays:[],assignedTo:[],priceCents:25,requiresApproval:false,repeating:false};
    const[f,setF]=useState(m?.data||blank);
    const[oneTimeOnly,setOneTimeOnly]=useState(false);
    const tog=(arr,v)=>arr?.includes(v)?arr.filter(x=>x!==v):[...(arr||[]),v];
    const allActors=[...kids,...parents];
    return(<div className="overlay" onClick={()=>setChoreModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{m?.mode==="edit"?"Edit Chore":isQuick?"Quick Add Chore":"Add Chore"}</div>
      <div className="fg"><label className="fl">Title</label><input className="fi" placeholder="Chore name" value={f.title} onChange={e=>setF(x=>({...x,title:e.target.value}))}/></div>
      <div style={{display:"flex",gap:8}}>
        <div className="fg" style={{flex:1}}>
          <label className="fl">Difficulty</label>
          <select className="fi" value={f.diff} onChange={e=>{const d=e.target.value;setF(x=>({...x,diff:d,priceCents:d==="easy"?25:d==="medium"?50:100}));}}>
            <option value="easy">Easy — $0.25</option>
            <option value="medium">Medium — $0.50</option>
            <option value="hard">Hard — $1.00</option>
          </select>
        </div>
        <div className="fg" style={{flex:1}}>
          <label className="fl">Amount ($)</label>
          <input className="fi" type="number" step="0.05" min="0" value={(f.priceCents/100).toFixed(2)} onChange={e=>setF(x=>({...x,priceCents:Math.round(parseFloat(e.target.value)*100)||25}))}/>
        </div>
      </div>
      {!isQuick&&<>
        <div className="fg"><label className="fl">Schedule</label>
          <select className="fi" value={f.scheduleType} onChange={e=>setF(x=>({...x,scheduleType:e.target.value}))}>
            <option value="daily">Every day</option><option value="weekly">Specific days</option>
          </select></div>
        {f.scheduleType==="weekly"&&<div className="fg"><label className="fl">Days</label>
          <div className="frow">{DAYS.map(d=><button key={d} className={`btn bsm ${f.scheduleDays?.includes(d)?"bp":"bg"}`} onClick={()=>setF(x=>({...x,scheduleDays:tog(x.scheduleDays,d)}))}>{d}</button>)}</div></div>}
      </>}
      <div className="fg"><label className="fl">Assign to (leave empty = today only for quick add)</label>
        <div className="frow">{allActors.map(a=><button key={a.id} className={`btn bsm ${f.assignedTo?.includes(a.id)?"bp":"bg"}`} onClick={()=>setF(x=>({...x,assignedTo:tog(x.assignedTo,a.id)}))}>{a.name}</button>)}</div></div>
      {m?.mode==="edit"&&<div className="sw-row" style={{fontSize:13}}><span style={{fontWeight:600}}>Change for today only</span><label className="sw"><input type="checkbox" checked={oneTimeOnly} onChange={e=>setOneTimeOnly(e.target.checked)}/><div className="sw-t"/><div className="sw-th"/></label></div>}
      <div className="sw-row" style={{fontSize:13}}><span style={{fontWeight:600}}>Requires approval</span><label className="sw"><input type="checkbox" checked={!!f.requiresApproval} onChange={e=>setF(x=>({...x,requiresApproval:e.target.checked}))}/><div className="sw-t"/><div className="sw-th"/></label></div>
      <div className="fax">
        {m?.data?.id&&<button className="btn bco" onClick={()=>{deleteChore(m.data.id);setChoreModal(null);}}>Delete</button>}
        <button className="btn bg" onClick={()=>setChoreModal(null)}>Cancel</button>
        <button className="btn bp" onClick={()=>{if(!f.title.trim())return;saveChore(f,oneTimeOnly?selDate:null);setChoreModal(null);}}>
          {m?.mode==="edit"?"Save":"Add chore"}
        </button>
      </div>
    </div></div>);
  }

  function EditCompModalComp(){
    const m=editCompModal;
    const[cents,setCents]=useState((m?.comp?.cents||0)/100);
    const[note,setNote]=useState("");
    const[remove,setRemove]=useState(false);
    if(!m)return null;
    return(<div className="overlay" onClick={()=>setEditCompModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">✏️ Edit Completion</div>
      <div className="fg"><label className="fl">Adjusted amount ($)</label>
        <input className="fi" type="number" step="0.05" min="0" value={cents} onChange={e=>setCents(parseFloat(e.target.value)||0)} disabled={remove}/></div>
      <div className="fg"><label className="fl">Reason for change (required)</label>
        <textarea className="fi" placeholder="e.g. Only half done, missed a section..." value={note} onChange={e=>setNote(e.target.value)}/></div>
      <div className="sw-row" style={{fontSize:13}}><span style={{fontWeight:600,color:"var(--re)"}}>Remove this completion entirely</span>
        <label className="sw"><input type="checkbox" checked={remove} onChange={e=>setRemove(e.target.checked)}/><div className="sw-t"/><div className="sw-th"/></label></div>
      <div className="fax">
        <button className="btn bg" onClick={()=>setEditCompModal(null)}>Cancel</button>
        <button className="btn bp" disabled={!note.trim()} onClick={()=>editComp(m.dk,m.choreId,m.actorId,{newCents:Math.round(cents*100),remove,note})}>Save changes</button>
      </div>
    </div></div>);
  }

  function BillModalComp(){
    const b=billModal;
    const[f,setF]=useState(b?.id?b:{kidId:"k1",name:"",amountCents:4500,type:"monthly",active:true});
    return(<div className="overlay" onClick={()=>setBillModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">{b?.id?"Edit Bill":"Add Bill"}</div>
      <div className="fg"><label className="fl">Kid</label>
        <select className="fi" value={f.kidId} onChange={e=>setF(x=>({...x,kidId:e.target.value}))}>
          {kids.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}
        </select></div>
      <div className="fg"><label className="fl">Bill name</label><input className="fi" placeholder="Cell phone, Soccer..." value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))}/></div>
      <div style={{display:"flex",gap:8}}>
        <div className="fg" style={{flex:1}}><label className="fl">Amount ($)</label>
          <input className="fi" type="number" step="0.01" value={(f.amountCents/100).toFixed(2)} onChange={e=>setF(x=>({...x,amountCents:Math.round(parseFloat(e.target.value)*100)||0}))}/></div>
        <div className="fg" style={{flex:1}}><label className="fl">Type</label>
          <select className="fi" value={f.type} onChange={e=>setF(x=>({...x,type:e.target.value}))}>
            <option value="monthly">Monthly</option><option value="goal">One-time goal</option>
          </select></div>
      </div>
      <div className="fax">
        <button className="btn bg" onClick={()=>setBillModal(null)}>Cancel</button>
        <button className="btn bp" onClick={async()=>{
          if(!f.name.trim())return;
          const id=f.id||`b${Date.now()}`;
          await FB.write(`wh/bills/${id}`,{...f,id});
          toast(f.id?"Bill updated":"Bill added","success");setBillModal(null);
        }}>{b?.id?"Save":"Add bill"}</button>
      </div>
    </div></div>);
  }

  function PayBillModalComp(){
    const m=payBillModal;
    const kid=kidById(m?.kidId);
    const[amt,setAmt]=useState(m?.bill?((m.bill.amountCents)/100).toFixed(2):"");
    if(!m||!kid)return null;
    return(<div className="overlay" onClick={()=>setPayBillModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">💸 Pay Bill: {m.bill.name}</div>
      <p style={{fontSize:13,color:"var(--tx2)",marginBottom:14}}>
        {kid.name}'s balance: <strong style={{color:"var(--am)"}}>{c$(kid.balanceCents||0)}</strong><br/>
        Bill amount: <strong style={{color:"var(--re)"}}>{c$(m.bill.amountCents)}</strong>
      </p>
      <div className="fg"><label className="fl">Amount to pay ($)</label>
        <input className="fi" type="number" step="0.01" value={amt} onChange={e=>setAmt(e.target.value)}/></div>
      <div className="fax">
        <button className="btn bg" onClick={()=>setPayBillModal(null)}>Cancel</button>
        <button className="btn bp" onClick={()=>{const c=Math.round(parseFloat(amt)*100);if(c>0){payBill(m.bill.id,m.kidId,c);setPayBillModal(null);}}}>Pay {amt?c$(Math.round(parseFloat(amt)*100)):""}</button>
      </div>
    </div></div>);
  }

  function PoolAddModalComp(){
    const[f,setF]=useState({title:"",diff:"medium",priceCents:50,note:"",repeating:true});
    return(<div className="overlay" onClick={()=>setPoolAddModal(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">➕ Add Pool Chore</div>
      <div className="fg"><label className="fl">Title</label><input className="fi" placeholder="e.g. Sweep porch" value={f.title} onChange={e=>setF(x=>({...x,title:e.target.value}))}/></div>
      <div style={{display:"flex",gap:8}}>
        <div className="fg" style={{flex:1}}><label className="fl">Difficulty</label>
          <select className="fi" value={f.diff} onChange={e=>{const d=e.target.value;setF(x=>({...x,diff:d,priceCents:d==="easy"?25:d==="medium"?50:100}));}}>
            <option value="easy">Easy — $0.25</option><option value="medium">Medium — $0.50</option><option value="hard">Hard — $1.00</option>
          </select></div>
        <div className="fg" style={{flex:1}}><label className="fl">Amount ($)</label>
          <input className="fi" type="number" step="0.05" value={(f.priceCents/100).toFixed(2)} onChange={e=>setF(x=>({...x,priceCents:Math.round(parseFloat(e.target.value)*100)||25}))}/></div>
      </div>
      <div className="fg"><label className="fl">Note (optional)</label><input className="fi" placeholder="Any details..." value={f.note} onChange={e=>setF(x=>({...x,note:e.target.value}))}/></div>
      <div className="sw-row" style={{fontSize:13}}><span style={{fontWeight:600}}>Repeating (resets after each completion)</span><label className="sw"><input type="checkbox" checked={f.repeating} onChange={e=>setF(x=>({...x,repeating:e.target.checked}))}/><div className="sw-t"/><div className="sw-th"/></label></div>
      <div className="fax">
        <button className="btn bg" onClick={()=>setPoolAddModal(false)}>Cancel</button>
        <button className="btn bp" onClick={()=>{if(!f.title.trim())return;addPoolChore(f);setPoolAddModal(false);}}>Add to pool</button>
      </div>
    </div></div>);
  }

  function PoolEditModalComp(){
    const c=poolEditModal;
    const AREAS=Array.from(new Set(pool.map(p=>p.area).filter(Boolean))).sort();
    const[f,setF]=useState({
      title:c.title||"",
      area:c.area||"",
      freq:c.freq||(c.recurring?"weekly":""),
      priceCents:c.priceCents||25,
      note:c.note||"",
      recurring:c.recurring!==undefined?!!c.recurring:!!c.freq,
    });
    function save(){
      if(!f.title.trim())return;
      const patch={title:f.title.trim(),area:f.area.trim(),priceCents:f.priceCents,note:f.note,recurring:f.recurring};
      if(f.recurring&&f.freq){patch.freq=f.freq;patch.intervalDays=INTERVAL_DAYS[f.freq]||7;}
      updatePoolChore(c.id,patch);
      setPoolEditModal(null);
    }
    return(<div className="overlay" onClick={()=>setPoolEditModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">✏️ Edit Pool Chore</div>
      <div className="fg"><label className="fl">Title</label><input className="fi" value={f.title} onChange={e=>setF(x=>({...x,title:e.target.value}))}/></div>
      <div style={{display:"flex",gap:8}}>
        <div className="fg" style={{flex:1}}><label className="fl">Frequency</label>
          <select className="fi" value={f.recurring?f.freq:"none"} onChange={e=>{const v=e.target.value;if(v==="none")setF(x=>({...x,recurring:false}));else setF(x=>({...x,recurring:true,freq:v}));}}>
            <option value="none">One-time / on demand</option>
            {FREQ_OPTS.map(o=><option key={o} value={o}>{FREQ_LBL[o]}</option>)}
          </select></div>
        <div className="fg" style={{flex:1}}><label className="fl">Amount ($)</label>
          <input className="fi" type="number" step="0.05" min="0" value={(f.priceCents/100).toFixed(2)} onChange={e=>setF(x=>({...x,priceCents:Math.round(parseFloat(e.target.value)*100)||25}))}/></div>
      </div>
      {f.recurring&&f.freq&&<div style={{fontSize:11,color:"var(--tx2)",marginTop:-4,marginBottom:8}}>Resets every {INTERVAL_DAYS[f.freq]} day(s) after it's completed.</div>}
      <div className="fg"><label className="fl">Room / area</label>
        <input className="fi" list="poolAreas" placeholder="e.g. Kitchen" value={f.area} onChange={e=>setF(x=>({...x,area:e.target.value}))}/>
        <datalist id="poolAreas">{AREAS.map(a=><option key={a} value={a}/>)}</datalist>
      </div>
      <div className="fg"><label className="fl">Note (optional)</label><input className="fi" value={f.note} onChange={e=>setF(x=>({...x,note:e.target.value}))}/></div>
      <div className="fax">
        <button className="btn bco" onClick={()=>{removePoolChore(c.id);setPoolEditModal(null);}}>Delete</button>
        <button className="btn bg" onClick={()=>setPoolEditModal(null)}>Cancel</button>
        <button className="btn bp" onClick={save}>Save</button>
      </div>
    </div></div>);
  }

  function ParentTaskModalComp(){
    const[desc,setDesc]=useState("");
    const[who,setWho]=useState(parentTaskModal?.parentId||parents[0]?.id);
    return(<div className="overlay" onClick={()=>setParentTaskModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">✅ Log Parent Task</div>
      <div className="fg"><label className="fl">Who did it?</label>
        <div className="frow">{parents.map(p=><button key={p.id} className={`btn bsm ${who===p.id?"bp":"bg"}`} onClick={()=>setWho(p.id)}>{p.name}</button>)}</div></div>
      <div className="fg"><label className="fl">What did you do?</label><input className="fi" placeholder="e.g. Cleaned bathroom, mowed lawn..." value={desc} onChange={e=>setDesc(e.target.value)}/></div>
      <div className="fax">
        <button className="btn bg" onClick={()=>setParentTaskModal(null)}>Cancel</button>
        <button className="btn bp" onClick={()=>{if(!desc.trim())return;logParentTask(who,desc);setParentTaskModal(null);}}>Log task</button>
      </div>
    </div></div>);
  }

  /* Focus Timer */
  function BonusModal(){
    const m=bonusModal;
    const[amt,setAmt]=useState("0.50");
    const[note,setNote]=useState("");
    if(!m)return null;
    return(<div className="overlay" onClick={()=>setBonusModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">🌟 Give Bonus — {m.kidName}</div>
      <div className="fg"><label className="fl">Amount ($)</label>
        <div className="frow">
          {["0.25","0.50","1.00","2.00","5.00"].map(v=>(
            <button key={v} className={`btn bsm ${amt===v?"bp":"bg"}`} onClick={()=>setAmt(v)}>${v}</button>
          ))}
        </div>
        <input className="fi" style={{marginTop:6}} type="number" step="0.25" min="0.01" value={amt} onChange={e=>setAmt(e.target.value)}/>
      </div>
      <div className="fg"><label className="fl">Reason (shown in transaction log)</label>
        <input className="fi" placeholder="Great attitude, helped without being asked..." value={note} onChange={e=>setNote(e.target.value)}/></div>
      <div className="fax">
        <button className="btn bg" onClick={()=>setBonusModal(null)}>Cancel</button>
        <button className="btn bp" disabled={!note.trim()||parseFloat(amt)<=0} onClick={()=>{giveBonus(m.kidId,m.kidName,Math.round(parseFloat(amt)*100),note);setBonusModal(null);}}>
          Give +{amt?`$${parseFloat(amt).toFixed(2)}`:""}
        </button>
      </div>
    </div></div>);
  }

  function NoteModal(){
    const m=noteModal;
    const kid=m?kidById(m.kidId):null;
    const[note,setNote]=useState(kid?.latestNote||"");
    if(!m||!kid)return null;
    return(<div className="overlay" onClick={()=>setNoteModal(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="modal-h">📝 Note for {m.kidName}</div>
      <p style={{fontSize:12,color:"var(--tx2)",marginBottom:12,lineHeight:1.6}}>This note appears on {m.kidName}'s dashboard card so they see it when you open the app together.</p>
      <div className="fg"><label className="fl">Message</label>
        <textarea className="fi" rows={3} placeholder="Great job this week! Keep it up..." value={note} onChange={e=>setNote(e.target.value)}/></div>
      <div className="fax">
        <button className="btn bg" onClick={()=>{saveNote(m.kidId,"");setNoteModal(null);}}>Clear note</button>
        <button className="btn bg" onClick={()=>setNoteModal(null)}>Cancel</button>
        <button className="btn bp" onClick={()=>{saveNote(m.kidId,note);setNoteModal(null);}}>Save note</button>
      </div>
    </div></div>);
  }

  function FocusTimer(){
    const D=25*60;
    const[s,setS]=useState(D);const[run,setRun]=useState(false);const[done,setDone]=useState(false);const[sk,setSk]=useState(kids[0]?.id||"");
    const t=useRef(null);
    const start=()=>{setRun(true);t.current=setInterval(()=>setS(x=>{if(x<=1){clearInterval(t.current);setRun(false);setDone(true);return 0;}return x-1;}),1000);};
    const pause=()=>{clearInterval(t.current);setRun(false);};
    const reset=()=>{clearInterval(t.current);setRun(false);setDone(false);setS(D);};
    useEffect(()=>()=>clearInterval(t.current),[]);
    const pct=(s/D)*100,r=56,c=2*Math.PI*r;
    const mm=String(Math.floor(s/60)).padStart(2,"0"),ss=String(s%60).padStart(2,"0");
    return(<div className="overlay"><div className="modal" style={{textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:800,marginBottom:14}}>⏱ Focus Timer</div>
      <div style={{width:140,height:140,margin:"0 auto 14px",position:"relative"}}>
        <svg style={{transform:"rotate(-90deg)"}} width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--bg)" strokeWidth="8"/>
          <circle cx="70" cy="70" r={r} fill="none" stroke="var(--pr)" strokeWidth="8"
            strokeDasharray={c} strokeDashoffset={c*(1-pct/100)} strokeLinecap="round"/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:900}}>{mm}:{ss}</div>
      </div>
      {done?(<div style={{marginBottom:14}}>
        <div style={{color:"var(--gr)",fontWeight:800,marginBottom:10}}>🎉 Done! Award bonus?</div>
        <select className="fi" value={sk} onChange={e=>setSk(e.target.value)}><option value="">No bonus</option>{kids.map(k=><option key={k.id} value={k.id}>{k.name}</option>)}</select>
      </div>):(
        <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:14}}>
          {!run?<button className="btn bp" onClick={start}>▶ Start</button>:<button className="btn bg" onClick={pause}>⏸ Pause</button>}
          <button className="btn bg" onClick={reset}>↺</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,justifyContent:"center"}}>
        {done&&sk&&<button className="btn bte" onClick={()=>{awardXp(sk,50);setShowTimer(false);}}>+$0.50 & Close</button>}
        <button className="btn bg" onClick={()=>setShowTimer(false)}>Close</button>
      </div>
    </div></div>);
  }

  /* ── Kid Mode ── */
  function KidModeApp(){
    const isParActor=!!activeParent;
    const actor=isParActor?parById(activeParent):kidById(activeKid);
    const[kmTab,setKmTab]=useState("tasks");
    if(!actor)return null;
    const pal=PAL[(actor.colorIdx||0)%PAL.length];
    const bal=!isParActor?c$(kidById(activeKid)?.balanceCents||0):"";
    const tabs=isParActor
      ?[{id:"tasks",l:"✓ Tasks"},{id:"pool",l:"🎯 Pool"},{id:"log",l:"📝 Log Task"}]
      :[{id:"tasks",l:"✓ Tasks"},{id:"pool",l:"🎯 Pool"},{id:"summer",l:"☀️ Summer"},{id:"bills",l:"💸 Bills"},{id:"store",l:"🛍 Store"},{id:"money",l:"💰 Money"}];
    return(<div className="km-wrap">
      {!online&&ready&&<div className="offline-bar">⚠️ Offline</div>}
      <div className="km-hdr" style={{flexDirection:"column",alignItems:"stretch",gap:8}}>
        <div style={{display:"flex",alignItems:"center",gap:11}}>
          <Av initials={actor.initials} colorIdx={actor.colorIdx||0} size={38}/>
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:900}}>{actor.name}</div>
            {!isParActor&&<div style={{fontSize:12,fontWeight:800,color:"var(--am)"}}>{bal}</div>}
          </div>
          <button className="btn bg bsm" onClick={exitToPicker}>← Home</button>
        </div>
        {!isParActor&&(()=>{
          const kid2=kidById(activeKid);
          const kidBills2=bills.filter(b=>b.kidId===activeKid&&b.active);
          const totalBills2=kidBills2.reduce((a,b)=>a+(b.amountCents||0),0);
          const bal2=kid2?.balanceCents||0;
          const dueDate2=new Date("2026-07-01T00:00:00");
          const daysLeft2=Math.max(0,Math.ceil((dueDate2-new Date())/(1000*60*60*24)));
          const pal2=PAL[(kid2?.colorIdx||0)%PAL.length];
          if(!totalBills2)return null;
          const billPct2=Math.min(100,Math.round((bal2/totalBills2)*100));
          return(<div style={{paddingTop:4}}>
            {kidBills2.map(bill=>{
              const bPct=Math.min(100,Math.round((bal2/bill.amountCents)*100));
              return(<div key={bill.id} style={{marginBottom:5}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:2}}>
                  <span style={{color:"var(--tx2)",fontWeight:600}}>{bill.name}</span>
                  <span style={{fontWeight:800,color:bPct>=100?"var(--gr)":pal2.a}}>{c$(bal2)} / {c$(bill.amountCents)} · {daysLeft2}d left</span>
                </div>
                <div className="pbar"><div className="pbar-f" style={{width:`${bPct}%`,background:bPct>=100?"var(--gr)":pal2.a}}/></div>
              </div>);
            })}
          </div>);
        })()}
      </div>
      <div className="km-tabs">{tabs.map(t=><button key={t.id} className={`km-tab${kmTab===t.id?" act":""}`} onClick={()=>setKmTab(t.id)}>{t.l}</button>)}</div>
      <div className="km-body">
        <ErrBound>
          {kmTab==="tasks"&&<ChoresView actorId={actor.id} isParent={false} isParentActor={isParActor}/>}
          {kmTab==="pool"&&<PoolView actorId={actor.id} isParentActor={isParActor} showManage={isParActor&&parentMode}/>}
          {kmTab==="log"&&isParActor&&<div>
            <button className="btn bp" style={{width:"100%",justifyContent:"center",padding:12,fontSize:14,fontWeight:800}} onClick={()=>setParentTaskModal({parentId:actor.id})}>+ Log a Task</button>
            <div style={{marginTop:14}}>
              <div className="ch">Today's logs</div>
              {Object.values(parentLog[ld()]||{}).filter(l=>l.parentId===actor.id).map((t,i)=>(
                <div key={i} className="alog-row"><div style={{flex:1,fontSize:13}}>{t.desc}</div><div style={{fontSize:11,color:"var(--tx3)"}}>{new Date(t.ts).toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"})}</div></div>
              ))}
            </div>
          </div>}
          {kmTab==="summer"&&!isParActor&&<SummerView kidId={activeKid}/>}
          {kmTab==="bills"&&!isParActor&&<BillsView kidId={activeKid}/>}
          {kmTab==="store"&&!isParActor&&<StoreView kidId={activeKid}/>}
          {kmTab==="money"&&!isParActor&&<MoneyView kidId={activeKid}/>}
        </ErrBound>
      </div>
    </div>);
  }

  /* ── Screen routing ── */
  const Toasts=()=><div className="toasts">{toasts.map(t=><div key={t.id} className={`toast t-${t.type}`}>{t.msg}</div>)}</div>;

  if(screen==="picker")return(<>
    <style>{CSS}</style>
    {!online&&ready&&<div className="offline-bar">⚠️ Offline</div>}
    {showCfg&&<FbCfgModal onSave={saveCfg} onSkip={()=>setShowCfg(false)}/>}
    <div className="picker">
      <div style={{fontSize:26,fontWeight:900,color:"var(--pr)",marginBottom:4}}>WattsHub</div>
      <div style={{fontSize:14,color:"var(--tx2)",marginBottom:28}}>Who's using the app?</div>
      <div className="pgrid">
        {kids.map(k=><div key={k.id} className="pcard" onClick={()=>enterKid(k.id)}>
          <Av initials={k.initials} colorIdx={k.colorIdx} size={48}/>
          <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
          <div style={{fontSize:11,color:"var(--tx2)"}}>Age {k.age}</div>
          <div style={{fontSize:13,fontWeight:800,color:"var(--gr)"}}>{c$(k.balanceCents||0)}</div>
        </div>)}
        {parents.map(p=><div key={p.id} className="pcard" onClick={()=>enterParentProfile(p.id)}>
          <Av initials={p.initials} colorIdx={p.colorIdx||4} size={48}/>
          <div style={{fontSize:14,fontWeight:800}}>{p.name}</div>
          <div style={{fontSize:11,color:"var(--tx2)"}}>Parent</div>
        </div>)}
        <div className="pcard" onClick={goPin}>
          <div style={{width:48,height:48,borderRadius:"50%",background:"var(--aml)",color:"var(--am)",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>🔑</div>
          <div style={{fontSize:14,fontWeight:800}}>Parent Dashboard</div>
          <div style={{fontSize:11,color:"var(--tx2)"}}>PIN required</div>
        </div>
      </div>
      {!ready&&<div style={{marginTop:22,fontSize:12,color:"var(--tx3)"}}>Demo mode — <button onClick={()=>setShowCfg(true)} className="btn bg bsm">Connect Firebase</button></div>}
    </div>
    <Toasts/>
  </>);

  if(screen==="pin-set")return(<><style>{CSS}</style><PINScreen mode="set" onSuccess={enterParent} onBack={()=>setScreen("picker")}/></>);
  if(screen==="pin-verify")return(<><style>{CSS}</style><PINScreen mode="verify" onSuccess={enterParent} onBack={()=>setScreen("picker")}/></>);
  if(screen==="kid")return(<><style>{CSS}</style><ErrBound><KidModeApp/></ErrBound>
    {choreModal&&<ChoreModalComp/>}{editCompModal&&<EditCompModalComp/>}{parentTaskModal&&<ParentTaskModalComp/>}
    {poolAddModal&&<PoolAddModalComp/>}{poolEditModal&&<PoolEditModalComp/>}{bonusModal&&<BonusModal/>}{noteModal&&<NoteModal/>}<Toasts/></>);

  /* Parent app */
  const NAV=[
    {id:"dashboard",ic:"⊞",l:"Dashboard"},
    {id:"chores",   ic:"✓",l:"Chores"},
    {id:"pool",     ic:"🎯",l:"Pool"},
    {id:"summary",  ic:"📊",l:"Summary"},
    {id:"checkin",  ic:"📋",l:"Check-In"},
    {id:"bills",    ic:"💸",l:"Bills"},
    {id:"summer",   ic:"☀️",l:"Summer"},
    {id:"store",    ic:"🛍️",l:"Store"},
    {id:"money",    ic:"💵",l:"Money"},
    {id:"settings", ic:"⚙",l:"Settings"},
  ];
  const BNAV=[
    {id:"dashboard",ic:"⊞",l:"Home"},
    {id:"chores",   ic:"✓",l:"Chores"},
    {id:"pool",     ic:"🎯",l:"Pool"},
    {id:"summary",  ic:"📊",l:"Summary"},
    {id:"checkin",  ic:"📋",l:"Check-In"},
  ];
  const TITLES={dashboard:"Dashboard",chores:"Chores",pool:"Chore Pool",summary:"Summary",checkin:"Weekly Check-In",bills:"Bills & Goals",summer:"Summer Program",store:"Family Store",money:"Money",settings:"Settings"};

  return(<>
    <style>{CSS}</style>
    {!online&&ready&&<div className="offline-bar">⚠️ Offline — changes will sync when reconnected</div>}
    {showCfg&&<FbCfgModal onSave={saveCfg} onSkip={()=>setShowCfg(false)}/>}
    {choreModal&&<ChoreModalComp/>}
    {editCompModal&&<EditCompModalComp/>}
    {billModal&&<BillModalComp/>}
    {payBillModal&&<PayBillModalComp/>}
    {poolAddModal&&<PoolAddModalComp/>}
    {poolEditModal&&<PoolEditModalComp/>}
    {parentTaskModal&&<ParentTaskModalComp/>}
    {bonusModal&&<BonusModal/>}
    {noteModal&&<NoteModal/>}
    {showTimer&&<FocusTimer/>}

    <div className="layout">
      <aside className="sidebar">
        <div className="slogo">
          WattsHub
          {!ready&&<span style={{fontSize:9,background:"var(--am)",color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:800}}>DEMO</span>}
          {ready&&!online&&<span style={{fontSize:9,background:"var(--re)",color:"#fff",borderRadius:3,padding:"1px 5px",fontWeight:800}}>OFF</span>}
        </div>
        <div className="snav">
          <div className="sdiv">Navigate</div>
          {NAV.map(n=><button key={n.id} className={`sni${view===n.id?" act":""}`}
            onClick={()=>{setView(n.id);if(!["chores","store","money"].includes(n.id))setActiveKid(null);}}>
            <span style={{fontSize:15,width:20,textAlign:"center"}}>{n.ic}</span>{n.l}
            {n.id==="chores"&&pendCount>0&&<span className="sbadge">{pendCount}</span>}
          </button>)}
          <div className="sdiv" style={{marginTop:8}}>Kids</div>
          {kids.map(k=><button key={k.id} className={`skid${activeKid===k.id?" act":""}`}
            onClick={()=>{setActiveKid(k.id);setSelDate(ld());setView("chores");}}>
            <Av initials={k.initials} colorIdx={k.colorIdx} size={22}/>
            <span style={{flex:1}}>{k.name}</span>
            <span style={{fontSize:11,color:"var(--am)",fontWeight:700}}>{c$(k.balanceCents||0)}</span>
          </button>)}
          {activeKid&&<button className="skid" style={{color:"var(--tx3)"}} onClick={()=>{setActiveKid(null);setView("dashboard");}}>
            <span style={{width:22,textAlign:"center"}}>←</span>All kids
          </button>}
          {parentMode&&activeKid&&(()=>{const k=kidById(activeKid);return k?(<div style={{display:"flex",gap:4,padding:"4px 10px"}}>
            <button className="btn bte bxs" style={{flex:1}} onClick={()=>setBonusModal({kidId:k.id,kidName:k.name})}>🌟 Bonus</button>
            <button className="btn bbl bxs" style={{flex:1}} onClick={()=>setNoteModal({kidId:k.id,kidName:k.name})}>📝 Note</button>
          </div>):null;})()}
          <div className="sdiv" style={{marginTop:8}}>Parents</div>
          {parents.map(p=><button key={p.id} className="skid" onClick={()=>setParentTaskModal({parentId:p.id})}>
            <Av initials={p.initials} colorIdx={p.colorIdx||4} size={22}/>
            {p.name}
          </button>)}
        </div>
        <div className="sfoot">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"4px 0",marginBottom:5}}>
            <span style={{fontSize:12,fontWeight:600,color:"var(--tx2)"}}>Parent mode</span>
            <label className="sw"><input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/><div className="sw-t"/><div className="sw-th"/></label>
          </div>
          <button className="sni" style={{color:"var(--tx3)"}} onClick={exitToPicker}><span style={{width:20,textAlign:"center"}}>←</span>Profile picker</button>
          <button className="sni" style={{color:"var(--tx3)"}} onClick={()=>setShowCfg(true)}><span style={{width:20,textAlign:"center"}}>⚙</span>Firebase setup</button>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div style={{fontSize:16,fontWeight:800}}>{TITLES[view]||view}</div>
            <div style={{fontSize:11,color:"var(--tx2)",marginTop:1}}>
              {view==="chores"?(activeKid?kidById(activeKid)?.name+" · ":"")+(isToday?"Today":lp(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})):""}
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {ready&&<span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:5,background:online?"var(--grl)":"var(--aml)",color:online?"var(--gr)":"var(--am)"}}>{online?"● Live":"⚠ Offline"}</span>}
            {pendCount>0&&parentMode&&<span style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:5,background:"var(--aml)",color:"var(--am)"}}>{pendCount} pending</span>}
            {parentMode&&activeKid&&<button className="btn bte bsm" onClick={()=>setBonusModal({kidId:activeKid,kidName:kidById(activeKid)?.name||""})}>🌟 Bonus</button>}
            {parentMode&&activeKid&&<button className="btn bbl bsm" onClick={()=>setNoteModal({kidId:activeKid,kidName:kidById(activeKid)?.name||""})}>📝 Note</button>}
            {parentMode&&<button className="btn bg bsm" onClick={()=>setShowTimer(true)}>⏱</button>}
            {parentMode&&<button className="btn bg bsm" onClick={()=>setParentTaskModal({})}>+ Log Task</button>}
            {parentMode&&view==="pool"&&<button className="btn bbl bsm" onClick={()=>setPoolAddModal(true)}>+ Pool Chore</button>}
            {parentMode&&view==="bills"&&<button className="btn bg bsm" onClick={()=>setBillModal({})}>+ Bill</button>}
            {parentMode&&<button className="btn bg bsm" onClick={()=>setChoreModal({mode:"quick",data:{}})}>+ Quick</button>}
            {parentMode&&<button className="btn bp bsm" onClick={()=>setChoreModal({mode:"add",data:{}})}>+ Chore</button>}
          </div>
        </div>
        <div className="content">
          <ErrBound>
            {view==="dashboard"&&<DashboardView/>}
            {view==="chores"&&<ChoresView actorId={activeKid||null} isParent={parentMode} isParentActor={false}/>}
            {view==="pool"&&<PoolView actorId={activeKid||null} showManage={parentMode}/>}
            {view==="summary"&&<SummaryView/>}
            {view==="checkin"&&<WeeklyCheckinView/>}
            {view==="bills"&&<BillsView/>}
            {view==="summer"&&<SummerView/>}
            {view==="store"&&<StoreView/>}
            {view==="money"&&<MoneyView/>}
            {view==="settings"&&<SettingsView/>}
          </ErrBound>
        </div>
      </main>
    </div>

    <nav className="bnav"><div className="bnav-in">
      {BNAV.map(n=><button key={n.id} className={`bnav-btn${view===n.id?" act":""}`}
        onClick={()=>{setView(n.id);setActiveKid(null);}}>
        <span className="bnav-ic">{n.ic}</span>{n.l}
      </button>)}
    </div></nav>
    <Toasts/>
  </>);
}

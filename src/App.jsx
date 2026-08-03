import{useState,useEffect,useRef,useCallback,useMemo,Component,createContext,useContext}from"react";
const AppCtx=createContext(null);
const useA=()=>useContext(AppCtx);
import{initializeApp,getApps,getApp}from"firebase/app";
import{getDatabase,ref as _ref,set as _set,update as _update,onValue as _onValue,off as _off,remove as _remove,push as _push,increment as _increment,query as _query,orderByChild as _obc,limitToLast as _ltl}from"firebase/database";
import{getAuth,signInAnonymously as _signInAnon,onAuthStateChanged as _onAuthState}from"firebase/auth";
/* ─── FIREBASE ────────────────────────────────────────────────────────────── */
/* SDK is now bundled (npm `firebase` package) instead of fetched from esm.sh
   at runtime — removes 1-3s of network latency on every page load. */
let _db=null,_auth=null;
async function bootFirebase(cfg){
  try{
    const app=getApps().length?getApp():initializeApp(cfg);
    _db=getDatabase(app);_auth=getAuth(app);
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
  const listenLast=useCallback((path,child,n,cb)=>{
    if(!dbRef.current)return()=>{};
    const q=_query(_ref(dbRef.current,path),_obc(child),_ltl(n));
    _onValue(q,s=>cb(s.val()));
    const u=()=>_off(_ref(dbRef.current,path));
    subs.current.push(u);return u;
  },[state.db]);
  const atomic=useCallback((upd)=>dbRef.current&&_update(_ref(dbRef.current),upd),[state.db]);
  const write=useCallback((p,v)=>dbRef.current&&_set(_ref(dbRef.current,p),v),[state.db]);
  const del=useCallback((p)=>dbRef.current&&_remove(_ref(dbRef.current,p)),[state.db]);
  return{...state,listen,listenLast,atomic,write,del};
}
/* ─── UTILS ───────────────────────────────────────────────────────── */
const ld=()=>new Date().toLocaleDateString("en-CA");
const lp=s=>new Date(s+"T00:00:00");
const wk=d=>{const dt=lp(d),j=new Date(dt.getFullYear(),0,1),n=Math.ceil(((dt-j)/86400000+j.getDay()+1)/7);return`${dt.getFullYear()}-W${String(n).padStart(2,"0")}`;};
const mk=d=>{const dt=lp(d);return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}`;};
const uid6=()=>Math.random().toString(36).slice(2,8);
const tkid=(id)=>`tx_${Date.now()}_${id}_${uid6()}`;
const nextMonthFirst=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth()+1,1);};
const nextDueLabel=()=>nextMonthFirst().toLocaleDateString("en-US",{month:"short",day:"numeric"});
const eodTs=()=>{const d=new Date();d.setHours(23,59,59,999);return d.getTime();};
/* ── CSV helpers (chore spreadsheet export/import) ── */
const csvEsc=v=>{const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;};
function csvParse(text){
  const rows=[];let row=[],cur="",inQ=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(inQ){
      if(ch==='"'){if(text[i+1]==='"'){cur+='"';i++;}else inQ=false;}
      else cur+=ch;
    }else if(ch==='"')inQ=true;
    else if(ch===","){row.push(cur);cur="";}
    else if(ch==="\n"||ch==="\r"){
      if(ch==="\r"&&text[i+1]==="\n")i++;
      row.push(cur);cur="";
      if(row.some(c=>c.trim()!==""))rows.push(row);
      row=[];
    }else cur+=ch;
  }
  row.push(cur);
  if(row.some(c=>c.trim()!==""))rows.push(row);
  return rows;
}
const DAY_MAP={mon:"Mon",monday:"Mon",tue:"Tue",tues:"Tue",tuesday:"Tue",wed:"Wed",wednesday:"Wed",thu:"Thu",thur:"Thu",thurs:"Thu",thursday:"Thu",fri:"Fri",friday:"Fri",sat:"Sat",saturday:"Sat",sun:"Sun",sunday:"Sun"};
const truthyCell=v=>["yes","y","x","true","1","delete"].includes(String(v||"").trim().toLowerCase());
const inc=(n)=>_increment(n);
/* ─── INSTANT-PAINT CACHE ─────────────────────────────────── */
const CACHE_KEY="wh_cache_v1";
const loadCache=()=>{try{return JSON.parse(localStorage.getItem(CACHE_KEY)||"null");}catch{return null;}};
const CACHE0=loadCache();
let _cBuf={},_cT=null;
const saveCache=(k,v)=>{
  _cBuf[k]=v;clearTimeout(_cT);
  _cT=setTimeout(()=>{try{localStorage.setItem(CACHE_KEY,JSON.stringify({...(loadCache()||{}),..._cBuf}));_cBuf={};}catch{}},400);
};
/* ─── BONUS MODAL (top-level so it never remounts mid-typing) ── */
function BonusModalC({m,onClose,onGive}){
  const[amt,setAmt]=useState("0.50");
  const[note,setNote]=useState("");
  if(!m)return null;
  const cents=Math.round(parseFloat(amt)*100);
  const valid=note.trim()&&Number.isFinite(cents)&&cents>0;
  return(<div className="overlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
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
      <button className="btn bg" onClick={onClose}>Cancel</button>
      <button className="btn bp" disabled={!valid} onClick={()=>{onGive(m.kidId,m.kidName,cents,note);onClose();}}>
        Give +{Number.isFinite(cents)&&cents>0?`$${(cents/100).toFixed(2)}`:""}
      </button>
    </div>
  </div></div>);
}
const c$=(v)=>`$${(Math.round(v||0)/100).toFixed(2)}`;
const DOW=d=>lp(d).toLocaleDateString("en-US",{weekday:"short"});
const DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SDAYS=new Set([1,2,3,4]);
const SFOCUS={Monday:"math",Tuesday:"literacy",Wednesday:"math",Thursday:"literacy"};
const sumActive=()=>{const n=new Date(),s=new Date("2026-06-01T00:00:00"),e=new Date("2026-08-15T00:00:00");return n>=s&&n<=e;};
const sumWeeks=()=>{const s=new Date("2026-06-01T00:00:00"),n=new Date();return n<s?0:Math.max(1,Math.ceil((n-s)/(7*86400000)));};
const prevSessDay=()=>{const d=new Date();d.setDate(d.getDate()-1);for(let i=0;i<5;i++){if(SDAYS.has(d.getDay()))return d.toLocaleDateString("en-CA");d.setDate(d.getDate()-1);}return null;};
/* ─── CLEANING POOL: intervals + seed ─────────────────────────── */
const INTERVAL_DAYS={daily:1,weekly:7,biweekly:14,monthly:30,seasonal:90};
const FREQ_OPTS=["daily","weekly","biweekly","monthly","seasonal"];
const FREQ_LBL={daily:"Daily",weekly:"Weekly",biweekly:"Biweekly",monthly:"Monthly",seasonal:"Seasonal"};
function intervalMsOf(c){const d=(c&&c.intervalDays)||INTERVAL_DAYS[c&&c.freq]||7;return d*86400000;}
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
/* ─── SEEDS ───────────────────────────────────────────────────────── */
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
const CSS=`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}:root{--bg:#F0F2F5;--sur:#FFFFFF;--bdr:#E5E7EB;--bdr2:#D1D5DB;--tx:#111827;--tx2:#6B7280;--tx3:#9CA3AF;--pr:#4F46E5;--prl:#EEF2FF;--prd:#4338CA;--gr:#059669;--grl:#ECFDF5;--re:#DC2626;--rel:#FEF2F2;--am:#D97706;--aml:#FFFBEB;--bl:#0891B2;--bll:#ECFEFF;}html,body{background:var(--bg);color:var(--tx);font-family:'Nunito',system-ui,sans-serif;min-height:100vh;min-height:-webkit-fill-available;-webkit-tap-highlight-color:transparent;font-size:14px;}button,input,select,textarea{font-family:inherit;-webkit-appearance:none;}::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px;}.layout{display:flex;min-height:100vh;min-height:-webkit-fill-available;}.sidebar{width:224px;flex-shrink:0;background:var(--sur);border-right:1px solid var(--bdr);display:flex;flex-direction:column;height:100vh;height:-webkit-fill-available;position:sticky;top:0;overflow-y:auto;}.main{flex:1;min-width:0;overflow-y:auto;height:100vh;height:-webkit-fill-available;}.topbar{background:var(--sur);border-bottom:1px solid var(--bdr);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:20;}.content{padding:18px 20px 40px;max-width:960px;}.slogo{padding:16px 14px 12px;font-size:17px;font-weight:900;color:var(--pr);border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px;}.snav{padding:8px;flex:1;}.sdiv{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);padding:8px 10px 3px;}.sni{display:flex;align-items:center;gap:9px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;font-weight:600;padding:8px 10px;border-radius:8px;transition:all .15s;text-align:left;}.sni:hover{background:var(--bg);color:var(--tx);}.sni.act{background:var(--prl);color:var(--pr);}.sbadge{margin-left:auto;background:var(--am);color:#fff;font-size:10px;font-weight:800;border-radius:10px;padding:1px 6px;}.sfoot{padding:10px;border-top:1px solid var(--bdr);}.skid{display:flex;align-items:center;gap:8px;width:100%;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:13px;font-weight:600;padding:7px 10px;border-radius:8px;transition:all .15s;}.skid:hover{background:var(--bg);color:var(--tx);}.skid.act{background:var(--prl);color:var(--pr);}.card{background:var(--sur);border:1px solid var(--bdr);border-radius:12px;padding:16px;}.card+.card{margin-top:12px;}.ch{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--tx3);margin-bottom:10px;}.dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;}.sgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;}.rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;}.btn{display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer;transition:all .15s;font-family:inherit;}.bp{background:var(--pr);color:#fff;}.bp:hover{background:var(--prd);}.bg{background:var(--sur);color:var(--tx);border:1px solid var(--bdr2);}.bg:hover{background:var(--bg);}.bte{background:var(--grl);color:var(--gr);border:1px solid #A7F3D0;}.bco{background:var(--rel);color:var(--re);border:1px solid #FECACA;}.bam{background:var(--aml);color:var(--am);border:1px solid #FCD34D;}.bbl{background:var(--bll);color:var(--bl);border:1px solid #A5F3FC;}.bsm{padding:5px 10px;font-size:12px;}.bxs{padding:3px 8px;font-size:11px;}.ccard{background:var(--sur);border:1px solid var(--bdr);border-radius:10px;padding:11px 13px;display:flex;align-items:center;gap:10px;cursor:pointer;transition:all .15s;margin-bottom:7px;user-select:none;}.ccard:hover{border-color:var(--bdr2);}.ccard.done{opacity:.6;background:var(--bg);}.ccard.pend{border-color:#FCD34D;background:var(--aml);}.ccard.opt{opacity:.7;}.ccard.claimed{border-color:#A5F3FC;background:var(--bll);}.cchk{width:22px;height:22px;border-radius:6px;border:2px solid var(--bdr2);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s;}.cchk.done{background:var(--gr);border-color:var(--gr);}.cchk.pend{background:var(--am);border-color:var(--am);}.cchk.opt{background:var(--prl);border-color:var(--pr);}.ctitle{font-size:13px;font-weight:700;flex:1;min-width:0;}.cdiff{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;flex-shrink:0;}.de{background:#DCFCE7;color:#15803D;}.dm{background:#FEF9C3;color:#854D0E;}.dh{background:#FEE2E2;color:#991B1B;}.cprice{font-size:12px;font-weight:800;color:var(--gr);flex-shrink:0;}.overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:16px;}.modal{background:var(--sur);border-radius:16px;padding:22px;width:100%;max-width:460px;max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.2);}.modal-h{font-size:16px;font-weight:800;margin-bottom:14px;}.fg{display:flex;flex-direction:column;gap:4px;margin-bottom:11px;}.fl{font-size:12px;font-weight:700;color:var(--tx2);}.fi{background:var(--bg);border:1px solid var(--bdr2);border-radius:8px;padding:9px 12px;color:var(--tx);font-size:13px;outline:none;transition:border-color .15s;width:100%;}.fi:focus{border-color:var(--pr);background:var(--sur);}textarea.fi{resize:vertical;min-height:70px;}.frow{display:flex;gap:6px;flex-wrap:wrap;}.fax{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;}.sw-row{display:flex;align-items:center;justify-content:space-between;padding:6px 0;}.sw{position:relative;width:36px;height:20px;cursor:pointer;display:inline-block;}.sw input{opacity:0;width:0;height:0;}.sw-t{position:absolute;inset:0;background:var(--bdr2);border-radius:10px;transition:.2s;}.sw input:checked+.sw-t{background:var(--pr);}.sw-th{position:absolute;left:2px;top:2px;width:16px;height:16px;background:#fff;border-radius:50%;transition:.2s;box-shadow:0 1px 3px rgba(0,0,0,.2);}.sw input:checked~.sw-th{transform:translateX(16px);}.picker{min-height:100vh;min-height:-webkit-fill-available;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);padding:24px;}.pgrid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;max-width:600px;}.pcard{background:var(--sur);border:1.5px solid var(--bdr);border-radius:16px;padding:20px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:all .2s;min-width:110px;}.pcard:hover{border-color:var(--pr);box-shadow:0 4px 16px rgba(79,70,229,.15);transform:translateY(-2px);}.pin-wrap{min-height:100vh;min-height:-webkit-fill-available;display:flex;align-items:center;justify-content:center;background:var(--bg);}.pin-box{background:var(--sur);border-radius:16px;padding:28px 24px;width:min(300px,92vw);display:flex;flex-direction:column;align-items:center;gap:14px;box-shadow:0 8px 30px rgba(0,0,0,.1);}.pin-dots{display:flex;gap:12px;}.pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--bdr2);transition:all .15s;}.pin-dot.filled{background:var(--pr);border-color:var(--pr);}.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;width:100%;}.pin-btn{background:var(--bg);border:1px solid var(--bdr);border-radius:10px;color:var(--tx);font-size:18px;font-weight:700;padding:14px;cursor:pointer;transition:all .15s;}.pin-btn:hover{background:var(--prl);border-color:var(--pr);}.pin-err{font-size:12px;color:var(--re);min-height:16px;}.km-wrap{display:flex;flex-direction:column;min-height:100vh;min-height:-webkit-fill-available;background:var(--bg);}.km-hdr{background:var(--sur);border-bottom:1px solid var(--bdr);padding:13px 15px;display:flex;align-items:center;gap:11px;}.km-tabs{background:var(--sur);border-bottom:1px solid var(--bdr);display:flex;}.km-tab{flex:1;background:none;border:none;color:var(--tx2);cursor:pointer;font-size:12px;font-weight:700;padding:11px 0;transition:all .15s;border-bottom:2px solid transparent;}.km-tab.act{color:var(--pr);border-bottom-color:var(--pr);}.km-body{padding:13px 13px 80px;}.bnav{display:none;position:fixed;bottom:0;left:0;right:0;width:100%;background:var(--sur);border-top:1px solid var(--bdr);z-index:50;}.bnav-in{display:flex;width:100%;padding-bottom:env(safe-area-inset-bottom,0px);}.bnav-btn{flex:1;background:none;border:none;color:var(--tx3);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;min-width:0;}.bnav-btn.act{color:var(--pr);}.bnav-ic{font-size:19px;line-height:1;}.toasts{position:fixed;bottom:24px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:200;pointer-events:none;}.toast{background:var(--sur);border:1px solid var(--bdr);border-radius:10px;padding:10px 16px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(0,0,0,.1);max-width:280px;animation:tIn .2s ease;}@keyframes tIn{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}.t-success{border-color:#A7F3D0;color:var(--gr);}.t-warn{border-color:#FCD34D;color:var(--am);}.t-err{border-color:#FECACA;color:var(--re);}.t-info{border-color:#C7D2FE;color:var(--pr);}.pill{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;}.pill-gr{background:var(--grl);color:var(--gr);}.pill-am{background:var(--aml);color:var(--am);}.pill-pr{background:var(--prl);color:var(--pr);}.pill-re{background:var(--rel);color:var(--re);}.pill-bl{background:var(--bll);color:var(--bl);}.chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;background:var(--bg);color:var(--tx2);border:1px solid var(--bdr);}.pbar{height:7px;background:var(--bg);border-radius:4px;overflow:hidden;margin-top:4px;}.pbar-f{height:100%;border-radius:4px;transition:width .5s ease;}.alog-row{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr);}.alog-row:last-child{border-bottom:none;}.empty{text-align:center;padding:2.5rem 1rem;color:var(--tx3);}.offline-bar{position:fixed;top:0;left:0;right:0;background:#FCD34D;color:#92400E;font-size:12px;font-weight:700;text-align:center;padding:5px;z-index:300;}.sum-card{background:var(--sur);border:1.5px solid #C7D2FE;border-radius:12px;padding:14px;margin-bottom:12px;}.bill-bar{margin-top:8px;}.bill-header{display:flex;justify-content:space-between;align-items:center;font-size:13px;margin-bottom:4px;}.wk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;}.wk-card{background:var(--sur);border:1px solid var(--bdr);border-radius:12px;padding:14px;}.wk-stat{display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:4px 0;border-bottom:1px solid var(--bdr);}.wk-stat:last-child{border-bottom:none;}@media(max-width:680px){.sidebar{display:none;}.bnav{display:flex;}.content{padding:12px 12px 88px;}.topbar{padding:10px 12px;}.dgrid,.rgrid{grid-template-columns:1fr;}.sgrid{grid-template-columns:repeat(2,1fr);}.wk-grid{grid-template-columns:1fr;}}@media print{.sidebar,.bnav,.topbar,.no-print{display:none!important;}.main{height:auto;overflow:visible;}}`;
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
  return(<div className="pin-wrap"><div className="pin-box">
    <div style={{fontSize:22}}>🔑</div>
    <div style={{fontSize:15,fontWeight:800}}>{label}</div>
    <div className="pin-dots">{[0,1,2,3].map(i=><div key={i} className={`pin-dot${pin.length>i?" filled":""}`}/>)}</div>
    <div className="pin-err">{err}</div>
    <div className="pin-pad">{[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((d,i)=>(
      <button key={i} className="pin-btn" style={d===""?{visibility:"hidden"}:{}}
        onClick={()=>d==="⌫"?(setPin(p=>p.slice(0,-1)),setErr("")):(append(String(d)))}>{d}</button>
    ))}</div>
    {onBack&&<button className="btn bg bsm" style={{marginTop:4}} onClick={onBack}>← Back</button>}
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
export default function WattsHub(){
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
    for(const k of["wh_fbcfg","wh3_cfg","wh_fb","wattshub_cfg"]){
      try{const p=JSON.parse(localStorage.getItem(k)||"null");if(p?.apiKey&&p?.databaseURL)return p;}catch{}
    }
    return FIREBASE_CFG;
  });
  const[showCfg,setShowCfg]=useState(false);
  const FB=useFirebase(fbCfg);
  const{ready,uid,online}=FB;
  const[kids,setKids]=useState(()=>Array.isArray(SK)?SK:SK);
  const[parents,setParents]=useState(()=>Array.isArray(SP)?SP:SP);
  const[chores,setChores]=useState(()=>Array.isArray(SC)?SC:SC);
  const[pool,setPool]=useState(()=>Array.isArray([])?[]:[])||[];
  const[combos,setCombos]=useState(()=>Array.isArray([])?[]:[])||[];
  const[comps,setComps]=useState({});
  const[parentLog,setParentLog]=useState({});
  const[storeItems,setStoreItems]=useState(()=>Array.isArray([])?[]:[])||[];
  const[txLog,setTxLog]=useState(()=>Array.isArray([])?[]:[])||[];
  const[bills,setBills]=useState(()=>Array.isArray(SBILLS)?SBILLS:SBILLS);
  const[billPay,setBillPay]=useState({});
  const[allowedUids,setAllowedUids]=useState({});
  const[sumKids,setSumKids]=useState({});
  const[sumSessions,setSumSessions]=useState({});
  const[weeklyCheckins,setWeeklyCheckins]=useState({});
  const[screen,setScreen]=useState("picker");
  const[view,setView]=useState("dashboard");
  const[activeKid,setActiveKid]=useState(null);
  const[activeParent,setActiveParent]=useState(null);
  const[parentMode,setParentMode]=useState(false);
  const[selDate,setSelDate]=useState(ld());
  const[optim,setOptim]=useState({});
  const[choreModal,setChoreModal]=useState(null);
  const[editCompModal,setEditCompModal]=useState(null);
  const[billModal,setBillModal]=useState(null);
  const[payBillModal,setPayBillModal]=useState(null);
  const[poolAddModal,setPoolAddModal]=useState(false);
  const[poolEditModal,setPoolEditModal]=useState(null);
  const[parentTaskModal,setParentTaskModal]=useState(null);
  const[checkinModal,setCheckinModal]=useState(false);
  const[showTimer,setShowTimer]=useState(false);
  const[bonusModal,setBonusModal]=useState(null);
  const[noteModal,setNoteModal]=useState(null);
  const[comboModal,setComboModal]=useState(null);
  const[settleModal,setSettleModal]=useState(null);
  const[csvImport,setCsvImport]=useState(null);
  const{list:toasts,add:toast}=useToasts();
  useEffect(()=>{
    const ms=new Date().setHours(24,0,0,0)-Date.now();
    const t=setTimeout(()=>setSelDate(ld()),ms);
    return()=>clearTimeout(t);
  },[]);
  useEffect(()=>{
    if(!ready)return;
    const u=[
      FB.listen("wh/kids",          v=>{if(v){const a=Object.values(v).filter(Boolean);setKids(a);saveCache("kids",a);}}),
      FB.listen("wh/parents",        v=>{if(v){const a=Object.values(v).filter(Boolean);setParents(a);saveCache("parents",a);}}),
      FB.listen("wh/chores",         v=>{if(v){const a=Object.values(v).filter(Boolean);setChores(a);saveCache("chores",a);}}),
      FB.listen("wh/pool",           v=>{const a=v?Object.values(v).filter(Boolean):[];setPool(a);saveCache("pool",a);}),
      FB.listen("wh/comps",          v=>{setComps(v||{});saveCache("comps",v||{});}),
      FB.listen("wh/parentLog",      v=>setParentLog(v||{})),
      FB.listen("wh/store",          v=>{if(v){const a=Object.values(v).filter(Boolean);setStoreItems(a);saveCache("store",a);}}),
      FB.listenLast("wh/txlog","ts",500,v=>{if(v){const a=Object.values(v).filter(Boolean).sort((a2,b)=>b.ts-a2.ts);setTxLog(a);saveCache("txlog",a.slice(0,400));}}),
      FB.listen("wh/bills",          v=>{if(v){const a=Object.values(v).filter(Boolean);setBills(a);saveCache("bills",a);}}),
      FB.listen("wh/billPayments",   v=>{setBillPay(v||{});saveCache("billPay",v||{});}),
      FB.listen("wh/combos",         v=>{const a=v?Object.values(v).filter(Boolean):[];setCombos(a);saveCache("combos",a);}),
      FB.listen("wh/allowedUids",    v=>setAllowedUids(v||{})),
      FB.listen("wh/summerProgram/kids",v=>setSumKids(v||{})),
      FB.listen("wh/summerSessions", v=>setSumSessions(v||{})),
      FB.listen("wh/weeklyCheckins", v=>setWeeklyCheckins(v||{})),
    ];
    return()=>u.forEach(f=>f&&f());
  },[ready]);
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
    if(!Array.isArray(chores))return 0;
    chores.forEach(c=>{if(!c.requiresApproval)return;if(!Array.isArray(kids))return;kids.forEach(k=>{if(getComp(ld(),c.id,k.id)?.status==="pending")n++;});});
    return n;
  },[chores,kids,comps]);
  const hasPIN=!!localStorage.getItem("wh_pin");
  const isAdmin=uid&&allowedUids[uid]?.role==="admin";
  const myClaimedPool=(actorId)=>Array.isArray(pool)?pool.filter(p=>p.claimedBy===actorId):[];
  const EARN_TYPES=new Set(["chore","pool","summer_bonus","bonus","chore_undo","correction","flash_bonus","combo_bonus"]);
  const weekEarned=(kidId,weekKey)=>
    (Array.isArray(txLog)?txLog:[]).filter(tx=>(tx.actorId===kidId||tx.kidId===kidId)&&EARN_TYPES.has(tx.type)&&wk(new Date(tx.ts).toLocaleDateString("en-CA"))===weekKey).reduce((a,tx)=>a+(tx.cents||0),0);
  const monthEarned=(kidId,monthKey)=>
    (Array.isArray(txLog)?txLog:[]).filter(tx=>(tx.actorId===kidId||tx.kidId===kidId)&&EARN_TYPES.has(tx.type)&&mk(new Date(tx.ts).toLocaleDateString("en-CA"))===monthKey).reduce((a,tx)=>a+(tx.cents||0),0);
  const remainingAssignedCents=(kidId)=>{
    const start=lp(ld());
    const end=new Date(start.getFullYear(),start.getMonth()+1,0);
    let cents=0;
    if(!Array.isArray(chores))return 0;
    for(const d=new Date(start);d<=end;d.setDate(d.getDate()+1)){
      const ds=d.toLocaleDateString("en-CA");
      chores.forEach(c=>{
        const ov=getOverride(c,ds);
        const assigned=ov?.assignedTo||(c.assignedTo||[]);
        if(!assigned.includes(kidId)||!isScheduled(c,ds))return;
        const comp=getComp(ds,c.id,kidId);
        if(comp&&comp.status&&comp.status!=="none")return;
        cents+=(c.priceCents||25);
      });
    }
    return cents;
  };
  const parentContrib=(parentId,key,isWeek)=>{
    let cents=0,tasks=0;
    Object.entries(comps).forEach(([dk,entries])=>{
      const inP=isWeek?wk(dk)===key:mk(dk)===key;
      if(!inP)return;
      Object.values(entries||{}).forEach(cp=>{
        if(cp&&cp.isParentActor&&cp.actorId===parentId&&(cp.status==="done"||cp.status==="approved")){cents+=(cp.cents||0);tasks++;}
      });
    });
    (Array.isArray(pool)?pool:[]).forEach(p=>{
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
  const billProgress=(kidId)=>{
    const mk2=mk(ld());
    return Object.values(billPay[kidId]||{}).filter(p=>p.monthKey===mk2).reduce((a,p)=>a+(p.amountCents||0),0);
  };
  const saveCfg=cfg=>{["wh_fbcfg","wh3_cfg"].forEach(k=>localStorage.setItem(k,JSON.stringify(cfg)));setFbCfg(cfg);setShowCfg(false);};
  const enterKid=id=>{setActiveKid(id);setActiveParent(null);setScreen("kid");setSelDate(ld());};
  const enterParent=()=>{setParentMode(true);setScreen("app");setView("dashboard");setActiveKid(null);setActiveParent(null);};
  const enterParentProfile=id=>{setActiveParent(id);setActiveKid(null);setScreen("kid");setSelDate(ld());};
  const exitToPicker=()=>{setScreen("picker");setParentMode(false);setActiveKid(null);setActiveParent(null);};
  const goPin=()=>setScreen(hasPIN?"pin-verify":"pin-set");
  async function completeChore(choreId,actorId,isParentActor=false,dateKey=null){const chore=chores.find(c=>c.id===choreId);const kid=isParentActor?null:kidById(actorId);if(!chore)return;const dk=dateKey||ld();const key=`${choreId}_${actorId}`;const existing=getComp(dk,choreId,actorId);setOptim(o=>({...o,[key]:true}));try{if(existing&&(existing.status==="done"||existing.status==="approved"||existing.status==="pending")){const wasPaid=existing.status==="done"||existing.status==="approved";const cents=existing.cents||chore.priceCents||25;const upd={[`wh/comps/${dk}/${key}`]:null};if(wasPaid&&!isParentActor&&kid){upd[`wh/kids/${actorId}/balanceCents`]=_increment(-cents);upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"chore_undo",cents:-cents,desc:`Unchecked: ${chore.title}`,ts:Date.now()};}await FB.atomic(upd);toast(`${chore.title} unchecked${wasPaid&&!isParentActor?` (-${c$(cents)})`:""}`, "warn");}else if(!existing||existing.status==="none"){const status=chore.requiresApproval?"pending":"done";const cents=chore.priceCents||25;const isPastDay=dk!==ld();const upd={[`wh/comps/${dk}/${key}`]:{status,ts:Date.now(),choreId,actorId,cents,isParentActor:!!isParentActor,date:dk}};if(status==="done"&&!isParentActor&&kid){upd[`wh/kids/${actorId}/balanceCents`]=_increment(cents);upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"chore",cents,desc:chore.title+(isPastDay?` (${dk})`:""),ts:Date.now()};}await FB.atomic(upd);toast(status==="done"?(isParentActor?`✓ Logged: ${chore.title}`:`+${c$(cents)} for ${kid?.name}!${isPastDay?" (past day)":""}`):`${chore.title} sent for approval`,"success");}}catch(e){console.error("completeChore failed",e);toast(`Save failed: ${e?.code||e?.message||"unknown error"}`,"err");}finally{setOptim(o=>{const n={...o};delete n[key];return n;});}}
  async function approveComp(dk,choreId,actorId){const chore=chores.find(c=>c.id===choreId);const kid=kidById(actorId);const comp=getComp(dk,choreId,actorId);if(!chore||!kid||!comp)return;const cents=comp.cents||chore.priceCents||25;await FB.atomic({[`wh/comps/${dk}/${choreId}_${actorId}/status`]:"approved",[`wh/comps/${dk}/${choreId}_${actorId}/approvedAt`]:Date.now(),[`wh/kids/${actorId}/balanceCents`]:_increment(cents),[`wh/txlog/${tkid(actorId)}`]:{actorId,type:"chore",cents,desc:chore.title+" (approved)",ts:Date.now()},});toast(`Approved +${c$(cents)} for ${kid.name}`,"success");}
  async function rejectComp(dk,choreId,actorId){await FB.atomic({[`wh/comps/${dk}/${choreId}_${actorId}`]:null});toast("Chore rejected","warn");}
  async function editComp(dk,choreId,actorId,{newCents,remove,note,fromTx}){if(fromTx){const kid=kidById(actorId);if(!kid){toast("Kid not found","error");return;}const orig=fromTx.cents||0;const diff=remove?-orig:(newCents-orig);if(diff!==0){await FB.atomic({[`wh/kids/${actorId}/balanceCents`]:_increment(diff),[`wh/txlog/${tkid(actorId)}`]:{actorId,type:"correction",cents:diff,desc:`${remove?"Reversed":"Adjusted"}: ${fromTx.desc||"transaction"}${note?` — ${note}`:""}`,ts:Date.now()},});}toast(remove?"Transaction reversed":"Transaction adjusted","success");setEditCompModal(null);return;}const comp=getComp(dk,choreId,actorId);const kid=kidById(actorId);if(!comp||!kid)return;const origCents=comp.cents||0;if(remove){await FB.atomic({[`wh/comps/${dk}/${choreId}_${actorId}`]:null,[`wh/kids/${actorId}/balanceCents`]:_increment(-origCents),[`wh/txlog/${tkid(actorId)}`]:{actorId,type:"correction",cents:-origCents,desc:`Removed: ${comp.choreId||"chore"}${note?` — ${note}`:""}`,ts:Date.now()},});toast("Completion removed","warn");}else{const diff=newCents-origCents;await FB.atomic({[`wh/comps/${dk}/${choreId}_${actorId}/cents`]:newCents,[`wh/comps/${dk}/${choreId}_${actorId}/editNote`]:note||"",[`wh/comps/${dk}/${choreId}_${actorId}/editedAt`]:Date.now(),[`wh/kids/${actorId}/balanceCents`]:_increment(diff),[`wh/txlog/${tkid(actorId)}`]:{actorId,type:"correction",cents:diff,desc:`Adjusted: ${comp.choreId||"chore"}${note?` — ${note}`:""}`,ts:Date.now()},});toast("Completion updated","success");}setEditCompModal(null);}
  async function claimPool(choreId,actorId){if(myClaimedPool(actorId).length>=5){toast("Max 5 claimed chores — finish one first!","warn");return;}const chore=pool.find(p=>p.id===choreId);if(chore&&!isPoolDue(chore)){toast(`Not due yet — ${dueLabel(chore)}.`,"warn");return;}await FB.atomic({[`wh/pool/${choreId}/claimedBy`]:actorId,[`wh/pool/${choreId}/claimedAt`]:Date.now()});toast("Chore claimed — go do it!","info");}
  async function completePool(choreId,actorId,isParentActor=false){const chore=pool.find(p=>p.id===choreId);if(!chore)return;if(!isPoolDue(chore)){toast("That one isn't due yet.","warn");return;}const kid=isParentActor?null:kidById(actorId);const cents=chore.priceCents||25;const now=Date.now();const upd={[`wh/pool/${choreId}/claimedBy`]:null,[`wh/pool/${choreId}/claimedAt`]:null,[`wh/pool/${choreId}/completedBy`]:actorId,[`wh/pool/${choreId}/completedAt`]:now,};if(chore.recurring){upd[`wh/pool/${choreId}/lastCompletedAt`]=now;}else if(chore.repeating){upd[`wh/pool/${choreId}/completedBy`]=null;upd[`wh/pool/${choreId}/completedAt`]=null;}let flashCents=0;if(chore.flashBonusCents&&chore.flashExpiresAt){if(now<chore.flashExpiresAt&&!isParentActor&&kid)flashCents=chore.flashBonusCents;upd[`wh/pool/${choreId}/flashBonusCents`]=null;upd[`wh/pool/${choreId}/flashExpiresAt`]=null;}const dkNow=ld();const comboWins=[];if(!isParentActor&&kid){for(const cb of combos){if(!cb||cb.active===false)continue;const ids=cb.chorePoolIds||[];if(ids.length<2||!ids.includes(choreId))continue;if(cb.lastPaid?.date===dkNow)continue;const othersDone=ids.filter(x=>x!==choreId).every(oid=>{const oc=pool.find(p2=>p2.id===oid);return oc&&oc.completedBy===actorId&&oc.completedAt&&new Date(oc.completedAt).toLocaleDateString("en-CA")===dkNow;});if(othersDone){comboWins.push(cb);upd[`wh/combos/${cb.id}/lastPaid`]={date:dkNow,actorId,ts:now};}}}const comboCents=comboWins.reduce((a,cb)=>a+(cb.bonusCents||0),0);if(!isParentActor&&kid){upd[`wh/kids/${actorId}/balanceCents`]=_increment(cents+flashCents+comboCents);upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"pool",cents,desc:`Pool: ${chore.title}`,ts:now};if(flashCents)upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"flash_bonus",cents:flashCents,desc:`⚡ Flash bonus: ${chore.title}`,ts:now+1};comboWins.forEach((cb,i)=>{upd[`wh/txlog/${tkid(actorId)}`]={actorId,type:"combo_bonus",cents:cb.bonusCents||0,desc:`🧩 Combo: ${cb.title}`,ts:now+2+i};});}await FB.atomic(upd);const extra=flashCents+comboCents;toast(isParentActor?`✓ Pool chore done: ${chore.title}`:` +${c$(cents+extra)} — pool chore complete!${flashCents?" ⚡ flash bonus!":""}${comboWins.length?` 🧩 combo: ${comboWins.map(cb=>cb.title).join(", ")}!`:""}`,"success");}
  async function unclaimPool(choreId){await FB.atomic({[`wh/pool/${choreId}/claimedBy`]:null,[`wh/pool/${choreId}/claimedAt`]:null});toast("Released back to the pool","info");}
  async function uncompletePool(choreId){const chore=pool.find(p=>p.id===choreId);if(!chore)return;const earner=chore.completedBy;const cents=chore.priceCents||25;const kid=earner?kidById(earner):null;const upd={[`wh/pool/${choreId}/completedBy`]:null,[`wh/pool/${choreId}/completedAt`]:null,[`wh/pool/${choreId}/lastCompletedAt`]:null,[`wh/pool/${choreId}/claimedBy`]:null,[`wh/pool/${choreId}/claimedAt`]:null,};if(kid){upd[`wh/kids/${earner}/balanceCents`]=_increment(-cents);upd[`wh/txlog/${tkid(earner)}`]={actorId:earner,type:"chore_undo",cents:-cents,desc:`Unchecked pool: ${chore.title}`,ts:Date.now()};}await FB.atomic(upd);toast(`${chore.title} unchecked${kid?` (-${c$(cents)})`:""} — back in the pool`,"warn");}
  async function logParentTask(parentId,desc){const dk=ld();const id=`${Date.now()}_${uid6()}`;await FB.write(`wh/parentLog/${dk}/${id}`,{parentId,desc,ts:Date.now()});toast("Task logged ✓","success");}
  async function saveChore(data,oneTimeDate=null){const id=data.id||`c${Date.now()}`;if(oneTimeDate){await FB.atomic({[`wh/chores/${id}/overrides/${oneTimeDate}`]:{assignedTo:data.assignedTo,note:"one-time override"}});}else{await FB.write(`wh/chores/${id}`,{...data,id});}toast(data.id?"Chore updated ✓":"Chore added ✓","success");}
  async function deleteChore(id){await FB.del(`wh/chores/${id}`);toast("Chore deleted","warn");}
  async function addPoolChore(data){const id=`pc${Date.now()}`;await FB.write(`wh/pool/${id}`,{...data,id,claimedBy:null,claimedAt:null,completedBy:null});toast("Pool chore added","success");}
  async function removePoolChore(id){await FB.del(`wh/pool/${id}`);toast("Pool chore removed","warn");}
  async function seedCleaningPool(){const existing=new Set(pool.map(p=>p.id));const upd={};let n=0;CLEAN_SEED.forEach(c=>{if(existing.has(c.id))return;upd[`wh/pool/${c.id}`]={...c,claimedBy:null,claimedAt:null,completedBy:null,completedAt:null,lastCompletedAt:null};n++;});if(!n){toast("Cleaning chores already added","info");return;}await FB.atomic(upd);toast(`Added ${n} cleaning chores ✓`,"success");}
  const CSV_HEADER=["kind","id","title","amount","assigned_to","schedule","days","approval","area","frequency","note","delete"];
  function exportChoresCsv(){const nameOf=id=>(kidById(id)||parById(id))?.name||id;const lines=[CSV_HEADER.join(",")];chores.forEach(c=>lines.push(["assigned",c.id,c.title,((c.priceCents||0)/100).toFixed(2),(c.assignedTo||[]).map(nameOf).join("; "),c.scheduleType||"daily",(c.scheduleDays||[]).join("; "),c.requiresApproval?"yes":"no","","","",""].map(csvEsc).join(",")));pool.forEach(p=>lines.push(["pool",p.id,p.title,((p.priceCents||0)/100).toFixed(2),"","","","",p.area||"",p.recurring?(p.freq||"weekly"):"once",p.note||"",""].map(csvEsc).join(",")));const csv=lines.join("\n");try{const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`wattshub-chores-${ld()}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast(`Exported ${chores.length+pool.length} chores ✓`,"success");}catch(e){toast(`Export failed: ${e?.message||e}`,"error");}}
  function buildCsvImportPlan(text){const rows=csvParse(text);if(!rows.length)return{items:[],errors:["File is empty."]};const header=rows[0].map(h=>h.trim().toLowerCase());const col=name=>header.indexOf(name);if(col("kind")<0||col("title")<0)return{items:[],errors:['Missing required columns — keep the exported header row (needs at least "kind" and "title").']};const nameMap={};[...kids,...parents].forEach(x=>{nameMap[x.name.trim().toLowerCase()]=x.id;nameMap[x.id]=x.id;});const items=[],errors=[];const cell=(r,name)=>{const i=col(name);return i<0?"":String(r[i]??"").trim();};rows.slice(1).forEach((r,ri)=>{const line=ri+2;const kind=cell(r,"kind").toLowerCase();if(kind!=="assigned"&&kind!=="pool"){errors.push(`Line ${line}: kind must be "assigned" or "pool".`);return;}const id=cell(r,"id");const title=cell(r,"title");const del=truthyCell(cell(r,"delete"));if(del){if(!id){errors.push(`Line ${line}: delete needs an id.`);return;}const exists=kind==="assigned"?chores.some(c=>c.id===id):pool.some(p=>p.id===id);if(!exists){errors.push(`Line ${line}: ${kind} chore "${id}" not found — can't delete.`);return;}items.push({action:"delete",kind,id,title:title||id});return;}if(!title){errors.push(`Line ${line}: missing title.`);return;}const amtRaw=cell(r,"amount").replace(/[$\s]/g,"");const amt=amtRaw===""?null:Math.round(parseFloat(amtRaw)*100);if(amtRaw!==""&&(!isFinite(amt)||amt<0)){errors.push(`Line ${line}: bad amount "${cell(r,"amount")}".`);return;}const fields={title};if(amt!=null)fields.priceCents=amt;if(kind==="assigned"){const rawNames=cell(r,"assigned_to");if(rawNames!==""||!id){const ids=[];let bad=null;rawNames.split(/[;+]/).map(s=>s.trim()).filter(Boolean).forEach(nm=>{const found=nameMap[nm.toLowerCase()];if(found)ids.push(found);else bad=nm;});if(bad){errors.push(`Line ${line}: unknown person "${bad}".`);return;}fields.assignedTo=ids;}const sched=cell(r,"schedule").toLowerCase();if(sched&&sched!=="daily"&&sched!=="weekly"){errors.push(`Line ${line}: schedule must be daily or weekly.`);return;}if(sched)fields.scheduleType=sched;const daysRaw=cell(r,"days");if(daysRaw!==""){const days=[];let badD=null;daysRaw.split(/[;,+]/).map(s=>s.trim()).filter(Boolean).forEach(d=>{const dd=DAY_MAP[d.toLowerCase()];if(dd)days.push(dd);else badD=d;});if(badD){errors.push(`Line ${line}: unknown day "${badD}".`);return;}fields.scheduleDays=days;}const app=cell(r,"approval");if(app!=="")fields.requiresApproval=truthyCell(app);const exists=id&&chores.some(c=>c.id===id);if(id&&!exists){errors.push(`Line ${line}: assigned chore id "${id}" not found — clear the id to create a new chore.`);return;}items.push({action:exists?"update":"create",kind,id:id||null,fields,title});}else{const area=cell(r,"area");if(area!==""||!id)fields.area=area;const note=cell(r,"note");if(note!==""||!id)fields.note=note;const freq=cell(r,"frequency").toLowerCase();if(freq!==""){if(freq==="once"||freq==="one-time"||freq==="onetime"){fields.recurring=false;fields.freq=null;fields.intervalDays=null;}else if(FREQ_OPTS.includes(freq)){fields.recurring=true;fields.freq=freq;fields.intervalDays=INTERVAL_DAYS[freq]||7;}else{errors.push(`Line ${line}: frequency must be one of ${FREQ_OPTS.join(", ")}, or "once".`);return;}}const exists=id&&pool.some(p=>p.id===id);if(id&&!exists){errors.push(`Line ${line}: pool chore id "${id}" not found — clear the id to create a new one.`);return;}items.push({action:exists?"update":"create",kind,id:id||null,fields,title});}});return{items,errors};}
  async function applyCsvImport(plan){const upd={};const ts=Date.now();plan.items.forEach((it,i)=>{const base=it.kind==="assigned"?"wh/chores":"wh/pool";if(it.action==="delete"){upd[`${base}/${it.id}`]=null;return;}const id=it.id||`${it.kind==="assigned"?"c":"p"}${ts}_${i}`;Object.entries(it.fields).forEach(([k,v])=>{upd[`${base}/${id}/${k}`]=Array.isArray(v)&&v.length===0?null:v;});upd[`${base}/${id}/id`]=id;});await FB.atomic(upd);toast(`Imported: ${plan.items.filter(i=>i.action==="create").length} new, ${plan.items.filter(i=>i.action==="update").length} updated, ${plan.items.filter(i=>i.action==="delete").length} removed ✓`,"success");setCsvImport(null);}
  async function saveCombo(data){const id=data.id||`cb${Date.now()}`;await FB.write(`wh/combos/${id}`,{...data,id});toast("Combo saved ✓","success");}
  async function removeCombo(id){await FB.del(`wh/combos/${id}`);toast("Combo removed","warn");}
  async function updatePoolChore(id,patch){const upd={};Object.entries(patch).forEach(([k,v])=>{upd[`wh/pool/${id}/${k}`]=v;});if(patch.freq&&!("intervalDays"in patch))upd[`wh/pool/${id}/intervalDays`]=INTERVAL_DAYS[patch.freq]||7;await FB.atomic(upd);toast("Pool chore updated ✓","success");}
  async function payBill(billId,kidId,amountCents){const kid=kidById(kidId);if(!kid||(kid.balanceCents||0)<amountCents){toast("Insufficient balance","warn");return;}const id=`bp_${Date.now()}_${uid6()}`;const monthKey2=mk(ld());await FB.atomic({[`wh/kids/${kidId}/balanceCents`]:(kid.balanceCents||0)-amountCents,[`wh/billPayments/${kidId}/${id}`]:{billId,amountCents,monthKey:monthKey2,date:ld(),ts:Date.now()},[`wh/txlog/${tkid(kidId)}`]:{actorId:kidId,type:"bill",cents:-amountCents,desc:`Bill payment`,ts:Date.now()},});toast(`Payment of ${c$(amountCents)} recorded ✓`,"success");}
  async function settleBill(bill,{carry=false}={}){const kid=kidById(bill.kidId);if(!kid)return;const monthKey2=mk(ld());const paidSoFar=Object.values(billPay[bill.kidId]||{}).filter(p=>p.billId===bill.id&&p.monthKey===monthKey2).reduce((a,p)=>a+(p.amountCents||0),0);const totalDue=(bill.amountCents||0)+(bill.carryoverCents||0);const remaining=Math.max(0,totalDue-paidSoFar);const bal=kid.balanceCents||0;const pay=Math.min(bal,remaining);const shortfall=remaining-pay;const id=`bp_${Date.now()}_${uid6()}`;const upd={[`wh/billPayments/${bill.kidId}/${id}`]:{billId:bill.id,amountCents:pay,monthKey:monthKey2,date:ld(),ts:Date.now(),settle:true,shortfallCents:shortfall},[`wh/bills/${bill.id}/lastSettled`]:{monthKey:monthKey2,paidCents:pay,shortfallCents:shortfall,ts:Date.now()},[`wh/bills/${bill.id}/carryoverCents`]:carry&&shortfall>0?shortfall:null,};if(pay>0){upd[`wh/kids/${bill.kidId}/balanceCents`]=(kid.balanceCents||0)-pay;upd[`wh/txlog/${tkid(bill.kidId)}`]={actorId:bill.kidId,type:"bill",cents:-pay,desc:`Bill settled: ${bill.name}`,ts:Date.now()};}if(shortfall>0){upd[`wh/txlog/${tkid(bill.kidId)}`]={actorId:bill.kidId,type:"bill_shortfall",cents:0,desc:`${bill.name}: family covered ${c$(shortfall)}${carry?" → added to next month":""}`,ts:Date.now()+1};}await FB.atomic(upd);toast(shortfall>0?`Settled ${bill.name} — paid ${c$(pay)}, family covered ${c$(shortfall)}`:`Settled ${bill.name} — paid ${c$(pay)} in full ✓`,"success");setSettleModal(null);}
  async function triggerSummerBonus(kidId){const kid=kidById(kidId);if(!kid)return;const weekK=wk(ld());const sk=sumKids[kidId]||{};if(sk.weekBonusPaidFor===weekK){toast("Bonus already paid for this week","warn");return;}const sessions=Object.values(sumSessions[kidId]||{}).filter(s=>wk(s.date)===weekK);if(sessions.length<4){toast(`Only ${sessions.length}/4 sessions this week — bonus not earned`,"warn");return;}const bonus=100;await FB.atomic({[`wh/kids/${kidId}/balanceCents`]:(kid.balanceCents||0)+bonus,[`wh/summerProgram/kids/${kidId}/weekBonusPaidFor`]:weekK,[`wh/txlog/${tkid(kidId)}`]:{actorId:kidId,type:"summer_bonus",cents:bonus,desc:`Summer weekly bonus — week ${weekK}`,ts:Date.now()},});toast(`+${c$(bonus)} summer bonus for ${kid.name}! 🎉`,"success");}
  async function completeSummerSession(kidId,kidName){const today=ld();const dow=new Date().toLocaleDateString("en-US",{weekday:"long"});const focus=SFOCUS[dow];if(!focus)return;const sessId=`${today}_${uid6()}`;await FB.write(`wh/summerSessions/${kidId}/${sessId}`,{date:today,focus,completedAt:Date.now()});toast(`Summer session logged — ${focus}!`,"success");}
  async function backfillSessions(kidId,kidName,count=4){const today2=new Date();const dayOfWeek=today2.getDay();const upd={};const daysBack=[3,2,1,0];let credited=0;for(let i=0;i<7&&credited<count;i++){const d=new Date(today2);d.setDate(d.getDate()-i);const dow=d.getDay();if(![1,2,3,4].includes(dow))continue;const ds=d.toLocaleDateString("en-CA");const focus=["","math","literacy","math","literacy"][dow];const sessId=`${ds}_backfill_${uid6()}`;const existing=Object.values(sumSessions[kidId]||{}).find(s=>s.date===ds);if(!existing){upd[`wh/summerSessions/${kidId}/${sessId}`]={date:ds,focus,completedAt:Date.now(),backfilled:true};credited++;}}if(Object.keys(upd).length>0){await FB.atomic(upd);toast(`${credited} session${credited!==1?"s":""} credited for ${kidName} ✓`,"success");}else{toast("Sessions already logged for this week","info");}}
  async function giveBonus(kidId,kidName,amountCents,note){const kid=kidById(kidId);if(!kid)return;if(!Number.isFinite(amountCents)||amountCents<=0){toast("Invalid bonus amount","err");return;}const upd={};upd[`wh/kids/${kidId}/balanceCents`]=(kid.balanceCents||0)+amountCents;upd[`wh/txlog/${tkid(kidId)}`]={actorId:kidId,type:"bonus",cents:amountCents,desc:`Bonus: ${note||"Great attitude!"}`,ts:Date.now()};try{await FB.atomic(upd);toast(`+${c$(amountCents)} bonus for ${kidName}! 🌟`,"success");}catch(e){toast("Bonus failed to save — check connection","err");}}
  async function saveNote(kidId,note){await FB.atomic({[`wh/kids/${kidId}/latestNote`]:note});toast("Note saved ✓","success");}
  async function awardXp(kidId,amt){const kid=kidById(kidId);if(!kid)return;await FB.atomic({[`wh/kids/${kidId}/balanceCents`]:(kid.balanceCents||0)+amt,[`wh/txlog/${tkid(kidId)}`]:{actorId:kidId,type:"bonus",cents:amt,desc:"Focus timer bonus",ts:Date.now()}});toast(`+${c$(amt)} for ${kid.name}`,"success");}
  const A={fbCfg,setFbCfg,showCfg,setShowCfg,FB,ready,uid,online,kids,setKids,parents,setParents,chores,setChores,pool,setPool,comps,setComps,parentLog,setParentLog,storeItems,setStoreItems,txLog,setTxLog,bills,setBills,billPay,setBillPay,allowedUids,setAllowedUids,sumKids,setSumKids,sumSessions,setSumSessions,weeklyCheckins,setWeeklyCheckins,screen,setScreen,view,setView,activeKid,setActiveKid,activeParent,setActiveParent,parentMode,setParentMode,selDate,setSelDate,optim,setOptim,choreModal,setChoreModal,editCompModal,setEditCompModal,billModal,setBillModal,payBillModal,setPayBillModal,poolAddModal,setPoolAddModal,poolEditModal,setPoolEditModal,parentTaskModal,setParentTaskModal,checkinModal,setCheckinModal,showTimer,setShowTimer,bonusModal,setBonusModal,noteModal,setNoteModal,toasts,toast,kidById,parById,getComp,isToday,isScheduled,getOverride,pendCount,hasPIN,isAdmin,myClaimedPool,EARN_TYPES,weekEarned,monthEarned,remainingAssignedCents,parentContrib,billProgress,saveCfg,enterKid,enterParent,enterParentProfile,exitToPicker,goPin,completeChore,approveComp,rejectComp,editComp,claimPool,completePool,uncompletePool,logParentTask,saveChore,deleteChore,addPoolChore,removePoolChore,seedCleaningPool,updatePoolChore,payBill,triggerSummerBonus,completeSummerSession,backfillSessions,giveBonus,saveNote,awardXp,combos,comboModal,setComboModal,saveCombo,removeCombo,unclaimPool,settleModal,setSettleModal,settleBill,csvImport,setCsvImport,exportChoresCsv,buildCsvImportPlan,applyCsvImport};
  return(<AppCtx.Provider value={A}><Shell/></AppCtx.Provider>);
}
function Shell(){const{screen,kids,parents,setView,view,activeKid,setActiveKid,selDate,setSelDate,parentMode,setParentMode,enterKid,enterParent,enterParentProfile,exitToPicker,goPin,pendCount,isToday}=useA();if(screen==="picker"){return(<><style>{CSS}</style><div className="picker"><div style={{fontSize:26,fontWeight:900,color:"var(--pr)",marginBottom:4}}>WattsHub</div><div style={{fontSize:14,color:"var(--tx2)",marginBottom:28}}>Who's using the app?</div><div className="pgrid">{Array.isArray(kids)?kids.map(k=><div key={k.id} className="pcard" onClick={()=>enterKid(k.id)}><Av initials={k.initials} colorIdx={k.colorIdx} size={48}/><div style={{fontSize:14,fontWeight:800}}>{k.name}</div><div style={{fontSize:11,color:"var(--tx2)"}}>Age {k.age}</div><div style={{fontSize:13,fontWeight:800,color:"var(--gr)"}}>{c$(k.balanceCents||0)}</div></div>):<div style={{color:"var(--re)"}}>Loading profiles...</div>}{Array.isArray(parents)?parents.map(p=><div key={p.id} className="pcard" onClick={()=>enterParentProfile(p.id)}><Av initials={p.initials} colorIdx={p.colorIdx||4} size={48}/><div style={{fontSize:14,fontWeight:800}}>{p.name}</div><div style={{fontSize:11,color:"var(--tx2)"}}>Parent</div></div>):<div style={{color:"var(--re)"}}>Loading...</div>}<div className="pcard" onClick={goPin}><div style={{width:48,height:48,borderRadius:"50%",background:"var(--aml)",color:"var(--am)",fontSize:22,display:"flex",alignItems:"center",justifyContent:"center"}}>🔑</div><div style={{fontSize:14,fontWeight:800}}>Parent Dashboard</div><div style={{fontSize:11,color:"var(--tx2)"}}>PIN required</div></div></div></div></></div>);
}if(screen==="pin-set")return(<><style>{CSS}</style><PINScreen mode="set" onSuccess={enterParent} onBack={()=>setScreen("picker")}/></>);
if(screen==="pin-verify")return(<><style>{CSS}</style><PINScreen mode="verify" onSuccess={enterParent} onBack={()=>setScreen("picker")}/></>);
return(<div className="layout"><div className="sidebar"><div className="slogo">WattsHub</div><div className="snav"><div className="sdiv">Navigate</div>{[{id:"dashboard",ic:"⊞",l:"Dashboard"},{id:"chores",ic:"✓",l:"Chores"},{id:"pool",ic:"🎯",l:"Pool"},{id:"summary",ic:"📊",l:"Summary"},{id:"bills",ic:"💸",l:"Bills"},{id:"store",ic:"🛍️",l:"Store"},{id:"money",ic:"💵",l:"Money"},{id:"settings",ic:"⚙",l:"Settings"},].map(n=><button key={n.id} className={`ni${view===n.id?" act":""}`} onClick={()=>setView(n.id)}><span className="ic">{n.ic}</span>{n.l}{n.id==="chores"&&pendCount>0?<span className="sbadge">{pendCount}</span>:null}</button>)}<div className="sdiv" style={{marginTop:12}}>Active Kid</div>{Array.isArray(kids)?kids.map(k=><button key={k.id} className={`kni${activeKid===k.id?" act":""}`} onClick={()=>{setActiveKid(k.id);setSelDate(ld());}}><Av initials={k.initials} colorIdx={k.colorIdx} size={20}/>{k.name}<span style={{marginLeft:"auto",fontSize:11,color:"var(--am)",fontWeight:800}}>{c$(k.balanceCents||0)}</span></button>):<div style={{color:"var(--re)",padding:"8px 12px"}}>Loading...</div>}{activeKid&&<button className="kni" style={{color:"var(--tx3)"}} onClick={()=>{setActiveKid(null);setView("dashboard");}}><span>←</span>All kids</button>}</div><div className="sfoot"><div className="swrow" style={{fontSize:11}}><span style={{fontWeight:600}}>Parent mode</span><label className="sw"><input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/><div className="sw-t"/><div className="sw-th"/></label></div><button className="ni" style={{color:"var(--tx3)"}} onClick={exitToPicker}><span className="ic">←</span>Profile picker</button></div></div><main className="main"><div className="topbar"><div><div style={{fontSize:16,fontWeight:800}}>Dashboard</div><div style={{fontSize:11,color:"var(--tx2)",marginTop:1}}>{isToday?ld():"Date selection mode"}</div></div></div><div className="content"><div style={{textAlign:"center",color:"var(--tx3)"}}>✓ App loaded successfully!</div></div></main></div>);
}
export default WattsHub;
function Av({initials,colorIdx,size=38}){const PAL=[{bg:"rgba(124,111,247,0.18)",tx:"#a99df9",ring:"#7c6ff7"},{bg:"rgba(45,212,167,0.18)",tx:"#2dd4a7",ring:"#2dd4a7"},{bg:"rgba(248,122,176,0.18)",tx:"#f87ab0",ring:"#e879a0"},{bg:"rgba(74,158,255,0.18)",tx:"#4a9eff",ring:"#4a9eff"},{bg:"rgba(245,166,35,0.18)",tx:"#f5a623",ring:"#f5a623"}];const c=PAL[colorIdx%PAL.length];return<div style={{width:size,height:size,borderRadius:"50%",background:c.bg,color:c.tx,fontSize:size*.36,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{initials}</div>;}

import { useState, useEffect, useCallback, useMemo } from "react";

/* ─── Firebase loader ───────────────────────────────────────────────────── */
let db=null,fbRef=null,fbSet=null,fbUpdate=null,fbOnValue=null,fbOff=null,fbRemove=null;
async function initFirebase(cfg){
  try{
    const{initializeApp,getApps}=await import("https://esm.sh/firebase/app");
    const{getDatabase,ref,set,update,onValue,off,remove}=await import("https://esm.sh/firebase/database");
    const app=getApps().length?getApps()[0]:initializeApp(cfg);
    db=getDatabase(app);
    fbRef=ref;fbSet=set;fbUpdate=update;fbOnValue=onValue;fbOff=off;fbRemove=remove;
    return true;
  }catch(e){console.warn("Firebase init failed",e);return false;}
}

/* ═══════════════════════════════════════════════════════════════════════════
   STYLES
═══════════════════════════════════════════════════════════════════════════ */
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

/* ── Layout ── */
.app{display:flex;min-height:100vh;}
.sidebar{width:210px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow-y:auto;}
.main{flex:1;min-width:0;overflow-y:auto;height:100vh;}
.topbar{padding:13px 22px;border-bottom:1px solid var(--b1);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:rgba(12,12,20,0.93);backdrop-filter:blur(12px);z-index:20;}
.content{padding:22px;}

/* ── Sidebar ── */
.logo{padding:18px 16px 14px;font-size:18px;font-weight:900;letter-spacing:-.4px;}
.logo span{color:var(--pu);}
.logo em{font-style:normal;font-size:10px;color:var(--tx3);font-weight:500;display:flex;align-items:center;gap:4px;margin-top:3px;}
.sync-dot{width:6px;height:6px;border-radius:50%;background:var(--tx3);transition:background .4s;flex-shrink:0;}
.sync-dot.live{background:var(--te);animation:sdp 1.5s ease infinite;}
@keyframes sdp{0%,100%{opacity:1;}50%{opacity:.3;}}
.nlbl{font-size:9px;font-weight:800;letter-spacing:.1em;color:var(--tx3);text-transform:uppercase;padding:10px 9px 4px;}
.ni{display:flex;align-items:center;gap:9px;padding:8px 9px;border-radius:var(--rs);cursor:pointer;font-size:13px;font-weight:600;color:var(--tx2);transition:all .13s;border:none;background:none;width:100%;text-align:left;}
.ni:hover{background:var(--s2);color:var(--tx1);}
.ni.act{background:rgba(124,111,247,.14);color:var(--pul);}
.ni .ic{width:17px;text-align:center;font-size:14px;flex-shrink:0;}
.kni{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:var(--rs);cursor:pointer;font-size:12px;font-weight:600;color:var(--tx2);transition:all .13s;border:none;background:none;width:100%;text-align:left;}
.kni:hover{background:var(--s2);color:var(--tx1);}
.kni.act{background:var(--s2);color:var(--tx1);}
.sfoot{margin-top:auto;padding:12px 9px;border-top:1px solid var(--b1);}
.swrow{display:flex;align-items:center;justify-content:space-between;padding:5px 9px;}
.av-xs{border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:800;}

/* ── Buttons ── */
.btn{display:inline-flex;align-items:center;gap:5px;padding:7px 15px;border-radius:var(--rs);font-size:13px;font-weight:700;cursor:pointer;transition:all .13s;border:none;}
.btn-p{background:var(--pu);color:#fff;}
.btn-p:hover{background:var(--pud);transform:translateY(-1px);}
.btn-p:disabled{opacity:.4;cursor:default;transform:none;}
.btn-g{background:var(--s2);color:var(--tx2);border:1px solid var(--b2);}
.btn-g:hover{background:var(--s3);color:var(--tx1);}
.btn-sm{padding:5px 10px;font-size:12px;}
.btn-ok{background:rgba(45,212,167,.13);color:var(--te);border:1px solid rgba(45,212,167,.2);}
.btn-ok:hover{background:rgba(45,212,167,.24);}
.btn-no{background:rgba(240,96,96,.09);color:var(--co);border:1px solid rgba(240,96,96,.16);}
.btn-no:hover{background:rgba(240,96,96,.2);}
.btn-am{background:rgba(245,166,35,.13);color:var(--am);border:1px solid rgba(245,166,35,.2);}
.btn-am:hover{background:rgba(245,166,35,.24);}

/* ── Cards / grids ── */
.card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:18px;}
.card0{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:13px;}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;}
.ga{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:13px;}
.sh{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;}
.sht{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--tx2);}
.shc{font-size:10px;color:var(--tx3);}

/* ── Kid card ── */
.kcard{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:18px;cursor:pointer;transition:all .18s;position:relative;overflow:hidden;}
.kcard:hover{border-color:var(--b2);transform:translateY(-2px);box-shadow:var(--sh);}
.kcard.sel{border-color:var(--pu);}
.kglow{position:absolute;top:-50px;right:-50px;width:130px;height:130px;border-radius:50%;opacity:.07;pointer-events:none;}
.av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0;}
.kname{font-size:15px;font-weight:800;margin-bottom:1px;}
.ksub{font-size:11px;color:var(--tx2);margin-bottom:10px;}
.xr{display:flex;justify-content:space-between;font-size:10px;color:var(--tx2);margin-bottom:4px;}
.xt{height:5px;background:var(--s3);border-radius:3px;overflow:hidden;margin-bottom:9px;}
.xf{height:100%;border-radius:3px;transition:width .7s cubic-bezier(.34,1.56,.64,1);}
.chips{display:flex;gap:6px;flex-wrap:wrap;}
.chip{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;background:var(--s2);}

/* ── Bucket bars ── */
.bucket-row{display:flex;gap:8px;margin-top:12px;padding-top:11px;border-top:1px solid var(--b1);}
.bucket{flex:1;text-align:center;}
.bkt-lbl{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;}
.bkt-track{height:6px;background:var(--s3);border-radius:3px;overflow:hidden;margin-bottom:3px;}
.bkt-fill{height:100%;border-radius:3px;transition:width .6s cubic-bezier(.34,1.56,.64,1);}
.bkt-val{font-size:11px;font-weight:700;font-family:var(--fm);}

/* ── Goal bar ── */
.gsec{margin-top:10px;padding-top:10px;border-top:1px solid var(--b1);}
.ghead{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;}
.glbl{font-size:10px;font-weight:800;color:var(--tx2);text-transform:uppercase;letter-spacing:.07em;}
.gval{font-size:11px;font-weight:700;font-family:var(--fm);}
.gtrack{height:6px;background:var(--s3);border-radius:3px;overflow:hidden;margin-bottom:4px;}
.gfill{height:100%;border-radius:3px;transition:width .7s cubic-bezier(.34,1.56,.64,1);}
.gpayout{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px;margin-top:2px;}
.glock{background:rgba(255,255,255,.04);color:var(--tx3);}
.gunlock{background:rgba(245,166,35,.13);color:var(--am);}
.gexceed{background:rgba(45,212,167,.13);color:var(--te);}

/* ── Stat cards ── */
.sg{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:20px;}
.sc{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;}
.sn{font-size:24px;font-weight:900;font-family:var(--fm);}
.sl{font-size:11px;color:var(--tx2);margin-top:2px;}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;}
.bxp{background:rgba(124,111,247,.14);color:var(--pul);}
.bco{background:rgba(245,166,35,.14);color:var(--am);}
.bt{background:var(--s2);color:var(--tx2);}
.bp{background:rgba(245,166,35,.13);color:var(--am);}
.ba{background:rgba(45,212,167,.11);color:var(--te);}
.bb{background:rgba(74,162,255,.11);color:var(--bl);}
.bd1{background:rgba(88,200,140,.1);color:#5cba8e;}
.bd2{background:rgba(45,212,167,.1);color:var(--te);}
.bd3{background:rgba(245,166,35,.1);color:var(--am);}
.bd4{background:rgba(240,96,96,.1);color:var(--co);}
.bd5{background:rgba(232,121,160,.13);color:var(--pk);}

/* ── Chore card ── */
.ccard{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:15px;transition:border-color .13s;}
.ccard:hover{border-color:var(--b2);}
.ccard.cdone{opacity:.52;}
.ccard.cpend{border-color:rgba(245,166,35,.28);background:rgba(245,166,35,.03);}
.ccard.cpast{border-color:rgba(74,162,255,.18);background:rgba(74,162,255,.025);}
.ct{font-size:14px;font-weight:700;line-height:1.3;margin-bottom:7px;}
.cm{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:9px;}
.ca{display:flex;gap:6px;align-items:center;flex-wrap:wrap;}
.mkb{display:flex;align-items:center;gap:5px;padding:7px 14px;border-radius:var(--rs);font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--s2);color:var(--tx2);transition:all .13s;font-family:var(--f);}
.mkb:hover{background:rgba(124,111,247,.13);color:var(--pul);border-color:var(--pu);}
.mkb.done{background:rgba(45,212,167,.09);color:var(--te);border-color:rgba(45,212,167,.18);cursor:default;}
.mkb.pend{background:rgba(245,166,35,.09);color:var(--am);border-color:rgba(245,166,35,.17);cursor:default;}
.sched-days{display:flex;gap:3px;flex-wrap:wrap;margin-bottom:7px;}
.sched-pip{width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;background:rgba(124,111,247,.14);color:var(--pul);}

/* ── Store ── */
.store-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;}
.store-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:16px;transition:all .15s;display:flex;flex-direction:column;gap:10px;}
.store-card:hover{border-color:var(--b2);transform:translateY(-1px);}
.store-card.affordable{border-color:rgba(245,166,35,.25);}
.store-card.bought{border-color:rgba(45,212,167,.25);opacity:.7;}
.store-emoji{font-size:28px;line-height:1;}
.store-name{font-size:13px;font-weight:700;}
.store-desc{font-size:11px;color:var(--tx2);line-height:1.4;}
.store-price{display:flex;align-items:center;gap:5px;font-size:13px;font-weight:800;font-family:var(--fm);color:var(--am);}
.store-cat{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);}
.store-tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap;}
.store-tab{padding:5px 13px;border-radius:var(--rs);font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--s2);color:var(--tx2);transition:all .12s;font-family:var(--f);}
.store-tab.on{background:rgba(124,111,247,.15);border-color:var(--pu);color:var(--pul);}

/* ── Money view ── */
.money-bucket{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:18px;}
.mb-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;}
.mb-name{font-size:13px;font-weight:800;margin-bottom:2px;}
.mb-amt{font-size:28px;font-weight:900;font-family:var(--fm);}
.mb-track{height:9px;background:var(--s3);border-radius:5px;overflow:hidden;margin-bottom:6px;}
.mb-fill{height:100%;border-radius:5px;transition:width .7s cubic-bezier(.34,1.56,.64,1);}
.mb-pct{font-size:11px;color:var(--tx2);}
.alloc-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.alloc-lbl{font-size:12px;font-weight:600;width:52px;flex-shrink:0;}
.alloc-slider{flex:1;}
.alloc-val{font-size:12px;font-weight:700;font-family:var(--fm);width:32px;text-align:right;}
.tx-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--b1);}
.tx-row:last-child{border-bottom:none;}
.tx-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.tx-info{flex:1;}
.tx-title{font-size:13px;font-weight:600;}
.tx-sub{font-size:11px;color:var(--tx2);margin-top:1px;}
.tx-amt{font-size:13px;font-weight:800;font-family:var(--fm);}

/* ── Calendar ── */
.cal{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);overflow:hidden;margin-bottom:20px;}
.calh{display:flex;align-items:center;justify-content:space-between;padding:13px 17px;border-bottom:1px solid var(--b1);}
.calt{font-size:14px;font-weight:800;}
.calnav{display:flex;gap:5px;}
.cnb{background:var(--s2);border:1px solid var(--b2);color:var(--tx2);border-radius:6px;padding:5px 10px;font-size:12px;cursor:pointer;transition:all .11s;font-family:var(--f);}
.cnb:hover{background:var(--s3);color:var(--tx1);}
.cnb:disabled{opacity:.3;cursor:default;}
.cnb.tod{color:var(--pul);border-color:rgba(124,111,247,.28);}
.cgrid{display:grid;grid-template-columns:repeat(7,1fr);}
.cdow{text-align:center;font-size:9px;font-weight:800;color:var(--tx3);text-transform:uppercase;letter-spacing:.06em;padding:7px 2px;}
.cday{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;border-radius:7px;margin:2px;transition:all .11s;font-size:12px;font-weight:600;position:relative;}
.cday:hover{background:var(--s2);}
.cday.oth{color:var(--tx3);}
.cday.tod{background:rgba(124,111,247,.13);color:var(--pul);}
.cday.sel{background:var(--pu)!important;color:#fff!important;}
.cday.fut{color:var(--tx3);cursor:default;pointer-events:none;}
.cday.hact::after{content:'';position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;background:var(--te);}
.cday.hpend::after{background:var(--am);}

/* ── Approval queue ── */
.aqr{display:flex;align-items:center;gap:11px;padding:12px 15px;border-bottom:1px solid var(--b1);}
.aqr:last-child{border-bottom:none;}
.aqi{flex:1;min-width:0;}
.aqt{font-size:13px;font-weight:700;}
.aqs{font-size:11px;color:var(--tx2);margin-top:2px;}
.aqa{display:flex;gap:6px;flex-shrink:0;}

/* ── Modal ── */
.mbd{position:fixed;inset:0;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;z-index:200;animation:mfi .14s ease;padding:14px;}
@keyframes mfi{from{opacity:0;}to{opacity:1;}}
.modal{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:24px;width:480px;max-width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 24px 80px rgba(0,0,0,.65);animation:mmi .22s cubic-bezier(.34,1.2,.64,1);}
@keyframes mmi{from{opacity:0;transform:scale(.94) translateY(14px);}to{opacity:1;transform:none;}}
.mt{font-size:18px;font-weight:900;margin-bottom:18px;}
.fg{margin-bottom:14px;}
.fl{font-size:10px;font-weight:800;color:var(--tx2);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px;}
.fi{width:100%;background:var(--s2);border:1px solid var(--b2);border-radius:var(--rs);padding:9px 11px;color:var(--tx1);font-size:14px;font-family:var(--f);outline:none;transition:border-color .13s;}
.fi:focus{border-color:var(--pu);}
select.fi{cursor:pointer;}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.f3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}
.fax{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;}
.fhint{font-size:10px;color:var(--tx3);margin-top:4px;line-height:1.5;}
.agrid{display:flex;flex-wrap:wrap;gap:6px;}
.achip{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:16px;border:1px solid var(--b2);cursor:pointer;font-size:12px;font-weight:700;background:var(--s2);color:var(--tx2);transition:all .12s;}
.achip.sel{border-color:var(--pu);background:rgba(124,111,247,.13);color:var(--pul);}
.adot{width:6px;height:6px;border-radius:50%;}
.divider{border:none;border-top:1px solid var(--b1);margin:16px 0;}
.smode{display:flex;gap:6px;margin-bottom:10px;}
.smode-btn{flex:1;padding:7px;border-radius:var(--rs);font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--s2);color:var(--tx2);transition:all .13s;text-align:center;font-family:var(--f);}
.smode-btn.on{background:rgba(124,111,247,.15);border-color:var(--pu);color:var(--pul);}
.daypicker{display:flex;gap:5px;flex-wrap:wrap;}
.daychip{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--s2);color:var(--tx2);transition:all .13s;user-select:none;}
.daychip.on{background:rgba(124,111,247,.18);border-color:var(--pu);color:var(--pul);}

/* ── Switch ── */
.sw{position:relative;width:33px;height:18px;cursor:pointer;flex-shrink:0;}
.sw input{opacity:0;width:0;height:0;position:absolute;}
.sw-tr{position:absolute;inset:0;background:var(--s3);border-radius:9px;transition:background .17s;}
.sw input:checked+.sw-tr{background:var(--pu);}
.sw-th{position:absolute;top:2px;left:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .17s;pointer-events:none;}
.sw input:checked~.sw-th{transform:translateX(15px);}

/* ── Toasts / level-up ── */
.twrap{position:fixed;top:18px;right:18px;z-index:1000;display:flex;flex-direction:column;gap:7px;pointer-events:none;}
.toast{background:var(--s1);border:1px solid var(--b2);border-radius:var(--r);padding:11px 15px;display:flex;align-items:center;gap:10px;box-shadow:var(--sh);animation:tIn .3s cubic-bezier(.34,1.56,.64,1) forwards;font-size:13px;font-weight:600;}
.txp{color:var(--pul);font-size:16px;font-weight:900;font-family:var(--fm);}
.tco{color:var(--am);font-size:14px;font-weight:900;font-family:var(--fm);}
.tmsg{color:var(--tx2);}
@keyframes tIn{from{opacity:0;transform:translateX(52px) scale(.9);}to{opacity:1;transform:none;}}
.lvlbd{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:300;pointer-events:none;background:rgba(0,0,0,.52);}
.lvlbox{background:linear-gradient(135deg,#4a42c8,var(--pu));border-radius:var(--rl);padding:30px 50px;text-align:center;box-shadow:0 0 80px rgba(124,111,247,.5);animation:lvlIn .44s cubic-bezier(.34,1.56,.64,1);}
.lvlbox h2{font-size:32px;font-weight:900;color:#fff;}
.lvlbox p{color:rgba(255,255,255,.8);font-size:14px;margin-top:3px;}
@keyframes lvlIn{from{opacity:0;transform:scale(.4);}to{opacity:1;transform:none;}}

/* ── Goal unlock banners ── */
.pbanner{border-radius:var(--r);padding:13px 17px;margin-bottom:13px;display:flex;align-items:center;gap:13px;border:1px solid;}
.pb-g{background:rgba(245,166,35,.07);border-color:rgba(245,166,35,.22);}
.pb-t{background:rgba(45,212,167,.07);border-color:rgba(45,212,167,.2);}

/* ── Purchase success ── */
.buy-banner{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--s1);border:1px solid rgba(245,166,35,.3);border-radius:var(--r);padding:14px 22px;display:flex;align-items:center;gap:12px;box-shadow:var(--sh);z-index:500;animation:buyIn .35s cubic-bezier(.34,1.56,.64,1);}
@keyframes buyIn{from{opacity:0;transform:translateX(-50%) translateY(20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}
.buy-banner .ic{font-size:24px;}
.buy-banner .msg{font-size:14px;font-weight:700;}
.buy-banner .sub{font-size:11px;color:var(--tx2);margin-top:2px;}

/* ── Date nav ── */
.datenav{display:flex;align-items:center;gap:9px;margin-bottom:18px;flex-wrap:wrap;}
.datelbl{flex:1;text-align:center;font-weight:800;font-size:14px;min-width:0;}

/* ── KID MODE ── */
.kid-mode{background:var(--bg);min-height:100vh;display:flex;flex-direction:column;}
.km-header{padding:20px 18px 0;}
.km-hero{display:flex;align-items:center;gap:14px;margin-bottom:20px;}
.km-av{position:relative;}
.km-av-ring{border-radius:50%;padding:3px;background:conic-gradient(var(--pu) var(--prog,0%), var(--s3) 0%);}
.km-name{font-size:22px;font-weight:900;}
.km-lvl{font-size:12px;color:var(--tx2);margin-top:2px;}
.km-coins{display:flex;align-items:center;gap:6px;font-size:18px;font-weight:900;font-family:var(--fm);color:var(--am);}
.km-nav{display:flex;background:var(--s2);border-radius:var(--r);margin:0 18px 18px;padding:4px;gap:4px;}
.km-nav-btn{flex:1;padding:10px 6px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:none;color:var(--tx2);transition:all .13s;text-align:center;font-family:var(--f);}
.km-nav-btn.act{background:var(--s1);color:var(--tx1);box-shadow:0 2px 8px rgba(0,0,0,.3);}
.km-content{flex:1;padding:0 18px 100px;}
.km-chore{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;transition:all .15s;}
.km-chore:active{transform:scale(.98);}
.km-chore.done{opacity:.45;}
.km-chore.pend{border-color:rgba(245,166,35,.3);}
.km-chore-icon{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.km-chore-info{flex:1;min-width:0;}
.km-chore-title{font-size:14px;font-weight:700;margin-bottom:4px;}
.km-chore-title.done{text-decoration:line-through;color:var(--tx3);}
.km-chore-rewards{display:flex;gap:6px;}
.km-chore-reward{display:flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;}
.km-check{width:38px;height:38px;border-radius:50%;border:2px solid var(--b2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15s;flex-shrink:0;background:none;font-size:18px;}
.km-check:hover{border-color:var(--pu);background:rgba(124,111,247,.13);}
.km-check.done{background:var(--te);border-color:var(--te);}
.km-check.pend{background:rgba(245,166,35,.2);border-color:var(--am);}
.km-buckets{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
.km-bucket{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px;text-align:center;}
.km-b-ic{font-size:22px;margin-bottom:6px;}
.km-b-lbl{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--tx2);margin-bottom:4px;}
.km-b-val{font-size:20px;font-weight:900;font-family:var(--fm);}
.km-b-track{height:5px;background:var(--s3);border-radius:3px;overflow:hidden;margin-top:6px;}
.km-b-fill{height:100%;border-radius:3px;}
.km-store-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;transition:all .15s;}
.km-store-card:active{transform:scale(.98);}
.km-store-card.affordable{border-color:rgba(245,166,35,.3);}
.km-store-card.bought{opacity:.5;}
.km-store-icon{font-size:26px;width:46px;text-align:center;flex-shrink:0;}
.km-store-info{flex:1;}
.km-store-name{font-size:14px;font-weight:700;margin-bottom:2px;}
.km-store-desc{font-size:11px;color:var(--tx2);}
.km-store-buy{display:flex;align-items:center;gap:5px;padding:8px 14px;border-radius:var(--rs);font-size:13px;font-weight:800;cursor:pointer;border:none;background:rgba(245,166,35,.15);color:var(--am);transition:all .15s;font-family:var(--f);flex-shrink:0;}
.km-store-buy:hover:not(:disabled){background:rgba(245,166,35,.3);}
.km-store-buy:disabled{opacity:.4;cursor:default;}

/* ── Activity ── */
.actr{display:flex;align-items:center;gap:11px;padding:12px 15px;border-bottom:1px solid var(--b1);}
.actr:last-child{border-bottom:none;}

/* ── Firebase config ── */
.cfgwrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:22px;}
.cfgbox{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:30px;width:500px;max-width:100%;}
.cfglogo{font-size:21px;font-weight:900;margin-bottom:4px;}
.cfglogo span{color:var(--pu);}
.cfgsub{font-size:13px;color:var(--tx2);margin-bottom:22px;line-height:1.65;}
.cfgdemo{background:rgba(124,111,247,.07);border:1px solid rgba(124,111,247,.16);border-radius:var(--rs);padding:10px 13px;font-size:12px;color:var(--pul);margin-bottom:17px;line-height:1.55;}
.gprev{background:var(--s2);border-radius:var(--rs);padding:14px;margin-top:4px;}
.gprev-t{font-size:10px;font-weight:800;color:var(--tx2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:9px;}
.gprev-row{font-size:12px;color:var(--tx2);line-height:1.8;}
.empty{text-align:center;padding:40px 18px;color:var(--tx3);}
.emptyic{font-size:36px;margin-bottom:9px;}
.emptytx{font-size:13px;}

@media(max-width:680px){
  .sidebar{display:none;}
  .sg{grid-template-columns:repeat(2,1fr);}
  .g3{grid-template-columns:1fr;}
  .ga{grid-template-columns:1fr;}
  .content{padding:14px;}
  .f2{grid-template-columns:1fr;}
  .topbar{padding:11px 14px;}
  .aqa{flex-direction:column;}
  .store-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));}
}
`;

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════════════════════════════════════════════ */
const COLORS=[
  {bg:"#7c6ff7",tx:"#fff",gw:"#7c6ff7"},
  {bg:"#2dd4a7",tx:"#081f18",gw:"#2dd4a7"},
  {bg:"#f5a623",tx:"#2a1800",gw:"#f5a623"},
  {bg:"#e879a0",tx:"#fff",gw:"#e879a0"},
];
const DIFF={
  trivial:{lbl:"Trivial",xp:10,cls:"bd1",icon:"✨"},
  easy:   {lbl:"Easy",   xp:25,cls:"bd2",icon:"⚡"},
  medium: {lbl:"Medium", xp:50,cls:"bd3",icon:"🔥"},
  hard:   {lbl:"Hard",   xp:100,cls:"bd4",icon:"💪"},
  boss:   {lbl:"Boss",   xp:250,cls:"bd5",icon:"⚔️"},
};
const FREQ={daily:"Daily",weekly:"Weekly",monthly:"Monthly",once:"One-time"};
const DAY_NAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

// Default store catalog
const DEFAULT_STORE=[
  {id:"s1", name:"30 min extra screen time", desc:"TV, YouTube, games",              emoji:"📱", price:30,  cat:"screen",    parentOnly:false},
  {id:"s2", name:"1 hour extra screen time",  desc:"Your choice of device",           emoji:"🖥️", price:55,  cat:"screen",    parentOnly:false},
  {id:"s3", name:"Stay up 30 min later",      desc:"One night, parent approved",       emoji:"🌙", price:40,  cat:"privilege", parentOnly:false},
  {id:"s4", name:"Pick tonight's dinner",      desc:"Family votes after you choose",    emoji:"🍕", price:45,  cat:"food",      parentOnly:false},
  {id:"s5", name:"Dessert of your choice",     desc:"Sweet treat after dinner",         emoji:"🍦", price:20,  cat:"food",      parentOnly:false},
  {id:"s6", name:"Skip one chore",             desc:"One pass, parent picks which",     emoji:"🎟️", price:80,  cat:"privilege", parentOnly:false},
  {id:"s7", name:"Friend sleepover",           desc:"One friend, weekend only",         emoji:"🏕️", price:120, cat:"social",    parentOnly:false},
  {id:"s8", name:"Movie night pick",           desc:"You choose what the family watches",emoji:"🎬", price:50,  cat:"social",    parentOnly:false},
  {id:"s9", name:"$5 cash",                   desc:"Real money payout",                emoji:"💵", price:100, cat:"cash",      parentOnly:false},
  {id:"s10",name:"$10 cash",                  desc:"Real money payout",                emoji:"💰", price:190, cat:"cash",      parentOnly:false},
  {id:"s11",name:"Bonus XP pack",             desc:"+100 XP added to your level",      emoji:"⭐", price:60,  cat:"xp",        parentOnly:false},
  {id:"s12",name:"Family activity pick",       desc:"Bowling, mini golf, etc.",         emoji:"🎳", price:200, cat:"social",    parentOnly:false},
];

const STORE_CATS=["all","screen","food","privilege","social","cash","xp","custom"];

function xpForLevel(l){return Math.floor(100*Math.pow(l,1.6));}
function levelFromXp(xp){let l=1;while(xp>=xpForLevel(l+1))l++;return l;}
function streakMult(s){if(s>=30)return 2;if(s>=14)return 1.5;if(s>=7)return 1.25;if(s>=4)return 1.1;return 1;}
function dateKey(d){const dt=d||new Date();return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
function today(){return dateKey();}
function isFuture(dk){return dk>today();}
function isPast(dk){return dk<today();}
function parseDate(dk){const[y,m,d]=dk.split('-').map(Number);return new Date(y,m-1,d);}
function weekKey(dk){
  const d=parseDate(dk),jan1=new Date(d.getFullYear(),0,1);
  const wk=Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
  return`${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
}
function ckey(cid,kid){return`${cid}__${kid}`;}

function choreAppearsOnDate(chore,dk){
  const{freq,scheduleType,scheduleDays=[]}=chore;
  if(freq==="weekly"||freq==="monthly"||freq==="once")return true;
  if(scheduleType==="fixed"){
    if(!scheduleDays||!scheduleDays.length)return true;
    return scheduleDays.includes(parseDate(dk).getDay());
  }
  return true;
}
function scheduleLabel(chore){
  if(chore.freq!=="daily"||chore.scheduleType!=="fixed"||!chore.scheduleDays?.length)return null;
  return chore.scheduleDays.map(d=>DAY_NAMES[d]).join(", ");
}

// Split earned coins into buckets based on kid's allocation
function splitCoins(earned, alloc){
  const save  = Math.round(earned * (alloc.save  /100));
  const share = Math.round(earned * (alloc.share /100));
  const spend = earned - save - share;
  return{save,spend,share};
}

// Default allocation
const DEF_ALLOC={save:50,spend:40,share:10};

/* ─── Toast hook ─────────────────────────────────────────────────────────── */
let _tid=0;
function useToasts(){
  const[toasts,setToasts]=useState([]);
  const add=useCallback((msg,xp=null,coins=null)=>{
    const id=++_tid;
    setToasts(t=>[...t,{id,msg,xp,coins}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),2800);
  },[]);
  return{toasts,add};
}

/* ─── Firebase hook ──────────────────────────────────────────────────────── */
function useFB(cfg){
  const[ready,setReady]=useState(false);
  useEffect(()=>{if(cfg)initFirebase(cfg).then(setReady);},[cfg]);
  const write =useCallback(async(p,d)=>{if(!db)return;try{await fbSet(fbRef(db,p),d);}catch(e){console.warn(e);};},[]);
  const merge =useCallback(async(p,d)=>{if(!db)return;try{await fbUpdate(fbRef(db,p),d);}catch(e){console.warn(e);};},[]);
  const listen=useCallback((p,cb)=>{if(!db)return()=>{};const r=fbRef(db,p);fbOnValue(r,s=>cb(s.val()));return()=>fbOff(r);},[]);
  const del   =useCallback(async(p)=>{if(!db)return;try{await fbRemove(fbRef(db,p));}catch(e){console.warn(e);};},[]);
  return{ready,write,merge,listen,del};
}

/* ─── Seed data ──────────────────────────────────────────────────────────── */
const KIDS0=[
  {id:"k1",name:"Jordan",age:17,colorIdx:0,xp:840,streak:14,initials:"JW",
   buckets:{save:420,spend:340,share:80},alloc:{save:50,spend:40,share:10},
   goal:{weeklyXp:200,payoutBase:50,payoutBonus:25,currency:"coins"}},
  {id:"k2",name:"Morgan",age:14,colorIdx:1,xp:560,streak:5, initials:"MW",
   buckets:{save:280,spend:224,share:56},alloc:{save:50,spend:40,share:10},
   goal:{weeklyXp:150,payoutBase:40,payoutBonus:20,currency:"coins"}},
  {id:"k3",name:"Riley", age:9, colorIdx:2,xp:190,streak:1, initials:"RW",
   buckets:{save:95,spend:76,share:19},alloc:{save:50,spend:40,share:10},
   goal:{weeklyXp:80, payoutBase:25,payoutBonus:15,currency:"coins"}},
];
const CHORES0=[
  {id:"c1", title:"Make your bed",        diff:"trivial",freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k3"],      requiresApproval:false},
  {id:"c2", title:"Unload dishwasher",    diff:"easy",   freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k2","k1"],  requiresApproval:false},
  {id:"c6", title:"Set dinner table",     diff:"trivial",freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k3"],       requiresApproval:false},
  {id:"c9", title:"Feed the dog",         diff:"trivial",freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k3"],       requiresApproval:false},
  {id:"c10",title:"Wipe kitchen counters",diff:"easy",   freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k2"],       requiresApproval:false},
  {id:"c7", title:"Tidy bedroom",         diff:"easy",   freq:"daily",  scheduleType:"fixed",scheduleDays:[1,3,5],assignedTo:["k1","k2","k3"],requiresApproval:false},
  {id:"c11",title:"Take out trash",       diff:"easy",   freq:"daily",  scheduleType:"fixed",scheduleDays:[0,3],  assignedTo:["k1"],  requiresApproval:false},
  {id:"c3", title:"Take out recycling",   diff:"easy",   freq:"weekly", scheduleType:"daily",scheduleDays:[],assignedTo:["k1"],        requiresApproval:false},
  {id:"c4", title:"Vacuum living room",   diff:"medium", freq:"weekly", scheduleType:"daily",scheduleDays:[],assignedTo:["k2"],        requiresApproval:true},
  {id:"c5", title:"Clean bathroom",       diff:"hard",   freq:"weekly", scheduleType:"daily",scheduleDays:[],assignedTo:["k1"],        requiresApproval:true},
  {id:"c8", title:"Organize garage",      diff:"boss",   freq:"monthly",scheduleType:"daily",scheduleDays:[],assignedTo:["k1","k2"],   requiresApproval:true},
];

/* ═══════════════════════════════════════════════════════════════════════════
   CONFIG SCREEN
═══════════════════════════════════════════════════════════════════════════ */
function ConfigScreen({onSave,onSkip}){
  const[cfg,setCfg]=useState({apiKey:"",authDomain:"",databaseURL:"",projectId:"",storageBucket:"",messagingSenderId:"",appId:""});
  const fields=[{k:"apiKey",lbl:"API Key"},{k:"authDomain",lbl:"Auth Domain"},{k:"databaseURL",lbl:"Database URL",hint:"Realtime Database URL — ends in .firebaseio.com"},{k:"projectId",lbl:"Project ID"},{k:"storageBucket",lbl:"Storage Bucket"},{k:"messagingSenderId",lbl:"Messaging Sender ID"},{k:"appId",lbl:"App ID"}];
  return(
    <div className="cfgwrap"><div className="cfgbox">
      <div className="cfglogo">Watts<span>Hub</span></div>
      <p className="cfgsub">Connect Firebase for live sync across all devices.</p>
      <div className="cfgdemo"><strong>Setup:</strong> Firebase Console → Project Settings → Your apps → Web → Config. Enable <strong>Realtime Database</strong> and set rules to test mode.</div>
      {fields.map(f=>(
        <div className="fg" key={f.k}>
          <label className="fl">{f.lbl}</label>
          <input className="fi" placeholder={f.lbl} value={cfg[f.k]} onChange={e=>setCfg(c=>({...c,[f.k]:e.target.value}))}/>
          {f.hint&&<div className="fhint">{f.hint}</div>}
        </div>
      ))}
      <div className="fax">
        <button className="btn btn-g" onClick={onSkip}>Demo mode</button>
        <button className="btn btn-p" onClick={()=>onSave(cfg)} disabled={!cfg.apiKey||!cfg.databaseURL}>Connect →</button>
      </div>
    </div></div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════════════════════════ */
export default function WattsHub(){
  // Firebase
  const[fbCfg,setFbCfg]=useState(()=>{try{const s=localStorage.getItem("wh4_cfg");return s?JSON.parse(s):null;}catch{return null;}});
  const[showCfg,setShowCfg]=useState(false);
  const{ready,write,merge,listen,del}=useFB(fbCfg);

  // Data
  const[kids,setKids]=useState(KIDS0);
  const[chores,setChores]=useState(CHORES0);
  const[comps,setComps]=useState({});
  const[weekXp,setWeekXp]=useState({});
  const[storeItems,setStoreItems]=useState(DEFAULT_STORE);
  const[purchases,setPurchases]=useState([]); // [{id,kidId,itemId,ts,coins}]
  const[txLog,setTxLog]=useState([]); // [{id,kidId,type,amount,bucket,desc,ts}]

  // UI
  const[view,setView]=useState("dashboard");
  const[activeKid,setActiveKid]=useState(null);
  const[parentMode,setParentMode]=useState(true);
  const[selDate,setSelDate]=useState(today());
  const[calMonth,setCalMonth]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const[storeCat,setStoreCat]=useState("all");
  const[kmView,setKmView]=useState("chores"); // kid mode tabs

  // Modals
  const[showAddChore,setShowAddChore]=useState(false);
  const[showAddKid,setShowAddKid]=useState(false);
  const[showAddItem,setShowAddItem]=useState(false);
  const[goalKid,setGoalKid]=useState(null);
  const[allocKid,setAllocKid]=useState(null);
  const[editGoal,setEditGoal]=useState({weeklyXp:100,payoutBase:25,payoutBonus:10,currency:"coins"});
  const[editAlloc,setEditAlloc]=useState({save:50,spend:40,share:10});
  const[buyBanner,setBuyBanner]=useState(null);

  // Forms
  const[cf,setCf]=useState({title:"",diff:"easy",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:[],requiresApproval:false});
  const[kf,setKf]=useState({name:"",age:"",initials:""});
  const[itemF,setItemF]=useState({name:"",desc:"",emoji:"🎁",price:50});

  const[lvlUp,setLvlUp]=useState(null);
  const{toasts,add:toast}=useToasts();

  // Firebase listeners
  useEffect(()=>{
    if(!ready)return;
    const u=[
      listen("wh/kids",    v=>{if(v)setKids(Object.values(v));}),
      listen("wh/chores",  v=>{if(v)setChores(Object.values(v));}),
      listen("wh/comps",   v=>{setComps(v||{});}),
      listen("wh/weekXp",  v=>{setWeekXp(v||{});}),
      listen("wh/store",   v=>{if(v)setStoreItems([...DEFAULT_STORE,...Object.values(v)]);}),
      listen("wh/purchases",v=>{if(v)setPurchases(Object.values(v));}),
      listen("wh/txlog",   v=>{if(v)setTxLog(Object.values(v));}),
    ];
    return()=>u.forEach(f=>f());
  },[ready,listen]);

  /* ── Helpers ── */
  const getComp=(dk,cid,kid)=>comps[dk]?.[ckey(cid,kid)]||null;
  const kidById=id=>kids.find(k=>k.id===id);
  const cwXp=kidId=>(weekXp[weekKey(today())]?.[kidId])||0;
  const totalCoins=kid=>(kid.buckets?.save||0)+(kid.buckets?.spend||0)+(kid.buckets?.share||0);

  const pending=()=>{
    const out=[];
    Object.entries(comps).forEach(([dk,dd])=>Object.entries(dd).forEach(([ck,c])=>{
      if(c.status==="pending")out.push({dk,ck,...c});
    }));
    return out.sort((a,b)=>b.ts-a.ts);
  };

  const goalStatus=kid=>{
    if(!kid.goal)return null;
    const{weeklyXp:target,payoutBase,payoutBonus}=kid.goal;
    const wkx=cwXp(kid.id);
    const pct=Math.min(wkx/target,1);
    const unlocked=wkx>=target;
    const exceeded=wkx>target;
    const surplus=Math.max(0,wkx-target);
    const bonusExtra=Math.floor(surplus/(target*0.25))*Math.floor(payoutBonus*0.5);
    const total=payoutBase+(exceeded?payoutBonus+bonusExtra:0);
    return{wkx,target,pct,unlocked,exceeded,surplus,total};
  };

  /* ── Award XP + coins ── */
  async function awardXpCoins(kidId,chore,dk){
    const kid=kids.find(k=>k.id===kidId); if(!kid)return;
    const dayMult=(isPast(dk)&&dk!==today())?0.75:1;
    const mult=streakMult(kid.streak);
    const earned=Math.round(DIFF[chore.diff].xp*mult*dayMult);
    // XP
    const oldLvl=levelFromXp(kid.xp);
    const newXp=kid.xp+earned;
    const newLvl=levelFromXp(newXp);
    // Coins split
    const alloc=kid.alloc||DEF_ALLOC;
    const split=splitCoins(earned,alloc);
    const newBuckets={
      save: (kid.buckets?.save||0)+split.save,
      spend:(kid.buckets?.spend||0)+split.spend,
      share:(kid.buckets?.share||0)+split.share,
    };
    // Weekly XP
    const wk=weekKey(dk);
    const newWkXp=(weekXp[wk]?.[kidId]||0)+earned;
    // TX log entry
    const txEntry={id:"tx"+Date.now(),kidId,type:"earn",amount:earned,desc:chore.title,ts:Date.now(),split};

    setKids(prev=>prev.map(k=>k.id===kidId?{...k,xp:newXp,buckets:newBuckets}:k));
    setWeekXp(prev=>({...prev,[wk]:{...(prev[wk]||{}),[kidId]:newWkXp}}));
    setTxLog(prev=>[txEntry,...prev].slice(0,200));

    if(ready){
      await merge(`wh/kids/${kidId}`,{xp:newXp,buckets:newBuckets});
      await merge(`wh/weekXp/${wk}`,{[kidId]:newWkXp});
      await write(`wh/txlog/${txEntry.id}`,txEntry);
    }
    toast(`${kid.name} +${earned} XP & coins${dayMult<1?" (75%)":""}`,earned,earned);
    if(newLvl>oldLvl){
      setTimeout(()=>{setLvlUp({name:kid.name,level:newLvl});setTimeout(()=>setLvlUp(null),2300);},600);
    }
    const gs=goalStatus({...kid});
    if(gs&&newWkXp>=gs.target&&(weekXp[wk]?.[kidId]||0)<gs.target){
      setTimeout(()=>toast(`🎯 ${kid.name} hit their weekly goal!`),400);
    }
  }

  /* ── Complete chore ── */
  async function completeChore(choreId,kidId,dk){
    const chore=chores.find(c=>c.id===choreId); if(!chore)return;
    const ex=getComp(dk,choreId,kidId);
    if(ex&&ex.status!=="denied")return;
    const status=chore.requiresApproval?"pending":"approved";
    const comp={status,ts:Date.now(),kidId,choreId};
    const path=`wh/comps/${dk}/${ckey(choreId,kidId)}`;
    setComps(prev=>({...prev,[dk]:{...(prev[dk]||{}),[ckey(choreId,kidId)]:comp}}));
    if(ready)await write(path,comp);
    if(status==="approved")await awardXpCoins(kidId,chore,dk);
    else toast("Submitted for approval!");
  }

  async function approveComp(dk,ck,kidId,choreId){
    const comp={...(comps[dk]?.[ck]||{}),status:"approved"};
    setComps(prev=>({...prev,[dk]:{...(prev[dk]||{}),[ck]:comp}}));
    if(ready)await write(`wh/comps/${dk}/${ck}`,comp);
    const chore=chores.find(c=>c.id===choreId);
    if(chore)await awardXpCoins(kidId,chore,dk);
  }

  async function denyComp(dk,ck){
    const comp={...(comps[dk]?.[ck]||{}),status:"denied"};
    setComps(prev=>({...prev,[dk]:{...(prev[dk]||{}),[ck]:comp}}));
    if(ready)await write(`wh/comps/${dk}/${ck}`,comp);
    toast("Task denied.");
  }

  /* ── Buy store item ── */
  async function buyItem(item,kidId){
    const kid=kidById(kidId); if(!kid)return;
    const spendBal=kid.buckets?.spend||0;
    if(spendBal<item.price){toast("Not enough coins in Spend bucket!");return;}
    const newBuckets={...kid.buckets,spend:spendBal-item.price};
    const purchase={id:"p"+Date.now(),kidId,itemId:item.id,ts:Date.now(),coins:item.price,itemName:item.name};
    const txEntry={id:"tx"+Date.now(),kidId,type:"spend",amount:-item.price,desc:item.name,ts:Date.now(),bucket:"spend"};
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,buckets:newBuckets}:k));
    setPurchases(prev=>[purchase,...prev]);
    setTxLog(prev=>[txEntry,...prev].slice(0,200));
    if(ready){
      await merge(`wh/kids/${kidId}`,{buckets:newBuckets});
      await write(`wh/purchases/${purchase.id}`,purchase);
      await write(`wh/txlog/${txEntry.id}`,txEntry);
    }
    setBuyBanner({name:item.name,emoji:item.emoji,coins:item.price});
    setTimeout(()=>setBuyBanner(null),3000);
  }

  /* ── Add chore ── */
  async function addChore(){
    if(!cf.title.trim()||!cf.assignedTo.length)return;
    const id="c"+Date.now();
    const c={...cf,id,title:cf.title.trim(),scheduleDays:cf.freq==="daily"&&cf.scheduleType==="fixed"?cf.scheduleDays:[]};
    setChores(p=>[...p,c]);
    if(ready)await write(`wh/chores/${id}`,c);
    setCf({title:"",diff:"easy",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:[],requiresApproval:false});
    setShowAddChore(false);toast("Chore added!");
  }

  /* ── Add kid ── */
  async function addKid(){
    if(!kf.name.trim())return;
    const id="k"+Date.now();
    const colorIdx=kids.length%COLORS.length;
    const initials=kf.initials.trim()||kf.name.slice(0,2).toUpperCase();
    const k={id,name:kf.name.trim(),age:parseInt(kf.age)||10,colorIdx,xp:0,streak:0,initials,buckets:{save:0,spend:0,share:0},alloc:DEF_ALLOC,goal:{weeklyXp:100,payoutBase:25,payoutBonus:10,currency:"coins"}};
    setKids(p=>[...p,k]);
    if(ready)await write(`wh/kids/${id}`,k);
    setKf({name:"",age:"",initials:""});setShowAddKid(false);toast(`${k.name} joined!`);
  }

  /* ── Add store item ── */
  async function addStoreItem(){
    if(!itemF.name.trim())return;
    const id="custom_"+Date.now();
    const item={...itemF,id,cat:"custom",parentOnly:false};
    setStoreItems(prev=>[...prev,item]);
    if(ready)await write(`wh/store/${id}`,item);
    setItemF({name:"",desc:"",emoji:"🎁",price:50});setShowAddItem(false);toast("Store item added!");
  }

  /* ── Save goal ── */
  async function saveGoal(kidId){
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,goal:editGoal}:k));
    if(ready)await merge(`wh/kids/${kidId}`,{goal:editGoal});
    setGoalKid(null);toast("Goal updated!");
  }

  /* ── Save allocation ── */
  async function saveAlloc(kidId){
    const alloc={...editAlloc};
    // Ensure sums to 100
    const total=alloc.save+alloc.spend+alloc.share;
    if(total!==100)alloc.spend=100-alloc.save-alloc.share;
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,alloc}:k));
    if(ready)await merge(`wh/kids/${kidId}`,{alloc});
    setAllocKid(null);toast("Allocation updated!");
  }

  /* ── Toggle schedule day ── */
  function toggleDay(dow){
    setCf(f=>{const days=f.scheduleDays.includes(dow)?f.scheduleDays.filter(d=>d!==dow):[...f.scheduleDays,dow].sort((a,b)=>a-b);return{...f,scheduleDays:days};});
  }

  /* ── Calendar ── */
  function calCells(){
    const{y,m}=calMonth;
    const first=new Date(y,m,1).getDay();
    const dim=new Date(y,m+1,0).getDate();
    const prev=new Date(y,m,0).getDate();
    const cells=[];
    for(let i=first-1;i>=0;i--)cells.push({day:prev-i,cur:false,m:m===0?11:m-1,y:m===0?y-1:y});
    for(let i=1;i<=dim;i++)cells.push({day:i,cur:true,m,y});
    for(let i=1;cells.length<42;i++)cells.push({day:i,cur:false,m:m===11?0:m+1,y:m===11?y+1:y});
    return cells;
  }
  function cellDk(cell){return`${cell.y}-${String(cell.m+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`;}
  const dayHasAct=dk=>!!(comps[dk]&&Object.values(comps[dk]).some(c=>c.status==="approved"));
  const dayHasPend=dk=>!!(comps[dk]&&Object.values(comps[dk]).some(c=>c.status==="pending"));

  function shiftDate(dk,delta){
    const d=parseDate(dk);d.setDate(d.getDate()+delta);
    const nk=dateKey(d);if(!isFuture(nk)){setSelDate(nk);setView("chores");}
  }

  /* ══════════════════════════════════════════════════════════════════════
     COMPONENTS
  ═══════════════════════════════════════════════════════════════════════ */
  function Av({kid,size=48,fs=16}){
    const c=COLORS[kid.colorIdx];
    return <div className="av" style={{width:size,height:size,background:c.bg,color:c.tx,fontSize:fs}}>{kid.initials}</div>;
  }

  function BucketRow({kid}){
    const bk=kid.buckets||{save:0,spend:0,share:0};
    const total=Math.max(1,bk.save+bk.spend+bk.share);
    return(
      <div className="bucket-row">
        {[{k:"save",lbl:"Save",c:"#2dd4a7"},{k:"spend",lbl:"Spend",c:"#f5a623"},{k:"share",lbl:"Share",c:"#e879a0"}].map(b=>(
          <div className="bucket" key={b.k}>
            <div className="bkt-lbl" style={{color:b.c}}>{b.lbl}</div>
            <div className="bkt-track"><div className="bkt-fill" style={{width:`${(bk[b.k]/total)*100}%`,background:b.c}}/></div>
            <div className="bkt-val" style={{color:b.c}}>{bk[b.k]}</div>
          </div>
        ))}
      </div>
    );
  }

  function GoalBar({kid}){
    const gs=goalStatus(kid); if(!gs)return null;
    const{pct,wkx,target,unlocked,exceeded,total}=gs;
    return(
      <div className="gsec">
        <div className="ghead"><span className="glbl">Weekly goal</span><span className="gval" style={{color:exceeded?"var(--te)":unlocked?"var(--am)":"var(--tx2)"}}>{wkx}/{target} XP</span></div>
        <div className="gtrack"><div className="gfill" style={{width:`${pct*100}%`,background:exceeded?"var(--te)":unlocked?"var(--am)":"var(--pu)"}}/></div>
        <span className={`gpayout ${exceeded?"gexceed":unlocked?"gunlock":"glock"}`}>
          {exceeded?"⚡":unlocked?"🎯":"🎯"} {unlocked?total:kid.goal.payoutBase} {kid.goal.currency}
          {!unlocked&&<span style={{marginLeft:3,opacity:.6}}>locked</span>}
          {exceeded&&<span style={{marginLeft:4,opacity:.7}}>(+{gs.surplus} over!)</span>}
        </span>
      </div>
    );
  }

  function KidCard({kid,onClick}){
    const c=COLORS[kid.colorIdx];
    const lvl=levelFromXp(kid.xp);
    const xpThis=kid.xp-xpForLevel(lvl);
    const xpNeed=xpForLevel(lvl+1)-xpForLevel(lvl);
    const pct=Math.min(xpThis/xpNeed,1);
    const mult=streakMult(kid.streak);
    const todayCt=Object.values(comps[today()]||{}).filter(c=>c.kidId===kid.id&&c.status==="approved").length;
    return(
      <div className={`kcard${activeKid===kid.id?" sel":""}`} onClick={onClick}>
        <div className="kglow" style={{background:c.gw}}/>
        <div style={{display:"flex",alignItems:"flex-start",gap:11,marginBottom:12}}>
          <div style={{position:"relative"}}>
            <Av kid={kid}/>
            <div style={{position:"absolute",bottom:-2,right:-2,background:c.bg,color:c.tx,fontSize:9,fontWeight:900,borderRadius:8,padding:"1px 5px",border:"2px solid var(--bg)"}}>{lvl}</div>
          </div>
          <div style={{flex:1}}>
            <div className="kname">{kid.name}</div>
            <div className="ksub">Age {kid.age} · {kid.xp.toLocaleString()} XP</div>
            <div className="chips">
              <span className="chip" style={{color:kid.streak>=7?"var(--am)":"var(--tx2)"}}>{kid.streak>=7?"🔥":"⚡"}{kid.streak}d</span>
              {mult>1&&<span className="chip" style={{color:"var(--am)"}}>{mult}x</span>}
              <span className="chip" style={{color:"var(--te)"}}>{todayCt} done</span>
              <span className="chip" style={{color:"var(--am)"}}>🪙 {totalCoins(kid)}</span>
            </div>
          </div>
          {parentMode&&<div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
            <button className="btn btn-g btn-sm" onClick={e=>{e.stopPropagation();setEditGoal(kid.goal||{weeklyXp:100,payoutBase:25,payoutBonus:10,currency:"coins"});setGoalKid(kid.id);}}>Goals</button>
            <button className="btn btn-g btn-sm" onClick={e=>{e.stopPropagation();setEditAlloc(kid.alloc||DEF_ALLOC);setAllocKid(kid.id);}}>Alloc</button>
          </div>}
        </div>
        <div className="xr"><span>Lv {lvl} → {lvl+1}</span><span>{xpThis}/{xpNeed} XP</span></div>
        <div className="xt"><div className="xf" style={{width:`${pct*100}%`,background:c.bg}}/></div>
        <BucketRow kid={kid}/>
        <GoalBar kid={kid}/>
      </div>
    );
  }

  function ChoreCard({chore,dk,kidMode=false}){
    const viewDk=dk||selDate;
    const past=isPast(viewDk)&&viewDk!==today();
    const myComp=activeKid?getComp(viewDk,chore.id,activeKid):null;
    const myStatus=myComp?.status||null;
    const allSt=chore.assignedTo.map(kid=>({kid,comp:getComp(viewDk,chore.id,kid)}));
    const cardDone=activeKid?myStatus==="approved":allSt.every(s=>s.comp?.status==="approved");
    const cardPend=activeKid?myStatus==="pending":allSt.some(s=>s.comp?.status==="pending");
    const sLabel=scheduleLabel(chore);
    const xp=DIFF[chore.diff].xp;

    if(kidMode){
      return(
        <div className={`km-chore${cardDone?" done":""}${cardPend?" pend":""}`} >
          <div className="km-chore-icon" style={{background:cardDone?"rgba(45,212,167,.1)":cardPend?"rgba(245,166,35,.1)":"var(--s2)"}}>
            {DIFF[chore.diff].icon}
          </div>
          <div className="km-chore-info">
            <div className={`km-chore-title${cardDone?" done":""}`}>{chore.title}</div>
            <div className="km-chore-rewards">
              <span className="km-chore-reward" style={{background:"rgba(124,111,247,.14)",color:"var(--pul)"}}>+{xp}{past?" (75%)":""} XP</span>
              <span className="km-chore-reward" style={{background:"rgba(245,166,35,.14)",color:"var(--am)"}}>🪙 +{xp}{past?" (75%)":""}</span>
              {sLabel&&<span className="km-chore-reward" style={{background:"rgba(124,111,247,.08)",color:"var(--tx2)"}}>{sLabel}</span>}
            </div>
          </div>
          <button className={`km-check${cardDone?" done":cardPend?" pend":""}`}
            onClick={()=>{if(!cardDone&&!cardPend)completeChore(chore.id,activeKid,viewDk);}}>
            {cardDone?"✓":cardPend?"⏳":""}
          </button>
        </div>
      );
    }

    return(
      <div className={`ccard${cardDone?" cdone":""}${cardPend?" cpend":""}${past&&!cardDone&&!cardPend?" cpast":""}`}>
        <div className="ct" style={cardDone?{textDecoration:"line-through",color:"var(--tx3)"}:{}}>{chore.title}</div>
        {sLabel&&<div className="sched-days">{chore.scheduleDays.map(d=><div key={d} className="sched-pip">{DAY_NAMES[d].slice(0,1)}</div>)}</div>}
        <div className="cm">
          <span className="badge bxp">+{xp} XP{past&&!cardDone?" (75%)":""}</span>
          <span className="badge bco">🪙 +{xp}</span>
          <span className={`badge ${DIFF[chore.diff].cls}`}>{DIFF[chore.diff].lbl}</span>
          {sLabel?<span className="badge" style={{background:"rgba(124,111,247,.1)",color:"var(--pul)"}}>{sLabel}</span>:<span className="badge bt">{chore.freq==="daily"?"Every day":FREQ[chore.freq]||chore.freq}</span>}
          {cardPend&&<span className="badge bp">⏳ Pending</span>}
          {cardDone&&<span className="badge ba">✓ Done</span>}
          {past&&!cardDone&&!cardPend&&<span className="badge bb">Past day</span>}
        </div>
        {!activeKid&&(
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            {chore.assignedTo.map(kidId=>{
              const k=kidById(kidId); if(!k)return null;
              const cc=COLORS[k.colorIdx];const comp=getComp(viewDk,chore.id,kidId);
              return <span key={kidId} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:comp?.status==="approved"?"rgba(45,212,167,.1)":comp?.status==="pending"?"rgba(245,166,35,.1)":"var(--s2)",color:comp?.status==="approved"?"var(--te)":comp?.status==="pending"?"var(--am)":"var(--tx2)"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:cc.bg,display:"inline-block"}}/>
                {k.name}{comp?.status==="approved"?" ✓":comp?.status==="pending"?" ⏳":""}
              </span>;
            })}
          </div>
        )}
        {chore.requiresApproval&&!cardDone&&!cardPend&&<div style={{fontSize:10,color:"var(--tx3)",marginBottom:7}}>Requires approval</div>}
        <div className="ca">
          {activeKid&&!cardDone&&!cardPend&&<button className="mkb" onClick={()=>completeChore(chore.id,activeKid,viewDk)}>✓ {past?"Mark done (75% XP)":"Mark complete"}</button>}
          {activeKid&&cardPend&&<button className="mkb pend">⏳ Awaiting approval</button>}
          {activeKid&&cardDone&&<button className="mkb done">✓ Completed</button>}
          {!activeKid&&cardPend&&parentMode&&allSt.filter(s=>s.comp?.status==="pending").map(s=>{
            const k=kidById(s.kid); if(!k)return null;
            return <button key={s.kid} className="btn btn-ok btn-sm" onClick={()=>approveComp(viewDk,ckey(chore.id,s.kid),s.kid,chore.id)}>✓ {k.name}</button>;
          })}
          {!activeKid&&parentMode&&!cardDone&&!cardPend&&chore.assignedTo.map(kidId=>{
            const k=kidById(kidId); if(!k)return null;
            const comp=getComp(viewDk,chore.id,kidId);
            if(comp&&comp.status!=="denied")return null;
            return <button key={kidId} className="btn btn-g btn-sm" onClick={()=>completeChore(chore.id,kidId,viewDk)}>✓ {k.name}{past?" (75%)":""}</button>;
          })}
        </div>
      </div>
    );
  }

  function Calendar(){
    const cells=calCells();const{y,m}=calMonth;
    const now=new Date();const canNext=y<now.getFullYear()||(y===now.getFullYear()&&m<now.getMonth());
    return(
      <div className="cal">
        <div className="calh">
          <div className="calt">{MONTHS[m]} {y}</div>
          <div className="calnav">
            <button className="cnb" onClick={()=>setCalMonth(({y,m})=>m===0?{y:y-1,m:11}:{y,m:m-1})}>‹</button>
            <button className="cnb tod" onClick={()=>{const d=new Date();setCalMonth({y:d.getFullYear(),m:d.getMonth()});setSelDate(today());}}>Today</button>
            <button className="cnb" disabled={!canNext} onClick={()=>{if(canNext)setCalMonth(({y,m})=>m===11?{y:y+1,m:0}:{y,m:m+1});}}>›</button>
          </div>
        </div>
        <div style={{padding:"0 8px 8px"}}>
          <div className="cgrid">
            {DAY_NAMES.map(d=><div key={d} className="cdow">{d}</div>)}
            {cells.map((cell,i)=>{
              const dk=cellDk(cell);const fut=isFuture(dk);
              return <div key={i} className={`cday${!cell.cur?" oth":""}${dk===today()?" tod":""}${selDate===dk&&cell.cur?" sel":""}${fut?" fut":""}${dayHasPend(dk)?" hpend":dayHasAct(dk)?" hact":""}`}
                onClick={()=>{if(!fut&&cell.cur){setSelDate(dk);setView("chores");}}}>{cell.day}</div>;
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     STORE VIEW (parent + all-kid)
  ═══════════════════════════════════════════════════════════════════════ */
  function StoreView(){
    const kid=activeKid?kidById(activeKid):null;
    const spendBal=kid?.buckets?.spend||0;
    const filtered=storeCat==="all"?storeItems:storeItems.filter(i=>i.cat===storeCat);
    return(
      <>
        <div className="store-tabs">
          {STORE_CATS.map(c=><button key={c} className={`store-tab${storeCat===c?" on":""}`} onClick={()=>setStoreCat(c)}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>)}
        </div>
        {kid&&<div style={{background:"var(--s2)",borderRadius:"var(--rs)",padding:"10px 14px",marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:13,fontWeight:700}}>🪙 Spend balance</span>
          <span style={{fontSize:18,fontWeight:900,fontFamily:"var(--fm)",color:"var(--am)"}}>{spendBal} coins</span>
        </div>}
        <div className="store-grid">
          {filtered.map(item=>{
            const canAfford=!kid||(kid.buckets?.spend||0)>=item.price;
            const bought=kid&&purchases.some(p=>p.kidId===kid.id&&p.itemId===item.id);
            return(
              <div key={item.id} className={`store-card${canAfford&&kid?" affordable":""}${bought?" bought":""}`}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div className="store-emoji">{item.emoji}</div>
                  <div className="store-cat">{item.cat}</div>
                </div>
                <div>
                  <div className="store-name">{item.name}</div>
                  {item.desc&&<div className="store-desc">{item.desc}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"auto"}}>
                  <div className="store-price">🪙 {item.price}</div>
                  {kid&&!bought&&<button className="btn btn-am btn-sm" disabled={!canAfford} onClick={()=>buyItem(item,kid.id)}>
                    {canAfford?"Buy":"Can't afford"}
                  </button>}
                  {kid&&bought&&<span style={{fontSize:11,color:"var(--te)",fontWeight:700}}>✓ Redeemed</span>}
                </div>
              </div>
            );
          })}
        </div>
        {parentMode&&<div style={{marginTop:20}}><button className="btn btn-g" onClick={()=>setShowAddItem(true)}>+ Add custom item</button></div>}
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     MONEY VIEW
  ═══════════════════════════════════════════════════════════════════════ */
  function MoneyView(){
    const kid=activeKid?kidById(activeKid):null;
    if(!kid)return(
      <>
        <div className="g3" style={{marginBottom:22}}>
          {kids.map(k=>{
            const bk=k.buckets||{save:0,spend:0,share:0};
            return <div className="card" key={k.id} style={{cursor:"pointer"}} onClick={()=>{setActiveKid(k.id);setView("money");}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                <Av kid={k} size={38} fs={13}/>
                <div><div style={{fontWeight:800,fontSize:14}}>{k.name}</div><div style={{fontSize:11,color:"var(--tx2)"}}>{totalCoins(k)} coins total</div></div>
              </div>
              <BucketRow kid={k}/>
            </div>;
          })}
        </div>
      </>
    );
    const bk=kid.buckets||{save:0,spend:0,share:0};
    const total=Math.max(1,bk.save+bk.spend+bk.share);
    const bucketDef=[
      {k:"save", lbl:"Save",  ic:"🏦",c:"#2dd4a7",desc:"Working toward a big goal"},
      {k:"spend",lbl:"Spend", ic:"🛒",c:"#f5a623",desc:"Available in the family store"},
      {k:"share",lbl:"Share", ic:"💝",c:"#e879a0",desc:"To give or donate"},
    ];
    const kidTxs=txLog.filter(t=>t.kidId===kid.id).slice(0,30);
    return(
      <>
        <div className="g3" style={{marginBottom:20}}>
          {bucketDef.map(b=>(
            <div className="money-bucket" key={b.k}>
              <div className="mb-top">
                <div><div className="mb-name">{b.ic} {b.lbl}</div><div style={{fontSize:11,color:"var(--tx2)"}}>{b.desc}</div></div>
                <div className="mb-amt" style={{color:b.c}}>{bk[b.k]}</div>
              </div>
              <div className="mb-track"><div className="mb-fill" style={{width:`${(bk[b.k]/total)*100}%`,background:b.c}}/></div>
              <div className="mb-pct" style={{color:b.c}}>{Math.round((bk[b.k]/total)*100)}% of total</div>
            </div>
          ))}
        </div>
        {parentMode&&<div className="card" style={{marginBottom:20}}>
          <div style={{fontWeight:800,fontSize:14,marginBottom:14}}>Coin allocation</div>
          {[{k:"save",lbl:"Save",c:"#2dd4a7"},{k:"spend",lbl:"Spend",c:"#f5a623"},{k:"share",lbl:"Share",c:"#e879a0"}].map(b=>(
            <div className="alloc-row" key={b.k}>
              <span className="alloc-lbl" style={{color:b.c}}>{b.lbl}</span>
              <input className="alloc-slider" type="range" min={0} max={100} value={kid.alloc?.[b.k]??DEF_ALLOC[b.k]} onChange={e=>{
                const v=+e.target.value;
                setKids(prev=>prev.map(k=>k.id===kid.id?{...k,alloc:{...k.alloc,[b.k]:v}}:k));
              }}/>
              <span className="alloc-val" style={{color:b.c}}>{kid.alloc?.[b.k]??DEF_ALLOC[b.k]}%</span>
            </div>
          ))}
          <div style={{fontSize:11,color:"var(--tx3)",marginTop:4}}>Total: {Object.values(kid.alloc||DEF_ALLOC).reduce((a,b)=>a+b,0)}% — should equal 100%</div>
          <button className="btn btn-p btn-sm" style={{marginTop:12}} onClick={()=>saveAlloc(kid.id)}>Save allocation</button>
        </div>}
        <div className="sh"><span className="sht">Transaction history</span><span className="shc">{kidTxs.length} entries</span></div>
        <div className="card0">
          {kidTxs.length===0&&<div className="empty"><div className="emptyic">📋</div><div className="emptytx">No transactions yet.</div></div>}
          {kidTxs.map((tx,i)=>{
            const isEarn=tx.type==="earn";
            return <div className="tx-row" key={i}>
              <div className="tx-icon" style={{background:isEarn?"rgba(45,212,167,.1)":"rgba(245,166,35,.1)"}}>{isEarn?"⬆️":"🛒"}</div>
              <div className="tx-info">
                <div className="tx-title">{tx.desc}</div>
                <div className="tx-sub">{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})} · {new Date(tx.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <div className="tx-amt" style={{color:isEarn?"var(--te)":"var(--co)"}}>{isEarn?"+":""}{tx.amount} 🪙</div>
            </div>;
          })}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     KID MODE (simplified single-kid view)
  ═══════════════════════════════════════════════════════════════════════ */
  function KidMode(){
    const kid=kidById(activeKid); if(!kid)return null;
    const c=COLORS[kid.colorIdx];
    const lvl=levelFromXp(kid.xp);
    const xpThis=kid.xp-xpForLevel(lvl);
    const xpNeed=xpForLevel(lvl+1)-xpForLevel(lvl);
    const pct=Math.min(xpThis/xpNeed,1);
    const bk=kid.buckets||{save:0,spend:0,share:0};

    const myChores=chores.filter(ch=>ch.assignedTo.includes(kid.id)&&choreAppearsOnDate(ch,today()));
    const daily=myChores.filter(c=>c.freq==="daily");
    const recurring=myChores.filter(c=>c.freq!=="daily");

    const spendBal=bk.spend||0;
    const allStore=storeCat==="all"?storeItems:storeItems.filter(i=>i.cat===storeCat);

    return(
      <div className="kid-mode">
        {/* Header */}
        <div className="km-header">
          <div className="km-hero">
            <div className="km-av">
              <div style={{width:70,height:70,borderRadius:"50%",background:c.bg,color:c.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,fontWeight:900,position:"relative"}}>
                {kid.initials}
                <div style={{position:"absolute",bottom:-2,right:-2,background:c.bg,color:c.tx,fontSize:10,fontWeight:900,borderRadius:8,padding:"1px 6px",border:"3px solid var(--bg)"}}>Lv{lvl}</div>
              </div>
            </div>
            <div style={{flex:1}}>
              <div className="km-name">{kid.name}</div>
              <div style={{marginBottom:6}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--tx2)",marginBottom:3}}>
                  <span>Level {lvl}</span><span>{xpThis}/{xpNeed} XP</span>
                </div>
                <div style={{height:5,background:"var(--s3)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,background:c.bg,width:`${pct*100}%`,transition:"width .7s cubic-bezier(.34,1.56,.64,1)"}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:8}}>
                {kid.streak>=4&&<span style={{fontSize:11,fontWeight:700,color:"var(--am)"}}>🔥 {kid.streak}-day streak!</span>}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div className="km-coins">🪙 {spendBal}</div>
              <div style={{fontSize:10,color:"var(--tx2)"}}>spend balance</div>
            </div>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="km-nav">
          {[{id:"chores",lbl:"✓ Tasks"},{id:"store",lbl:"🛒 Store"},{id:"money",lbl:"🪙 Money"}].map(t=>(
            <button key={t.id} className={`km-nav-btn${kmView===t.id?" act":""}`} onClick={()=>setKmView(t.id)}>{t.lbl}</button>
          ))}
        </div>

        {/* Content */}
        <div className="km-content">
          {kmView==="chores"&&(
            <>
              <div style={{fontSize:12,fontWeight:700,color:"var(--tx2)",marginBottom:10,textTransform:"uppercase",letterSpacing:".07em"}}>Today's tasks</div>
              {daily.length===0&&recurring.length===0&&<div className="empty"><div className="emptyic">🎉</div><div className="emptytx">All done for today!</div></div>}
              {daily.map(ch=><ChoreCard key={ch.id} chore={ch} dk={today()} kidMode/>)}
              {recurring.length>0&&<>
                <div style={{fontSize:12,fontWeight:700,color:"var(--tx2)",margin:"14px 0 10px",textTransform:"uppercase",letterSpacing:".07em"}}>Recurring tasks</div>
                {recurring.map(ch=><ChoreCard key={ch.id} chore={ch} dk={today()} kidMode/>)}
              </>}
            </>
          )}
          {kmView==="store"&&(
            <>
              <div className="km-buckets">
                {[{k:"save",lbl:"Save",ic:"🏦",c:"#2dd4a7"},{k:"spend",lbl:"Spend",ic:"🛒",c:"#f5a623"},{k:"share",lbl:"Share",ic:"💝",c:"#e879a0"}].map(b=>(
                  <div className="km-bucket" key={b.k}>
                    <div className="km-b-ic">{b.ic}</div>
                    <div className="km-b-lbl" style={{color:b.c}}>{b.lbl}</div>
                    <div className="km-b-val" style={{color:b.c}}>{bk[b.k]||0}</div>
                  </div>
                ))}
              </div>
              <div className="store-tabs" style={{overflowX:"auto",flexWrap:"nowrap",paddingBottom:4}}>
                {STORE_CATS.map(cat=><button key={cat} className={`store-tab${storeCat===cat?" on":""}`} onClick={()=>setStoreCat(cat)}>{cat.charAt(0).toUpperCase()+cat.slice(1)}</button>)}
              </div>
              {allStore.map(item=>{
                const canAfford=spendBal>=item.price;
                const bought=purchases.some(p=>p.kidId===kid.id&&p.itemId===item.id);
                return(
                  <div key={item.id} className={`km-store-card${canAfford?" affordable":""}${bought?" bought":""}`}>
                    <div className="km-store-icon">{item.emoji}</div>
                    <div className="km-store-info">
                      <div className="km-store-name">{item.name}</div>
                      {item.desc&&<div className="km-store-desc">{item.desc}</div>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                      <div style={{fontSize:13,fontWeight:900,fontFamily:"var(--fm)",color:"var(--am)"}}>🪙 {item.price}</div>
                      {!bought&&<button className="km-store-buy" disabled={!canAfford} onClick={()=>buyItem(item,kid.id)}>{canAfford?"Buy":"🔒"}</button>}
                      {bought&&<span style={{fontSize:11,color:"var(--te)",fontWeight:700}}>✓ Got it</span>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {kmView==="money"&&(
            <>
              <div className="km-buckets">
                {[{k:"save",lbl:"Save",ic:"🏦",c:"#2dd4a7"},{k:"spend",lbl:"Spend",ic:"🛒",c:"#f5a623"},{k:"share",lbl:"Share",ic:"💝",c:"#e879a0"}].map(b=>(
                  <div className="km-bucket" key={b.k}>
                    <div className="km-b-ic">{b.ic}</div>
                    <div className="km-b-lbl" style={{color:b.c}}>{b.lbl}</div>
                    <div className="km-b-val" style={{color:b.c}}>{bk[b.k]||0}</div>
                    <div className="km-b-track"><div className="km-b-fill" style={{width:`${bk[b.k]?Math.round(bk[b.k]/Math.max(1,Object.values(bk).reduce((a,v)=>a+v,0))*100):0}%`,background:b.c}}/></div>
                  </div>
                ))}
              </div>
              <GoalBar kid={kid}/>
              <div style={{marginTop:16}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--tx2)",marginBottom:10,textTransform:"uppercase",letterSpacing:".07em"}}>Recent transactions</div>
                <div className="card0">
                  {txLog.filter(t=>t.kidId===kid.id).slice(0,10).map((tx,i)=>{
                    const isEarn=tx.type==="earn";
                    return <div className="tx-row" key={i}>
                      <div className="tx-icon" style={{background:isEarn?"rgba(45,212,167,.1)":"rgba(245,166,35,.1)"}}>{isEarn?"⬆️":"🛒"}</div>
                      <div className="tx-info">
                        <div className="tx-title">{tx.desc}</div>
                        <div style={{fontSize:11,color:"var(--tx2)",marginTop:1}}>{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>
                      </div>
                      <div className="tx-amt" style={{color:isEarn?"var(--te)":"var(--co)"}}>{isEarn?"+":""}{tx.amount} 🪙</div>
                    </div>;
                  })}
                  {!txLog.filter(t=>t.kidId===kid.id).length&&<div className="empty"><div className="emptyic">📋</div><div className="emptytx">No transactions yet.</div></div>}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     PARENT VIEWS
  ═══════════════════════════════════════════════════════════════════════ */
  const pend=pending();
  const todayDone=Object.values(comps[today()]||{}).filter(c=>c.status==="approved").length;

  function DashboardView(){
    return(
      <>
        <div className="sg">
          {[{lbl:"Done today",val:todayDone,c:"var(--te)"},{lbl:"Pending",val:pend.length,c:"var(--am)"},{lbl:"Chores",val:chores.length,c:"var(--pul)"},{lbl:"Members",val:kids.length,c:"var(--pk)"}]
            .map(s=><div className="sc" key={s.lbl}><div className="sn" style={{color:s.c}}>{s.val}</div><div className="sl">{s.lbl}</div></div>)}
        </div>
        {kids.map(k=>{const gs=goalStatus(k);if(!gs||!gs.unlocked)return null;
          return <div key={k.id} className={`pbanner ${gs.exceeded?"pb-t":"pb-g"}`}>
            <div style={{fontSize:24}}>{gs.exceeded?"⚡":"🎯"}</div>
            <div>
              <div style={{fontSize:13,fontWeight:800}}>{k.name} {gs.exceeded?"exceeded":"hit"} their weekly goal!</div>
              <div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{gs.wkx}/{gs.target} XP · <strong style={{color:gs.exceeded?"var(--te)":"var(--am)"}}>{gs.total} {k.goal.currency} payout</strong></div>
            </div>
          </div>;
        })}
        <div className="sh" style={{marginBottom:12}}>
          <span className="sht">Family</span>
          {parentMode&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddKid(true)}>+ Add kid</button>}
        </div>
        <div className="g3" style={{marginBottom:22}}>
          {kids.map(k=><KidCard key={k.id} kid={k} onClick={()=>{setActiveKid(k.id);setSelDate(today());setView("chores");}}/>)}
        </div>
        {parentMode&&pend.length>0&&<>
          <div className="sh"><span className="sht">Approval queue</span><span className="shc">{pend.length} waiting</span></div>
          <div className="card0" style={{marginBottom:22}}>
            {pend.map(p=>{
              const chore=chores.find(c=>c.id===p.choreId);const kid=kidById(p.kidId); if(!chore||!kid)return null;
              const cc=COLORS[kid.colorIdx];const past=isPast(p.dk)&&p.dk!==today();
              return <div className="aqr" key={`${p.dk}_${p.ck}`}>
                <div className="av-xs" style={{width:32,height:32,background:cc.bg,color:cc.tx,fontSize:11}}>{kid.initials}</div>
                <div className="aqi">
                  <div className="aqt">{chore.title}</div>
                  <div className="aqs">{kid.name} · +{DIFF[chore.diff].xp} XP & coins{past?" (75%)":""} · {past?<span style={{color:"var(--bl)"}}>{p.dk}</span>:"today"}</div>
                </div>
                <div className="aqa">
                  <button className="btn btn-ok btn-sm" onClick={()=>approveComp(p.dk,p.ck,p.kidId,p.choreId)}>✓ Approve</button>
                  <button className="btn btn-no btn-sm" onClick={()=>denyComp(p.dk,p.ck)}>✕ Deny</button>
                </div>
              </div>;
            })}
          </div>
        </>}
        <div className="sh"><span className="sht">Calendar</span></div>
        <Calendar/>
      </>
    );
  }

  function ChoresView(){
    const dk=selDate;const past=isPast(dk)&&dk!==today();
    const kid=activeKid?kidById(activeKid):null;
    const list=chores.filter(c=>(!activeKid||c.assignedTo.includes(activeKid))&&choreAppearsOnDate(c,dk));
    const daily=list.filter(c=>c.freq==="daily");
    const recurring=list.filter(c=>c.freq==="weekly"||c.freq==="monthly");
    const once=list.filter(c=>c.freq==="once");
    return(
      <>
        {kid&&<div style={{marginBottom:18}}><KidCard kid={kid}/></div>}
        <div className="datenav">
          <button className="cnb" onClick={()=>shiftDate(dk,-1)}>‹ Prev</button>
          <button className="cnb tod" onClick={()=>setSelDate(today())}>Today</button>
          <button className="cnb" disabled={dk===today()} onClick={()=>shiftDate(dk,1)}>Next ›</button>
          <div className="datelbl">{dk===today()?"Today — "+new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"}):parseDate(dk).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
        </div>
        {past&&<div style={{background:"rgba(74,162,255,.05)",border:"1px solid rgba(74,162,255,.15)",borderRadius:"var(--rs)",padding:"9px 13px",marginBottom:16,fontSize:12,color:"var(--bl)"}}>
          📅 Past day — anyone can mark tasks complete. Tasks earn <strong>75% XP & coins</strong>.
        </div>}
        {daily.length>0&&<><div className="sh"><span className="sht">Daily tasks</span><span className="shc">{daily.length} today</span></div><div className="ga" style={{marginBottom:20}}>{daily.map(c=><ChoreCard key={c.id} chore={c} dk={dk}/>)}</div></>}
        {recurring.length>0&&<><div className="sh"><span className="sht">Recurring</span><span className="shc">{recurring.length}</span></div><div className="ga" style={{marginBottom:20}}>{recurring.map(c=><ChoreCard key={c.id} chore={c} dk={dk}/>)}</div></>}
        {once.length>0&&<><div className="sh"><span className="sht">One-time</span><span className="shc">{once.length}</span></div><div className="ga" style={{marginBottom:20}}>{once.map(c=><ChoreCard key={c.id} chore={c} dk={dk}/>)}</div></>}
        {list.length===0&&<div className="empty"><div className="emptyic">✓</div><div className="emptytx">No chores scheduled for this day.</div></div>}
      </>
    );
  }

  function ActivityView(){
    const all=[];
    Object.entries(comps).forEach(([dk,dd])=>Object.entries(dd).forEach(([ck,c])=>{if(c.status==="approved")all.push({dk,...c});}));
    all.sort((a,b)=>b.ts-a.ts);
    return(
      <div className="card0">
        {!all.length&&<div className="empty"><div className="emptyic">📋</div><div className="emptytx">No activity yet.</div></div>}
        {all.map((c,i)=>{
          const chore=chores.find(x=>x.id===c.choreId);const kid=kidById(c.kidId); if(!chore||!kid)return null;
          const cc=COLORS[kid.colorIdx];const past=isPast(c.dk)&&c.dk!==today();
          return <div className="actr" key={i}>
            <div className="av-xs" style={{width:32,height:32,background:cc.bg,color:cc.tx,fontSize:11,borderRadius:"50%"}}>{kid.initials}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700}}>{chore.title}</div>
              <div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{kid.name} · <span style={{color:"var(--te)"}}>+{DIFF[chore.diff].xp} XP & 🪙{past?" (75%)":""}</span> · {past?c.dk:"today"}</div>
            </div>
            <span className="badge ba">✓</span>
          </div>;
        })}
      </div>
    );
  }

  /* ─── Modals ─────────────────────────────────────────────────────────── */
  function GoalModal(){
    const kid=kidById(goalKid); if(!kid)return null;
    return <div className="mbd" onClick={()=>setGoalKid(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mt">Weekly goal — {kid.name}</div>
      <div className="fg"><label className="fl">Weekly XP target</label><input className="fi" type="number" value={editGoal.weeklyXp} onChange={e=>setEditGoal(g=>({...g,weeklyXp:+e.target.value||0}))}/><div className="fhint">XP needed this week to unlock the base payout.</div></div>
      <div className="f2">
        <div className="fg"><label className="fl">Base payout</label><input className="fi" type="number" value={editGoal.payoutBase} onChange={e=>setEditGoal(g=>({...g,payoutBase:+e.target.value||0}))}/></div>
        <div className="fg"><label className="fl">Bonus (if exceeded)</label><input className="fi" type="number" value={editGoal.payoutBonus} onChange={e=>setEditGoal(g=>({...g,payoutBonus:+e.target.value||0}))}/></div>
      </div>
      <div className="fg"><label className="fl">Currency label</label><input className="fi" placeholder="coins / dollars" value={editGoal.currency} onChange={e=>setEditGoal(g=>({...g,currency:e.target.value}))}/></div>
      <div className="gprev"><div className="gprev-t">Preview</div><div className="gprev-row">
        <div>🎯 Hit <strong style={{color:"var(--am)"}}>{editGoal.weeklyXp} XP</strong> → <strong style={{color:"var(--am)"}}>{editGoal.payoutBase} {editGoal.currency}</strong></div>
        <div>⚡ Exceed → <strong style={{color:"var(--te)"}}>{editGoal.payoutBase+editGoal.payoutBonus} {editGoal.currency}</strong></div>
        <div>🚀 Each +25% over adds <strong style={{color:"var(--te)"}}>{Math.floor(editGoal.payoutBonus*0.5)} {editGoal.currency}</strong></div>
      </div></div>
      <div className="fax"><button className="btn btn-g" onClick={()=>setGoalKid(null)}>Cancel</button><button className="btn btn-p" onClick={()=>saveGoal(goalKid)}>Save</button></div>
    </div></div>;
  }

  function AddChoreModal(){
    const isFixed=cf.freq==="daily"&&cf.scheduleType==="fixed";
    return <div className="mbd" onClick={()=>setShowAddChore(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mt">Add chore</div>
      <div className="fg"><label className="fl">Title</label><input className="fi" placeholder="e.g. Clean the bathroom" value={cf.title} onChange={e=>setCf(f=>({...f,title:e.target.value}))}/></div>
      <div className="f2">
        <div className="fg"><label className="fl">Difficulty</label><select className="fi" value={cf.diff} onChange={e=>setCf(f=>({...f,diff:e.target.value}))}>
          {Object.entries(DIFF).map(([k,v])=><option key={k} value={k}>{v.lbl} (+{v.xp} XP & coins)</option>)}</select></div>
        <div className="fg"><label className="fl">Frequency</label><select className="fi" value={cf.freq} onChange={e=>setCf(f=>({...f,freq:e.target.value,scheduleType:"daily",scheduleDays:[]}))}>
          <option value="daily">Daily / Scheduled</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="once">One-time</option></select></div>
      </div>
      {cf.freq==="daily"&&<div className="fg"><label className="fl">Schedule</label>
        <div className="smode">
          <button className={`smode-btn${cf.scheduleType==="daily"?" on":""}`} onClick={()=>setCf(f=>({...f,scheduleType:"daily",scheduleDays:[]}))}>Every day</button>
          <button className={`smode-btn${cf.scheduleType==="fixed"?" on":""}`} onClick={()=>setCf(f=>({...f,scheduleType:"fixed"}))}>Specific days</button>
        </div>
        {cf.scheduleType==="fixed"&&<><div className="daypicker">{DAY_NAMES.map((name,dow)=><div key={dow} className={`daychip${cf.scheduleDays.includes(dow)?" on":""}`} onClick={()=>toggleDay(dow)}>{name.slice(0,1)}</div>)}</div>
          {cf.scheduleDays.length>0&&<div className="fhint" style={{marginTop:6}}>Scheduled: {cf.scheduleDays.map(d=>DAY_NAMES[d]).join(", ")}</div>}
          {!cf.scheduleDays.length&&<div className="fhint" style={{color:"var(--co)",marginTop:6}}>Select at least one day.</div>}
        </>}
      </div>}
      <div className="fg"><label className="fl">Assign to</label><div className="agrid">{kids.map(k=>{const cc=COLORS[k.colorIdx];const sel=cf.assignedTo.includes(k.id);
        return <div key={k.id} className={`achip${sel?" sel":""}`} onClick={()=>setCf(f=>({...f,assignedTo:sel?f.assignedTo.filter(x=>x!==k.id):[...f.assignedTo,k.id]}))}>
          <span className="adot" style={{background:cc.bg}}/>{k.name}</div>;})}
      </div></div>
      <div className="fg"><div className="swrow"><label className="fl" style={{marginBottom:0}}>Requires approval</label>
        <label className="sw"><input type="checkbox" checked={cf.requiresApproval} onChange={e=>setCf(f=>({...f,requiresApproval:e.target.checked}))}/><div className="sw-tr"/><div className="sw-th"/></label></div></div>
      <div className="fax"><button className="btn btn-g" onClick={()=>setShowAddChore(false)}>Cancel</button>
        <button className="btn btn-p" disabled={!cf.title.trim()||!cf.assignedTo.length||(isFixed&&!cf.scheduleDays.length)} onClick={addChore}>Add chore</button></div>
    </div></div>;
  }

  function AddKidModal(){
    return <div className="mbd" onClick={()=>setShowAddKid(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mt">Add family member</div>
      <div className="fg"><label className="fl">Name</label><input className="fi" placeholder="Jordan" value={kf.name} onChange={e=>setKf(f=>({...f,name:e.target.value}))}/></div>
      <div className="f2">
        <div className="fg"><label className="fl">Age</label><input className="fi" type="number" placeholder="14" value={kf.age} onChange={e=>setKf(f=>({...f,age:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Initials</label><input className="fi" placeholder="JW" maxLength={2} value={kf.initials} onChange={e=>setKf(f=>({...f,initials:e.target.value.toUpperCase()}))}/></div>
      </div>
      <div className="fax"><button className="btn btn-g" onClick={()=>setShowAddKid(false)}>Cancel</button><button className="btn btn-p" onClick={addKid}>Add member</button></div>
    </div></div>;
  }

  function AddItemModal(){
    return <div className="mbd" onClick={()=>setShowAddItem(false)}><div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mt">Add store item</div>
      <div className="f2">
        <div className="fg"><label className="fl">Emoji</label><input className="fi" value={itemF.emoji} onChange={e=>setItemF(f=>({...f,emoji:e.target.value}))}/></div>
        <div className="fg"><label className="fl">Price (coins)</label><input className="fi" type="number" value={itemF.price} onChange={e=>setItemF(f=>({...f,price:+e.target.value||0}))}/></div>
      </div>
      <div className="fg"><label className="fl">Name</label><input className="fi" placeholder="e.g. Movie night" value={itemF.name} onChange={e=>setItemF(f=>({...f,name:e.target.value}))}/></div>
      <div className="fg"><label className="fl">Description (optional)</label><input className="fi" placeholder="Short description" value={itemF.desc} onChange={e=>setItemF(f=>({...f,desc:e.target.value}))}/></div>
      <div className="fax"><button className="btn btn-g" onClick={()=>setShowAddItem(false)}>Cancel</button><button className="btn btn-p" disabled={!itemF.name.trim()} onClick={addStoreItem}>Add item</button></div>
    </div></div>;
  }

  /* ─── Config ─────────────────────────────────────────────────────────── */
  function handleCfgSave(cfg){localStorage.setItem("wh4_cfg",JSON.stringify(cfg));setFbCfg(cfg);setShowCfg(false);}
  if(showCfg)return(<><style>{CSS}</style><ConfigScreen onSave={handleCfgSave} onSkip={()=>setShowCfg(false)}/></>);

  /* ─── Kid mode: show simplified view when parent mode off + kid selected ─ */
  if(!parentMode&&activeKid){
    return(
      <>
        <style>{CSS}</style>
        <div className="twrap">{toasts.map(t=><div className="toast" key={t.id}>{t.xp&&<span className="txp">+{t.xp}</span>}{t.coins&&<span className="tco">🪙+{t.coins}</span>}<span className="tmsg">{t.msg}</span></div>)}</div>
        {lvlUp&&<div className="lvlbd"><div className="lvlbox"><h2>Level Up! ⚡</h2><p>{lvlUp.name} reached Level {lvlUp.level}!</p></div></div>}
        {buyBanner&&<div className="buy-banner"><div className="ic">{buyBanner.emoji}</div><div><div className="msg">{buyBanner.name}</div><div className="sub">Redeemed for {buyBanner.coins} coins 🎉</div></div></div>}
        <GoalModal key="gm"/>
        {showAddChore&&<AddChoreModal/>}
        <KidMode/>
        {/* Back button for kid mode */}
        <button onClick={()=>{setActiveKid(null);setParentMode(true);}} style={{position:"fixed",bottom:20,right:20,background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:"var(--rs)",padding:"8px 14px",fontSize:12,fontWeight:700,color:"var(--tx2)",cursor:"pointer",fontFamily:"var(--f)"}}>
          ← Parent mode
        </button>
      </>
    );
  }

  const vmeta={
    dashboard:{t:"Dashboard",s:"Family overview"},
    chores:{t:activeKid?`${kidById(activeKid)?.name}'s Chores`:"All Chores",s:selDate===today()?"Today":parseDate(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})},
    activity:{t:"Activity",s:"Completed tasks"},
    store:{t:"Family Store",s:activeKid?`${kidById(activeKid)?.name}'s purchases`:"All items"},
    money:{t:"Money",s:activeKid?`${kidById(activeKid)?.name}'s buckets`:"Family balances"},
  };
  const vm=vmeta[view]||vmeta.dashboard;

  return(
    <>
      <style>{CSS}</style>
      <div className="twrap">{toasts.map(t=><div className="toast" key={t.id}>{t.xp&&<span className="txp">+{t.xp}</span>}{t.coins&&<span className="tco">🪙+{t.coins}</span>}<span className="tmsg">{t.msg}</span></div>)}</div>
      {lvlUp&&<div className="lvlbd"><div className="lvlbox"><h2>Level Up! ⚡</h2><p>{lvlUp.name} reached Level {lvlUp.level}!</p></div></div>}
      {buyBanner&&<div className="buy-banner"><div className="ic">{buyBanner.emoji}</div><div><div className="msg">{buyBanner.name}</div><div className="sub">Redeemed for {buyBanner.coins} coins 🎉</div></div></div>}
      {goalKid&&<GoalModal/>}
      {showAddChore&&<AddChoreModal/>}
      {showAddKid&&<AddKidModal/>}
      {showAddItem&&<AddItemModal/>}

      <div className="app">
        <aside className="sidebar">
          <div className="logo">Watts<span>Hub</span>
            <em><span className={`sync-dot${ready?" live":""}`}/>{ready?"Live sync":"Demo mode"}</em>
          </div>
          <div style={{padding:"0 9px",marginBottom:4}}>
            <div className="nlbl">Navigate</div>
            {[{id:"dashboard",ic:"⬡",lbl:"Dashboard"},{id:"chores",ic:"✓",lbl:"Chores"},{id:"store",ic:"🛒",lbl:"Store"},{id:"money",ic:"🪙",lbl:"Money"},{id:"activity",ic:"↻",lbl:"Activity"}].map(n=>(
              <button key={n.id} className={`ni${view===n.id&&!(!parentMode&&activeKid)?" act":""}`} onClick={()=>{setView(n.id);if(n.id!=="chores"&&n.id!=="store"&&n.id!=="money")setActiveKid(null);}}>
                <span className="ic">{n.ic}</span>{n.lbl}
              </button>
            ))}
          </div>
          <div style={{padding:"0 9px"}}>
            <div className="nlbl">Kids</div>
            {kids.map(k=>{const cc=COLORS[k.colorIdx];return(
              <button key={k.id} className={`kni${activeKid===k.id?" act":""}`} onClick={()=>{setActiveKid(k.id);setSelDate(today());setView("chores");}}>
                <div className="av-xs" style={{width:23,height:23,background:cc.bg,color:cc.tx,fontSize:9}}>{k.initials}</div>{k.name}
              </button>
            );})}
            {activeKid&&<button className="kni" style={{color:"var(--tx3)"}} onClick={()=>{setActiveKid(null);setView("dashboard");}}>
              <span style={{width:23,textAlign:"center"}}>←</span>Back
            </button>}
          </div>
          <div className="sfoot">
            <div className="swrow">
              <span style={{fontSize:11,fontWeight:600,color:"var(--tx2)"}}>Parent mode</span>
              <label className="sw"><input type="checkbox" checked={parentMode} onChange={e=>setParentMode(e.target.checked)}/><div className="sw-tr"/><div className="sw-th"/></label>
            </div>
            <button className="ni" style={{color:"var(--tx3)",marginTop:2}} onClick={()=>setShowCfg(true)}>
              <span className="ic">⚙</span>Firebase setup
            </button>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div><div className="tb-t">{vm.t}</div><div className="tb-s">{vm.s}</div></div>
            <div className="tb-r">
              {pend.length>0&&parentMode&&<span style={{background:"rgba(245,166,35,.13)",color:"var(--am)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>{pend.length} pending</span>}
              {ready&&<span style={{background:"rgba(45,212,167,.09)",color:"var(--te)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>● Live</span>}
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
          </div>
        </main>
      </div>
    </>
  );
}

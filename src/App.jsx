import { useState, useEffect, useRef, useCallback } from "react";
import { dbWrite, dbMerge, dbDelete, dbListen, isConfigured, registerFCMToken, onFCMMessage } from "./firebase.js";

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
.sidebar{width:212px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--b1);display:flex;flex-direction:column;height:100vh;position:sticky;top:0;overflow-y:auto;}
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
.av-xs{border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:800;}
.sfoot{margin-top:auto;padding:12px 9px;border-top:1px solid var(--b1);}
.swrow{display:flex;align-items:center;justify-content:space-between;padding:5px 9px;}

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
.btn-am:hover{background:rgba(245,166,35,.26);}

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

/* ── Goal bars ── */
.goal-block{margin-top:12px;padding-top:11px;border-top:1px solid var(--b1);display:flex;flex-direction:column;gap:10px;}
.grow{display:flex;flex-direction:column;gap:4px;}
.ghead{display:flex;justify-content:space-between;align-items:center;}
.glbl{font-size:10px;font-weight:800;color:var(--tx2);text-transform:uppercase;letter-spacing:.07em;}
.gval{font-size:11px;font-weight:700;font-family:var(--fm);}
.gtrack{height:6px;background:var(--s3);border-radius:3px;overflow:hidden;}
.gfill{height:100%;border-radius:3px;transition:width .7s cubic-bezier(.34,1.56,.64,1);}
.gpill{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px;margin-top:1px;}
.g-lock{background:rgba(255,255,255,.04);color:var(--tx3);}
.g-near{background:rgba(74,162,255,.12);color:var(--bl);}
.g-hit{background:rgba(245,166,35,.14);color:var(--am);}
.g-over{background:rgba(45,212,167,.14);color:var(--te);}

/* ── Stat cards ── */
.sg{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:20px;}
.sc{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:14px 16px;}
.sn{font-size:24px;font-weight:900;font-family:var(--fm);}
.sl{font-size:11px;color:var(--tx2);margin-top:2px;}

/* ── Badges ── */
.badge{display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;}
.bxp{background:rgba(124,111,247,.14);color:var(--pul);}
.bdo{background:rgba(74,196,125,.14);color:#4ac47d;}
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
.store-card.can{border-color:rgba(74,196,125,.28);}
.store-card.bought{opacity:.6;}
.store-emoji{font-size:28px;line-height:1;}
.store-name{font-size:13px;font-weight:700;}
.store-desc{font-size:11px;color:var(--tx2);line-height:1.4;}
.store-price{font-size:14px;font-weight:900;font-family:var(--fm);color:var(--gn);}
.store-cat{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--tx3);}
.store-tabs{display:flex;gap:4px;margin-bottom:16px;flex-wrap:wrap;}
.store-tab{padding:5px 13px;border-radius:var(--rs);font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--s2);color:var(--tx2);transition:all .12s;font-family:var(--f);}
.store-tab.on{background:rgba(124,111,247,.15);border-color:var(--pu);color:var(--pul);}

/* ── Money view ── */
.balance-hero{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:24px;margin-bottom:16px;display:flex;align-items:center;gap:20px;}
.bal-main{flex:1;}
.bal-amt{font-size:42px;font-weight:900;font-family:var(--fm);color:var(--gn);line-height:1;}
.bal-lbl{font-size:12px;color:var(--tx2);margin-top:4px;}
.bal-pending{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:12px;color:var(--am);}
.tx-row{display:flex;align-items:center;gap:10px;padding:10px 15px;border-bottom:1px solid var(--b1);}
.tx-row:last-child{border-bottom:none;}
.tx-icon{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;}
.tx-info{flex:1;}
.tx-title{font-size:13px;font-weight:600;}
.tx-sub{font-size:11px;color:var(--tx2);margin-top:1px;}
.tx-amt{font-size:13px;font-weight:800;font-family:var(--fm);}

/* ── BATCH 4: Payout rows ── */
.payout-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--b1);}
.payout-row:last-child{border-bottom:none;}
.po-info{flex:1;}
.po-title{font-size:13px;font-weight:700;}
.po-sub{font-size:11px;color:var(--tx2);margin-top:2px;}
.po-amt{font-size:15px;font-weight:900;font-family:var(--fm);color:var(--gn);}

/* ── BATCH 4: XP convert panel ── */
.convert-panel{background:rgba(124,111,247,.07);border:1px solid rgba(124,111,247,.18);border-radius:var(--r);padding:14px 16px;margin-bottom:16px;}
.convert-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.convert-input{width:90px;background:var(--s2);border:1px solid var(--b2);border-radius:var(--rs);padding:8px 10px;color:var(--tx1);font-size:14px;font-family:var(--fm);outline:none;text-align:center;}
.convert-input:focus{border-color:var(--pu);}

/* ── BATCH 5: Settings sections ── */
.settings-section{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);margin-bottom:16px;overflow:hidden;}
.settings-section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--tx2);padding:13px 16px;border-bottom:1px solid var(--b1);}
.settings-row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-bottom:1px solid var(--b1);}
.settings-row:last-child{border-bottom:none;}
.settings-row-info{flex:1;}
.settings-row-title{font-size:13px;font-weight:700;}
.settings-row-sub{font-size:11px;color:var(--tx2);margin-top:2px;}

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
.cday.hmiss::after{content:'';position:absolute;bottom:3px;width:4px;height:4px;border-radius:50%;background:var(--co);}

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
.fax{display:flex;gap:8px;justify-content:flex-end;margin-top:18px;}
.fhint{font-size:10px;color:var(--tx3);margin-top:4px;line-height:1.5;}
.agrid{display:flex;flex-wrap:wrap;gap:6px;}
.achip{display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:16px;border:1px solid var(--b2);cursor:pointer;font-size:12px;font-weight:700;background:var(--s2);color:var(--tx2);transition:all .12s;}
.achip.sel{border-color:var(--pu);background:rgba(124,111,247,.13);color:var(--pul);}
.adot{width:6px;height:6px;border-radius:50%;}
.smode{display:flex;gap:6px;margin-bottom:10px;}
.smode-btn{flex:1;padding:7px;border-radius:var(--rs);font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--s2);color:var(--tx2);transition:all .13s;text-align:center;font-family:var(--f);}
.smode-btn.on{background:rgba(124,111,247,.15);border-color:var(--pu);color:var(--pul);}
.daypicker{display:flex;gap:5px;flex-wrap:wrap;}
.daychip{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--b2);background:var(--s2);color:var(--tx2);transition:all .13s;user-select:none;}
.daychip.on{background:rgba(124,111,247,.18);border-color:var(--pu);color:var(--pul);}
.preview-box{background:var(--s2);border-radius:var(--rs);padding:14px;margin-top:6px;}
.preview-box-t{font-size:10px;font-weight:800;color:var(--tx2);text-transform:uppercase;letter-spacing:.07em;margin-bottom:9px;}
.preview-row{font-size:12px;color:var(--tx2);line-height:1.9;}

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
.t-xp{color:var(--pul);font-size:15px;font-weight:900;font-family:var(--fm);}
.t-do{color:var(--gn);font-size:15px;font-weight:900;font-family:var(--fm);}
.t-msg{color:var(--tx2);}
@keyframes tIn{from{opacity:0;transform:translateX(52px) scale(.9);}to{opacity:1;transform:none;}}
.lvlbd{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:300;pointer-events:none;background:rgba(0,0,0,.52);}
.lvlbox{background:linear-gradient(135deg,#4a42c8,var(--pu));border-radius:var(--rl);padding:30px 50px;text-align:center;box-shadow:0 0 80px rgba(124,111,247,.5);animation:lvlIn .44s cubic-bezier(.34,1.56,.64,1);}
.lvlbox h2{font-size:32px;font-weight:900;color:#fff;}
.lvlbox p{color:rgba(255,255,255,.8);font-size:14px;margin-top:3px;}
@keyframes lvlIn{from{opacity:0;transform:scale(.4);}to{opacity:1;transform:none;}}

/* ── Goal unlock banner ── */
.unlock-bd{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:300;pointer-events:none;background:rgba(0,0,0,.52);}
.unlock-box{background:linear-gradient(135deg,#0f6e56,#2dd4a7);border-radius:var(--rl);padding:30px 50px;text-align:center;box-shadow:0 0 80px rgba(45,212,167,.4);animation:lvlIn .44s cubic-bezier(.34,1.56,.64,1);}
.unlock-box h2{font-size:28px;font-weight:900;color:#fff;}
.unlock-box p{color:rgba(255,255,255,.85);font-size:14px;margin-top:5px;}

/* ── Buy banner ── */
.buy-banner{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:var(--s1);border:1px solid rgba(74,196,125,.3);border-radius:var(--r);padding:14px 22px;display:flex;align-items:center;gap:12px;box-shadow:var(--sh);z-index:500;animation:buyIn .35s cubic-bezier(.34,1.56,.64,1);}
@keyframes buyIn{from{opacity:0;transform:translateX(-50%) translateY(20px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}

/* ── Goal unlock banners ── */
.gbanner{border-radius:var(--r);padding:13px 17px;margin-bottom:13px;display:flex;align-items:center;gap:13px;border:1px solid;}
.gb-w{background:rgba(74,162,255,.06);border-color:rgba(74,162,255,.2);}
.gb-m{background:rgba(245,166,35,.07);border-color:rgba(245,166,35,.22);}
.gb-mx{background:rgba(45,212,167,.07);border-color:rgba(45,212,167,.2);}

/* ── Date nav ── */
.datenav{display:flex;align-items:center;gap:9px;margin-bottom:18px;flex-wrap:wrap;}
.datelbl{flex:1;text-align:center;font-weight:800;font-size:14px;min-width:0;}

/* ── Kid mode ── */
.km{background:var(--bg);min-height:100vh;display:flex;flex-direction:column;max-width:480px;margin:0 auto;}
.km-hd{padding:20px 18px 0;}
.km-hero{display:flex;align-items:center;gap:14px;margin-bottom:16px;}
.km-name{font-size:22px;font-weight:900;}
.km-lvl{font-size:12px;color:var(--tx2);margin-top:2px;}
.km-bal{text-align:right;}
.km-bal-amt{font-size:22px;font-weight:900;font-family:var(--fm);color:var(--gn);}
.km-bal-lbl{font-size:10px;color:var(--tx2);}
.km-nav{display:flex;background:var(--s2);border-radius:var(--r);margin:0 18px 16px;padding:4px;gap:4px;}
.km-nb{flex:1;padding:10px 6px;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:none;color:var(--tx2);transition:all .13s;text-align:center;font-family:var(--f);}
.km-nb.act{background:var(--s1);color:var(--tx1);box-shadow:0 2px 8px rgba(0,0,0,.3);}
.km-body{flex:1;padding:0 18px 100px;}
.km-chore{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;transition:all .15s;}
.km-chore.done{opacity:.45;}
.km-chore.pend{border-color:rgba(245,166,35,.3);}
.km-ci{width:46px;height:46px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.km-ct{font-size:14px;font-weight:700;margin-bottom:4px;}
.km-ct.done{text-decoration:line-through;color:var(--tx3);}
.km-rw{display:flex;gap:6px;}
.km-rp{display:flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 7px;border-radius:5px;}
.km-ck{width:38px;height:38px;border-radius:50%;border:2px solid var(--b2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .15px;flex-shrink:0;background:none;font-size:18px;}
.km-ck:hover{border-color:var(--pu);background:rgba(124,111,247,.13);}
.km-ck.done{background:var(--te);border-color:var(--te);}
.km-ck.pend{background:rgba(245,166,35,.2);border-color:var(--am);}
.km-sc{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:14px;transition:all .15s;}
.km-sc.can{border-color:rgba(74,196,125,.3);}
.km-sc.bought{opacity:.5;}
.km-si{font-size:26px;width:46px;text-align:center;flex-shrink:0;}
.km-sn{font-size:14px;font-weight:700;margin-bottom:2px;}
.km-sd{font-size:11px;color:var(--tx2);}
.km-buy{display:flex;align-items:center;gap:5px;padding:8px 14px;border-radius:var(--rs);font-size:13px;font-weight:800;cursor:pointer;border:none;background:rgba(74,196,125,.15);color:var(--gn);transition:all .15s;font-family:var(--f);flex-shrink:0;}
.km-buy:hover:not(:disabled){background:rgba(74,196,125,.28);}
.km-buy:disabled{opacity:.4;cursor:default;}

/* ── Activity ── */
.actr{display:flex;align-items:center;gap:11px;padding:12px 15px;border-bottom:1px solid var(--b1);}
.actr:last-child{border-bottom:none;}

/* ── Config ── */
.cfgwrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:22px;}
.cfgbox{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:30px;width:500px;max-width:100%;}
.cfglogo{font-size:21px;font-weight:900;margin-bottom:4px;}
.cfglogo span{color:var(--pu);}
.cfgsub{font-size:13px;color:var(--tx2);margin-bottom:22px;line-height:1.65;}
.cfgdemo{background:rgba(124,111,247,.07);border:1px solid rgba(124,111,247,.16);border-radius:var(--rs);padding:10px 13px;font-size:12px;color:var(--pul);margin-bottom:17px;line-height:1.55;}
.empty{text-align:center;padding:40px 18px;color:var(--tx3);}
.emptyic{font-size:36px;margin-bottom:9px;}
.emptytx{font-size:13px;}

/* ── Weekly summary card ── */
.week-summary{background:var(--s1);border:1px solid var(--b1);border-radius:var(--r);padding:16px;margin-bottom:20px;}
.week-summary-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--tx2);margin-bottom:12px;}
.week-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}
.week-row:last-child{margin-bottom:0;}
.week-bar-wrap{flex:1;height:6px;background:var(--s3);border-radius:3px;overflow:hidden;}
.week-bar{height:100%;border-radius:3px;transition:width .7s cubic-bezier(.34,1.56,.64,1);}

/* ── Pending nav badge ── */
.nav-badge{background:var(--am);color:#1a0e00;font-size:9px;font-weight:900;padding:1px 5px;border-radius:6px;margin-left:auto;}

@media(max-width:680px){
  .sidebar{display:none;}
  .sg{grid-template-columns:repeat(2,1fr);}
  .g3{grid-template-columns:1fr;}
  .ga,.store-grid{grid-template-columns:1fr;}
  .content{padding:14px 14px 90px;}
  .f2{grid-template-columns:1fr;}
  .topbar{padding:11px 14px;}
  .aqa{flex-direction:column;}
}

/* ── Profile picker ── */
.picker-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:24px;}
.picker-logo{font-size:28px;font-weight:900;letter-spacing:-.5px;}
.picker-logo span{color:var(--pu);}
.picker-sub{font-size:13px;color:var(--tx2);}
.picker-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;width:100%;max-width:520px;}
.picker-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:24px 16px;cursor:pointer;transition:all .18s;display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;}
.picker-card:hover{border-color:var(--b2);transform:translateY(-2px);box-shadow:var(--sh);}
.picker-card.parent{border-color:rgba(124,111,247,.25);background:rgba(124,111,247,.05);}
.picker-name{font-size:14px;font-weight:800;}
.picker-sub2{font-size:11px;color:var(--tx2);}

/* ── PIN modal ── */
.pin-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
.pin-box{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:32px 28px;width:340px;max-width:100%;text-align:center;}
.pin-title{font-size:18px;font-weight:900;margin-bottom:6px;}
.pin-sub{font-size:13px;color:var(--tx2);margin-bottom:24px;}
.pin-dots{display:flex;gap:12px;justify-content:center;margin-bottom:24px;}
.pin-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--b2);background:none;transition:all .15s;}
.pin-dot.filled{background:var(--pu);border-color:var(--pu);}
.pin-dot.error{background:var(--co);border-color:var(--co);}
.pin-pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;}
.pin-key{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:16px;font-size:20px;font-weight:700;cursor:pointer;transition:all .13s;font-family:var(--fm);color:var(--tx1);}
.pin-key:hover{background:var(--s3);}
.pin-key:active{transform:scale(.94);}
.pin-key.del{font-size:14px;color:var(--tx2);}

/* ── Bottom nav (mobile) ── */
.bottom-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:rgba(19,19,31,.96);backdrop-filter:blur(12px);border-top:1px solid var(--b1);z-index:30;padding:0 0 env(safe-area-inset-bottom);}
.bn-inner{display:flex;justify-content:space-around;padding:6px 0;}
.bn-item{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 14px;cursor:pointer;border:none;background:none;color:var(--tx3);transition:all .13s;font-family:var(--f);border-radius:var(--rs);position:relative;}
.bn-item.act{color:var(--pul);}
.bn-item .bn-ic{font-size:18px;line-height:1;}
.bn-item .bn-lb{font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;}
.bn-badge{position:absolute;top:2px;right:8px;background:var(--am);color:#1a0e00;font-size:8px;font-weight:900;padding:1px 4px;border-radius:5px;}
@media(max-width:680px){.bottom-nav{display:block;}}

/* ── Balance lock ── */
.bal-locked{color:var(--co)!important;}
.lock-banner{background:rgba(240,96,96,.07);border:1px solid rgba(240,96,96,.18);border-radius:var(--r);padding:14px 17px;margin-bottom:14px;display:flex;align-items:center;gap:13px;}
.lock-prog{height:7px;background:var(--s3);border-radius:3px;overflow:hidden;margin-top:6px;}
.lock-fill{height:100%;border-radius:3px;background:var(--co);}

/* ── Bonus modal ── */
.bonus-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:16px;}
.bonus-type{background:var(--s2);border:1px solid var(--b2);border-radius:var(--r);padding:14px 10px;cursor:pointer;text-align:center;transition:all .13s;}
.bonus-type:hover{border-color:var(--b2);background:var(--s3);}
.bonus-type.sel{border-color:var(--pu);background:rgba(124,111,247,.12);}
.bonus-type-ic{font-size:24px;margin-bottom:6px;}
.bonus-type-lbl{font-size:12px;font-weight:700;}

/* ── Chore card edit button ── */
.chore-actions{display:flex;gap:6px;margin-top:8px;justify-content:flex-end;}
.edit-btn{background:none;border:1px solid var(--b1);border-radius:var(--rs);padding:4px 9px;font-size:11px;font-weight:600;color:var(--tx3);cursor:pointer;transition:all .13s;font-family:var(--f);}
.edit-btn:hover{border-color:var(--b2);color:var(--tx2);}
.del-btn{background:none;border:1px solid var(--b1);border-radius:var(--rs);padding:4px 9px;font-size:11px;font-weight:600;color:var(--tx3);cursor:pointer;transition:all .13s;font-family:var(--f);}
.del-btn:hover{border-color:rgba(240,96,96,.3);color:var(--co);}

/* ── Deny note modal ── */
.deny-modal{background:var(--s1);border:1px solid var(--b2);border-radius:var(--rl);padding:24px;width:400px;max-width:100%;box-shadow:0 24px 80px rgba(0,0,0,.65);animation:mmi .22s cubic-bezier(.34,1.2,.64,1);}

/* ── Badge system ── */
.badge-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;}
.badge-card{background:var(--s2);border:1px solid var(--b1);border-radius:var(--r);padding:14px;text-align:center;transition:all .18s;}
.badge-card.earned{background:rgba(124,111,247,.08);border-color:rgba(124,111,247,.28);}
.badge-card.earned:hover{transform:translateY(-2px);box-shadow:var(--sh);}
.badge-ic{font-size:28px;margin-bottom:6px;line-height:1;}
.badge-name{font-size:12px;font-weight:800;margin-bottom:3px;}
.badge-desc{font-size:10px;color:var(--tx3);line-height:1.4;}
.badge-card.locked .badge-ic{filter:grayscale(1);opacity:.35;}
.badge-card.locked .badge-name{color:var(--tx3);}
.badge-earn-bd{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:400;pointer-events:none;background:rgba(0,0,0,.6);}
.badge-earn-box{background:linear-gradient(135deg,#2c2060,var(--pu));border-radius:var(--rl);padding:32px 48px;text-align:center;box-shadow:0 0 80px rgba(124,111,247,.55);animation:lvlIn .44s cubic-bezier(.34,1.56,.64,1);}
.badge-earn-box .big-ic{font-size:52px;margin-bottom:10px;}
.badge-earn-box h2{font-size:24px;font-weight:900;color:#fff;margin-bottom:4px;}
.badge-earn-box p{color:rgba(255,255,255,.8);font-size:13px;}

/* ── In-app notification banner (kid mode approval feedback) ── */
.inkid-notif{position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:900;display:flex;align-items:center;gap:12px;padding:13px 20px;border-radius:var(--rl);box-shadow:0 8px 40px rgba(0,0,0,.55);animation:notifIn .35s cubic-bezier(.34,1.56,.64,1);min-width:260px;max-width:92vw;}
.inkid-notif.approved{background:linear-gradient(135deg,#0f6e56,#2dd4a7);}
.inkid-notif.denied{background:linear-gradient(135deg,#6e1a1a,#f06060);}
.inkid-notif .ni-ic{font-size:26px;flex-shrink:0;}
.inkid-notif .ni-title{font-size:14px;font-weight:800;color:#fff;}
.inkid-notif .ni-sub{font-size:11px;color:rgba(255,255,255,.8);margin-top:2px;}
@keyframes notifIn{from{opacity:0;transform:translateX(-50%) translateY(-24px) scale(.92);}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1);}}

/* ── Quests / badge view in kid mode ── */
.quest-card{background:var(--s1);border:1px solid var(--b1);border-radius:var(--rl);padding:16px;margin-bottom:10px;display:flex;gap:14px;align-items:flex-start;}
.quest-card.done{opacity:.55;}
.quest-ic{font-size:26px;width:42px;text-align:center;flex-shrink:0;}
.quest-name{font-size:14px;font-weight:700;margin-bottom:3px;}
.quest-desc{font-size:11px;color:var(--tx2);margin-bottom:8px;}
.quest-track{height:5px;background:var(--s3);border-radius:3px;overflow:hidden;}
.quest-fill{height:100%;border-radius:3px;transition:width .7s cubic-bezier(.34,1.56,.64,1);}
`;

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS & HELPERS
═══════════════════════════════════════════════════════════════════════════ */
function getColor(idx){return COLORS[idx]||COLORS[0];}
const COLORS=[
  {bg:"#7c6ff7",tx:"#fff",gw:"#7c6ff7"},
  {bg:"#2dd4a7",tx:"#081f18",gw:"#2dd4a7"},
  {bg:"#f5a623",tx:"#2a1800",gw:"#f5a623"},
  {bg:"#e879a0",tx:"#fff",gw:"#e879a0"},
  {bg:"#4a9eff",tx:"#fff",gw:"#4a9eff"},
  {bg:"#888780",tx:"#fff",gw:"#888780"},
];
const PARENTS0=[
  {id:"p1",name:"Greg",  colorIdx:4,initials:"GW",isParent:true},
  {id:"p2",name:"Parent 2",colorIdx:5,initials:"P2",isParent:true},
];

const XP_TO_CENTS = 10;
function xpToCents(xp){ return xp * XP_TO_CENTS; }
function centsToDisplay(c){ return `$${(c/100).toFixed(2)}`; }
function centsShort(c){
  const d=c/100;
  return d===Math.floor(d)?`$${d.toFixed(0)}`:d<10?`$${d.toFixed(2)}`:`$${d.toFixed(1)}`;
}

const DIFF={
  trivial:{lbl:"Trivial",xp:5,  cls:"bd1",icon:"✨"},
  easy:   {lbl:"Easy",   xp:10, cls:"bd2",icon:"⚡"},
  medium: {lbl:"Medium", xp:25, cls:"bd3",icon:"🔥"},
  hard:   {lbl:"Hard",   xp:50, cls:"bd4",icon:"💪"},
  boss:   {lbl:"Boss",   xp:100,cls:"bd5",icon:"⚔️"},
};

const FREQ={daily:"Daily",weekly:"Weekly",monthly:"Monthly",once:"One-time"};
const DAY_NAMES=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];

const DEFAULT_STORE=[
  {id:"s1", name:"30 min extra screen time", desc:"TV, YouTube, or games",          emoji:"📱", priceXp:20,  cat:"screen"},
  {id:"s2", name:"1 hour extra screen time",  desc:"Your choice of device",          emoji:"🖥️", priceXp:35,  cat:"screen"},
  {id:"s3", name:"Stay up 30 min later",      desc:"One night, parent approved",      emoji:"🌙", priceXp:30,  cat:"privilege"},
  {id:"s4", name:"Pick tonight's dinner",      desc:"Family votes after you choose",  emoji:"🍕", priceXp:40,  cat:"food"},
  {id:"s5", name:"Dessert of your choice",     desc:"Sweet treat after dinner",       emoji:"🍦", priceXp:15,  cat:"food"},
  {id:"s6", name:"Skip one chore",             desc:"One pass — parent picks which",  emoji:"🎟️", priceXp:75,  cat:"privilege"},
  {id:"s8", name:"Movie night pick",           desc:"You choose the family movie",    emoji:"🎬", priceXp:60,  cat:"social"},
  {id:"s9", name:"$5 cash payout",            desc:"Real money, handed over by parent",emoji:"💵",priceXp:50,  cat:"cash"},
  {id:"s10",name:"$10 cash payout",           desc:"Real money, handed over by parent",emoji:"💰",priceXp:100, cat:"cash"},
  {id:"s11",name:"Family activity pick",       desc:"Bowling, mini golf, laser tag…", emoji:"🎳", priceXp:200, cat:"social"},
  {id:"s12",name:"No homework pass",          desc:"One night off, parent approved",  emoji:"📚", priceXp:80,  cat:"privilege"},
];
const STORE_CATS=["all","screen","food","privilege","social","cash","xp","custom"];

/* ── Badge definitions ─────────────────────────────────────────────────── */
const BADGE_DEFS=[
  {id:"streak_3",    name:"Getting Started",  emoji:"⚡", desc:"Earn a 3-day streak",           check:(k)=>k.streak>=3},
  {id:"streak_7",    name:"On a Roll",        emoji:"🔥", desc:"Earn a 7-day streak",           check:(k)=>k.streak>=7},
  {id:"streak_14",   name:"Two Weeks Strong", emoji:"💥", desc:"Earn a 14-day streak",          check:(k)=>k.streak>=14},
  {id:"streak_30",   name:"Unstoppable",      emoji:"🌟", desc:"Earn a 30-day streak",          check:(k)=>k.streak>=30},
  {id:"xp_100",      name:"Century",          emoji:"💯", desc:"Earn 100 total XP",             check:(k)=>k.xp>=100},
  {id:"xp_500",      name:"XP Hoarder",       emoji:"💎", desc:"Earn 500 total XP",             check:(k)=>k.xp>=500},
  {id:"xp_1000",     name:"Legend",           emoji:"👑", desc:"Earn 1,000 total XP",           check:(k)=>k.xp>=1000},
  {id:"xp_5000",     name:"Hall of Fame",     emoji:"🏛️", desc:"Earn 5,000 total XP",           check:(k)=>k.xp>=5000},
  {id:"chores_10",   name:"Helper",           emoji:"🤝", desc:"Complete 10 chores",            check:(_,s)=>s.choresDone>=10},
  {id:"chores_50",   name:"Dedicated",        emoji:"🎖️", desc:"Complete 50 chores",            check:(_,s)=>s.choresDone>=50},
  {id:"chores_100",  name:"Century Chores",   emoji:"🏅", desc:"Complete 100 chores",           check:(_,s)=>s.choresDone>=100},
  {id:"weekly_first",name:"Goal Getter",      emoji:"🎯", desc:"Hit a weekly XP goal",          check:(_,s)=>s.weeklyHits>=1},
  {id:"weekly_5",    name:"Weekly Warrior",   emoji:"📅", desc:"Hit 5 weekly XP goals",         check:(_,s)=>s.weeklyHits>=5},
  {id:"monthly_first",name:"Monthly Master",  emoji:"🏆", desc:"Hit a monthly XP goal",         check:(_,s)=>s.monthlyHits>=1},
  {id:"grab_first",  name:"Opportunist",      emoji:"🙋", desc:"Claim your first grab chore",   check:(_,s)=>s.grabsDone>=1},
  {id:"grab_10",     name:"Go-Getter",        emoji:"🏃", desc:"Claim 10 grab chores",          check:(_,s)=>s.grabsDone>=10},
  {id:"boss_first",  name:"Boss Slayer",      emoji:"⚔️", desc:"Complete a Boss-level chore",   check:(_,s)=>s.bossChoresDone>=1},
  {id:"lvl_5",       name:"Rising Star",      emoji:"🌠", desc:"Reach Level 5",                 check:(k)=>levelFromXp(k.xp)>=5},
  {id:"lvl_10",      name:"Pro",              emoji:"🚀", desc:"Reach Level 10",                check:(k)=>levelFromXp(k.xp)>=10},
];

function getBadgeStats(kidId,compsAll,chores){
  let choresDone=0,weeklyHits=0,monthlyHits=0,grabsDone=0,bossChoresDone=0;
  Object.values(compsAll).forEach(dayComps=>{
    Object.values(dayComps).forEach(c=>{
      if(c.status!=="approved"||c.kidId!==kidId)return;
      choresDone++;
      const chore=chores.find(x=>x.id===c.choreId);
      if(chore?.upForGrabs)grabsDone++;
      if(chore?.diff==="boss")bossChoresDone++;
    });
  });
  return{choresDone,weeklyHits,monthlyHits,grabsDone,bossChoresDone};
}

function getNewBadges(kid,stats){
  const earned=new Set(kid.badges||[]);
  return BADGE_DEFS.filter(b=>!earned.has(b.id)&&b.check(kid,stats));
}


function xpForLevel(l){return Math.floor(100*Math.pow(l,1.6));}
function levelFromXp(xp){let l=1;while(xp>=xpForLevel(l+1))l++;return l;}
function streakMult(s){if(s>=30)return 2;if(s>=14)return 1.5;if(s>=7)return 1.25;if(s>=4)return 1.1;return 1;}
function dateKey(d){const dt=d||new Date();return`${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;}
function today(){return dateKey();}
function isFuture(dk){return dk>today();}
function isPast(dk){return dk<today();}
function parseDate(dk){const[y,m,d]=dk.split('-').map(Number);return new Date(y,m-1,d);}
function ckey(cid,kid){return`${cid}__${kid}`;}

function weekKey(dk){
  const d=parseDate(dk),jan1=new Date(d.getFullYear(),0,1);
  const wk=Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
  return`${d.getFullYear()}-W${String(wk).padStart(2,'0')}`;
}
function monthKey(dk){const[y,m]=dk.split('-');return`${y}-${m}`;}
function currentWeekKey(){return weekKey(today());}
function currentMonthKey(){return monthKey(today());}

function choreAppearsOnDate(chore,dk){
  if(chore.deletedAfter&&dk>=chore.deletedAfter)return false;
  const{freq,scheduleType,scheduleDays=[]}=chore;
  if(freq==="weekly"||freq==="monthly"||freq==="once")return true;
  if(scheduleType==="fixed"){if(!scheduleDays?.length)return true;return scheduleDays.includes(parseDate(dk).getDay());}
  return true;
}
function scheduleLabel(chore){
  if(chore.freq!=="daily"||chore.scheduleType!=="fixed"||!chore.scheduleDays?.length)return null;
  return chore.scheduleDays.map(d=>DAY_NAMES[d]).join(", ");
}

/* ─── Toast hook ─────────────────────────────────────────────────────────── */
let _tid=0;
function useToasts(){
  const[toasts,setToasts]=useState([]);
  const add=useCallback((msg,xp=null,cents=null)=>{
    const id=++_tid;
    setToasts(t=>[...t,{id,msg,xp,cents}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),2800);
  },[]);
  return{toasts,add};
}

/* ─── Firebase hook ──────────────────────────────────────────────────────── */
function useFB(){
  const ready = isConfigured();
  const write  = useCallback(dbWrite,  []);
  const merge  = useCallback(dbMerge,  []);
  const listen = useCallback(dbListen, []);
  const del    = useCallback(dbDelete, []);
  return{ready,write,merge,listen,del};
}

/* ─── PIN helpers ──────────────────────────────────────────────────────────── */
async function hashPIN(pin){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('wh_salt_'+pin));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function verifyPIN(pin,stored){return await hashPIN(pin)===stored;}
function getStoredPINHash(){return localStorage.getItem('wh_pin_hash')||null;}
async function storePINHash(pin){localStorage.setItem('wh_pin_hash',await hashPIN(pin));}
function isPINSet(){return!!getStoredPINHash();}

/* ─── Streak reset helper ─────────────────────────────────────────────────── */
function checkStreakReset(kids,today_key){
  return kids.map(k=>{
    if(!k.lastActiveDate) return k;
    const last=k.lastActiveDate;
    const d1=new Date(last),d2=new Date(today_key);
    const diffDays=Math.round((d2-d1)/86400000);
    if(diffDays>=2) return{...k,streak:0};
    return k;
  });
}

/* ─── Seed data ──────────────────────────────────────────────────────────── */
const KIDS0=[
  {id:"k1",name:"Jordan",age:17,colorIdx:0,xp:420,streak:14,initials:"JW",
   balanceCents:4200,
   goal:{weeklyXpTarget:100,weeklyBonusCents:500,monthlyXpTarget:400,monthlyBonusCents:2000,overageRate:10}},
  {id:"k2",name:"Morgan",age:14,colorIdx:1,xp:280,streak:5,initials:"MW",
   balanceCents:2800,
   goal:{weeklyXpTarget:75,weeklyBonusCents:400,monthlyXpTarget:300,monthlyBonusCents:1500,overageRate:10}},
  {id:"k3",name:"Riley",age:9,colorIdx:2,xp:95,streak:1,initials:"RW",
   balanceCents:950,
   goal:{weeklyXpTarget:40,weeklyBonusCents:200,monthlyXpTarget:150,monthlyBonusCents:800,overageRate:10}},
];
const CHORES0=[
  {id:"c1", title:"Make your bed",        diff:"trivial",freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k3"],      requiresApproval:false,upForGrabs:false},
  {id:"c2", title:"Unload dishwasher",    diff:"easy",   freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k2","k1"],  requiresApproval:false,upForGrabs:false},
  {id:"c6", title:"Set dinner table",     diff:"trivial",freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k3"],       requiresApproval:false,upForGrabs:false},
  {id:"c9", title:"Feed the dog",         diff:"trivial",freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k3"],       requiresApproval:false,upForGrabs:false},
  {id:"c10",title:"Wipe kitchen counters",diff:"easy",   freq:"daily",  scheduleType:"daily",scheduleDays:[],assignedTo:["k2"],       requiresApproval:false,upForGrabs:false},
  {id:"c7", title:"Tidy bedroom",         diff:"easy",   freq:"daily",  scheduleType:"fixed",scheduleDays:[1,3,5],assignedTo:["k1","k2","k3"],requiresApproval:false,upForGrabs:false},
  {id:"c11",title:"Take out trash",       diff:"easy",   freq:"daily",  scheduleType:"fixed",scheduleDays:[0,3],  assignedTo:["k1"],  requiresApproval:false,upForGrabs:false},
  {id:"c3", title:"Take out recycling",   diff:"easy",   freq:"weekly", scheduleType:"daily",scheduleDays:[],assignedTo:["k1"],        requiresApproval:false,upForGrabs:false},
  {id:"c4", title:"Vacuum living room",   diff:"medium", freq:"weekly", scheduleType:"daily",scheduleDays:[],assignedTo:["k2"],        requiresApproval:true, upForGrabs:false},
  {id:"c5", title:"Clean bathroom",       diff:"hard",   freq:"weekly", scheduleType:"daily",scheduleDays:[],assignedTo:["k1"],        requiresApproval:true, upForGrabs:false},
  {id:"c8", title:"Organize garage",      diff:"boss",   freq:"monthly",scheduleType:"daily",scheduleDays:[],assignedTo:["k1","k2"],   requiresApproval:true, upForGrabs:false},
];

/* ═══════════════════════════════════════════════════════════════════════════
   TOP-LEVEL MODAL COMPONENTS
═══════════════════════════════════════════════════════════════════════════ */

function GoalModal({kid,editGoal,setEditGoal,onClose,onSave,centsShort,xpToCents}){
  if(!kid)return null;
  const eg=editGoal;
  return <div className="mbd" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">Goals — {kid.name}</div>
    <div style={{background:"var(--s2)",borderRadius:"var(--rs)",padding:"10px 13px",marginBottom:16,fontSize:12,color:"var(--pul)"}}>
      10 XP = $1.00 · Streak multiplier applies to earnings
    </div>
    <div style={{fontSize:12,fontWeight:800,color:"var(--tx2)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Weekly goal</div>
    <div className="f2">
      <div className="fg"><label className="fl">XP target / week</label><input className="fi" type="number" value={eg.weeklyXpTarget} onChange={e=>setEditGoal(g=>({...g,weeklyXpTarget:+e.target.value||0}))}/></div>
      <div className="fg"><label className="fl">Bonus on completion ($)</label><input className="fi" type="number" step=".25" value={(eg.weeklyBonusCents/100).toFixed(2)} onChange={e=>setEditGoal(g=>({...g,weeklyBonusCents:Math.round(+e.target.value*100)||0}))}/></div>
    </div>
    <div style={{fontSize:12,fontWeight:800,color:"var(--tx2)",textTransform:"uppercase",letterSpacing:".06em",marginBottom:10,marginTop:4}}>Monthly goal</div>
    <div className="f2">
      <div className="fg"><label className="fl">XP target / month</label><input className="fi" type="number" value={eg.monthlyXpTarget} onChange={e=>setEditGoal(g=>({...g,monthlyXpTarget:+e.target.value||0}))}/></div>
      <div className="fg"><label className="fl">Bonus on completion ($)</label><input className="fi" type="number" step=".25" value={(eg.monthlyBonusCents/100).toFixed(2)} onChange={e=>setEditGoal(g=>({...g,monthlyBonusCents:Math.round(+e.target.value*100)||0}))}/></div>
    </div>
    <div className="fg"><label className="fl">Overage rate (XP above monthly goal)</label>
      <select className="fi" value={eg.overageRate} onChange={e=>setEditGoal(g=>({...g,overageRate:+e.target.value}))}>
        <option value={5}>$0.50 per extra XP (half rate)</option>
        <option value={10}>$1.00 per extra XP (standard)</option>
        <option value={15}>$1.50 per extra XP (bonus rate)</option>
        <option value={20}>$2.00 per extra XP (double rate)</option>
      </select>
    </div>
    <div className="preview-box"><div className="preview-box-t">Preview</div><div className="preview-row">
      <div>📅 Hit <strong style={{color:"var(--bl)"}}>{eg.weeklyXpTarget} XP/week</strong> → <strong style={{color:"var(--bl)"}}>${(eg.weeklyBonusCents/100).toFixed(2)} bonus</strong></div>
      <div>🏆 Hit <strong style={{color:"var(--am)"}}>{eg.monthlyXpTarget} XP/month</strong> → <strong style={{color:"var(--am)"}}>${(eg.monthlyBonusCents/100).toFixed(2)} bonus</strong></div>
      <div>⚡ Each XP above monthly goal → <strong style={{color:"var(--te)"}}>${(eg.overageRate/100).toFixed(2)} extra</strong></div>
    </div></div>
    <div className="fax"><button className="btn btn-g" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={onSave}>Save goals</button></div>
  </div></div>;
}

function AddChoreModal({cf,setCf,kids,parents,onClose,onSave,toggleDay}){
  const isFixed=cf.freq==="daily"&&cf.scheduleType==="fixed";
  const xp=DIFF[cf.diff]?.xp||0;
  return <div className="mbd" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">Add chore</div>
    <div className="fg"><label className="fl">Title</label>
      <input className="fi" placeholder="e.g. Clean the bathroom" autoFocus
        value={cf.title} onChange={e=>setCf(f=>({...f,title:e.target.value}))}/>
    </div>
    <div className="f2">
      <div className="fg"><label className="fl">Difficulty</label><select className="fi" value={cf.diff} onChange={e=>setCf(f=>({...f,diff:e.target.value}))}>
        {Object.entries(DIFF).map(([k,v])=><option key={k} value={k}>{v.lbl} — {v.xp} XP</option>)}</select></div>
      <div className="fg"><label className="fl">Frequency</label><select className="fi" value={cf.freq} onChange={e=>setCf(f=>({...f,freq:e.target.value,scheduleType:"daily",scheduleDays:[]}))}>
        <option value="daily">Daily / Scheduled</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="once">One-time</option></select></div>
    </div>
    {cf.freq==="daily"&&<div className="fg"><label className="fl">Schedule</label>
      <div className="smode">
        <button className={`smode-btn${cf.scheduleType==="daily"?" on":""}`} onClick={()=>setCf(f=>({...f,scheduleType:"daily",scheduleDays:[]}))}>Every day</button>
        <button className={`smode-btn${cf.scheduleType==="fixed"?" on":""}`} onClick={()=>setCf(f=>({...f,scheduleType:"fixed"}))}>Specific days</button>
      </div>
      {cf.scheduleType==="fixed"&&<><div className="daypicker">{DAY_NAMES.map((name,dow)=><div key={dow} className={`daychip${cf.scheduleDays.includes(dow)?" on":""}`} onClick={()=>toggleDay(dow)}>{name.slice(0,1)}</div>)}</div>
        {cf.scheduleDays.length>0&&<div className="fhint" style={{marginTop:6}}>{cf.scheduleDays.map(d=>DAY_NAMES[d]).join(", ")}</div>}
        {!cf.scheduleDays.length&&<div className="fhint" style={{color:"var(--co)",marginTop:6}}>Select at least one day.</div>}
      </>}
    </div>}
    <div className="fg">
      <div className="swrow" style={{padding:"5px 0"}}>
        <div>
          <label className="fl" style={{marginBottom:2}}>Up for Grabs</label>
          <div className="fhint" style={{marginTop:0}}>Any family member can claim this chore</div>
        </div>
        <label className="sw"><input type="checkbox" checked={cf.upForGrabs||false}
          onChange={e=>setCf(f=>({...f,upForGrabs:e.target.checked,assignedTo:e.target.checked?[]:f.assignedTo}))}/>
          <div className="sw-tr"/><div className="sw-th"/></label>
      </div>
    </div>
    {!cf.upForGrabs&&<div className="fg"><label className="fl">Assign to</label><div className="agrid">{[...(kids||[]),...(parents||[])].map(k=>{const cc=getColor(k.colorIdx);const sel=cf.assignedTo.includes(k.id);
      return <div key={k.id} className={`achip${sel?" sel":""}`} onClick={()=>setCf(f=>({...f,assignedTo:sel?f.assignedTo.filter(x=>x!==k.id):[...f.assignedTo,k.id]}))}>
        <span className="adot" style={{background:cc.bg}}/>{k.name}{k.isParent?" 👤":""}</div>;})}
    </div></div>}
    <div className="fg"><div className="swrow" style={{padding:"5px 0"}}><label className="fl" style={{marginBottom:0}}>Requires approval</label>
      <label className="sw"><input type="checkbox" checked={cf.requiresApproval} onChange={e=>setCf(f=>({...f,requiresApproval:e.target.checked}))}/><div className="sw-tr"/><div className="sw-th"/></label></div></div>
    {xp>0&&<div className="fhint" style={{marginBottom:0}}>Earns: {xp} XP per completion</div>}
    <div className="fax"><button className="btn btn-g" onClick={onClose}>Cancel</button>
      <button className="btn btn-p" disabled={!cf.title.trim()||(!cf.upForGrabs&&!cf.assignedTo.length)||(isFixed&&!cf.scheduleDays.length)} onClick={onSave}>Add chore</button></div>
  </div></div>;
}

function AddKidModal({kf,setKf,onClose,onSave}){
  return <div className="mbd" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">Add family member</div>
    <div className="fg"><label className="fl">Name</label>
      <input className="fi" placeholder="Jordan" autoFocus value={kf.name} onChange={e=>setKf(f=>({...f,name:e.target.value}))}/>
    </div>
    <div className="f2">
      <div className="fg"><label className="fl">Age</label><input className="fi" type="number" placeholder="14" value={kf.age} onChange={e=>setKf(f=>({...f,age:e.target.value}))}/></div>
      <div className="fg"><label className="fl">Initials</label><input className="fi" placeholder="JW" maxLength={2} value={kf.initials} onChange={e=>setKf(f=>({...f,initials:e.target.value.toUpperCase()}))}/></div>
    </div>
    <div className="fax"><button className="btn btn-g" onClick={onClose}>Cancel</button><button className="btn btn-p" onClick={onSave}>Add</button></div>
  </div></div>;
}

function AddItemModal({itemF,setItemF,onClose,onSave}){
  return <div className="mbd" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">Add store item</div>
    <div className="f2">
      <div className="fg"><label className="fl">Emoji</label><input className="fi" value={itemF.emoji} onChange={e=>setItemF(f=>({...f,emoji:e.target.value}))}/></div>
      <div className="fg"><label className="fl">Price (XP)</label><input className="fi" type="number" step="1" value={itemF.priceXp||0} onChange={e=>setItemF(f=>({...f,priceXp:Math.round(+e.target.value)||0}))}/></div>
    </div>
    <div className="fg"><label className="fl">Name</label>
      <input className="fi" placeholder="Movie night pick" autoFocus value={itemF.name} onChange={e=>setItemF(f=>({...f,name:e.target.value}))}/>
    </div>
    <div className="fg"><label className="fl">Description</label><input className="fi" placeholder="Short description" value={itemF.desc} onChange={e=>setItemF(f=>({...f,desc:e.target.value}))}/></div>
    <div className="fax"><button className="btn btn-g" onClick={onClose}>Cancel</button><button className="btn btn-p" disabled={!itemF.name.trim()} onClick={onSave}>Add item</button></div>
  </div></div>;
}

function EditChoreModal({editChore,setEditChore,kids,parents,onSave,onDelete}){
  if(!editChore)return null;
  const ec=editChore;
  const setEc=fn=>setEditChore(prev=>({...prev,...fn(prev)}));
  const isFixed=ec.freq==="daily"&&ec.scheduleType==="fixed";
  return <div className="mbd" onClick={()=>setEditChore(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">Edit chore</div>
    <div className="fg"><label className="fl">Title</label>
      <input className="fi" autoFocus value={ec.title} onChange={e=>setEc(p=>({...p,title:e.target.value}))}/>
    </div>
    <div className="f2">
      <div className="fg"><label className="fl">Difficulty</label><select className="fi" value={ec.diff} onChange={e=>setEc(p=>({...p,diff:e.target.value}))}>
        {Object.entries(DIFF).map(([k,v])=><option key={k} value={k}>{v.lbl} — {v.xp} XP</option>)}</select></div>
      <div className="fg"><label className="fl">Frequency</label><select className="fi" value={ec.freq} onChange={e=>setEc(p=>({...p,freq:e.target.value,scheduleType:"daily",scheduleDays:[]}))}>
        <option value="daily">Daily / Scheduled</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="once">One-time</option></select></div>
    </div>
    {ec.freq==="daily"&&<div className="fg"><label className="fl">Schedule</label>
      <div className="smode">
        <button className={`smode-btn${ec.scheduleType==="daily"?" on":""}`} onClick={()=>setEc(p=>({...p,scheduleType:"daily",scheduleDays:[]}))}>Every day</button>
        <button className={`smode-btn${ec.scheduleType==="fixed"?" on":""}`} onClick={()=>setEc(p=>({...p,scheduleType:"fixed"}))}>Specific days</button>
      </div>
      {ec.scheduleType==="fixed"&&<div className="daypicker">{DAY_NAMES.map((name,dow)=>{
        const on=ec.scheduleDays.includes(dow);
        return <div key={dow} className={`daychip${on?" on":""}`} onClick={()=>setEc(p=>({...p,scheduleDays:on?p.scheduleDays.filter(d=>d!==dow):[...p.scheduleDays,dow].sort((a,b)=>a-b)}))}>
          {name.slice(0,1)}</div>;
      })}</div>}
    </div>}
    <div className="fg">
      <div className="swrow" style={{padding:"5px 0"}}>
        <div>
          <label className="fl" style={{marginBottom:2}}>Up for Grabs</label>
          <div className="fhint" style={{marginTop:0}}>Any family member can claim this chore</div>
        </div>
        <label className="sw"><input type="checkbox" checked={ec.upForGrabs||false}
          onChange={e=>setEc(p=>({...p,upForGrabs:e.target.checked,assignedTo:e.target.checked?[]:p.assignedTo}))}/>
          <div className="sw-tr"/><div className="sw-th"/></label>
      </div>
    </div>
    {!ec.upForGrabs&&<div className="fg"><label className="fl">Assign to</label><div className="agrid">{[...(kids||[]),...(parents||[])].map(k=>{const cc=getColor(k.colorIdx);const sel=ec.assignedTo.includes(k.id);
      return <div key={k.id} className={`achip${sel?" sel":""}`} onClick={()=>setEc(p=>({...p,assignedTo:sel?p.assignedTo.filter(x=>x!==k.id):[...p.assignedTo,k.id]}))}>
        <span className="adot" style={{background:cc.bg}}/>{k.name}</div>;})}
    </div></div>}
    <div className="fg"><div className="swrow" style={{padding:"5px 0"}}><label className="fl" style={{marginBottom:0}}>Requires approval</label>
      <label className="sw"><input type="checkbox" checked={ec.requiresApproval} onChange={e=>setEc(p=>({...p,requiresApproval:e.target.checked}))}/><div className="sw-tr"/><div className="sw-th"/></label></div></div>
    <div className="fax">
      <button className="btn btn-no btn-sm" onClick={onDelete}>Delete</button>
      <div style={{flex:1}}/>
      <button className="btn btn-g" onClick={()=>setEditChore(null)}>Cancel</button>
      <button className="btn btn-p" disabled={!ec.title.trim()||(!ec.upForGrabs&&!ec.assignedTo.length)||(isFixed&&!ec.scheduleDays.length)} onClick={onSave}>Save</button>
    </div>
  </div></div>;
}

function EditKidModal({editKid,setEditKid,onSave}){
  if(!editKid)return null;
  return <div className="mbd" onClick={()=>setEditKid(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">Edit profile</div>
    <div className="fg"><label className="fl">Name</label>
      <input className="fi" autoFocus value={editKid.name} onChange={e=>setEditKid(p=>({...p,name:e.target.value}))}/>
    </div>
    <div className="f2">
      <div className="fg"><label className="fl">Age</label><input className="fi" type="number" value={editKid.age} onChange={e=>setEditKid(p=>({...p,age:parseInt(e.target.value)||p.age}))}/></div>
      <div className="fg"><label className="fl">Initials</label><input className="fi" maxLength={2} value={editKid.initials} onChange={e=>setEditKid(p=>({...p,initials:e.target.value.toUpperCase()}))}/></div>
    </div>
    <div className="fax"><button className="btn btn-g" onClick={()=>setEditKid(null)}>Cancel</button><button className="btn btn-p" onClick={onSave}>Save</button></div>
  </div></div>;
}

function DeleteChoreModal({choreId,chores,onForward,onPermanent,onCancel}){
  const chore=chores.find(c=>c.id===choreId);
  if(!chore)return null;
  return <div className="mbd" onClick={onCancel}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
    <div className="mt">Delete "{chore.title}"</div>
    <div style={{fontSize:13,color:"var(--tx2)",marginBottom:20,lineHeight:1.6}}>How would you like to delete this chore?</div>
    <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:18}}>
      <button className="btn" style={{background:"rgba(74,162,255,.1)",border:"1px solid rgba(74,162,255,.2)",color:"var(--bl)",padding:"14px 16px",textAlign:"left",borderRadius:"var(--r)",cursor:"pointer"}}
        onClick={onForward}>
        <div style={{fontWeight:800,marginBottom:3}}>📅 Delete going forward</div>
        <div style={{fontSize:11,opacity:.8}}>Chore disappears from today onwards. Past completions preserved.</div>
      </button>
      <button className="btn" style={{background:"rgba(240,96,96,.07)",border:"1px solid rgba(240,96,96,.18)",color:"var(--co)",padding:"14px 16px",textAlign:"left",borderRadius:"var(--r)",cursor:"pointer"}}
        onClick={onPermanent}>
        <div style={{fontWeight:800,marginBottom:3}}>🗑️ Delete permanently</div>
        <div style={{fontSize:11,opacity:.8}}>Removes the chore and all history. Cannot be undone.</div>
      </button>
    </div>
    <button className="btn btn-g" style={{width:"100%"}} onClick={onCancel}>Cancel</button>
  </div></div>;
}

function DenyModal({denyTarget,onConfirm,onCancel}){
  const[note,setNote]=useState("");
  if(!denyTarget)return null;
  return <div className="mbd" onClick={onCancel}><div className="deny-modal" onClick={e=>e.stopPropagation()}>
    <div className="mt" style={{marginBottom:12}}>Deny task</div>
    <div style={{fontSize:13,color:"var(--tx2)",marginBottom:14,lineHeight:1.5}}>
      Optionally tell <strong style={{color:"var(--tx1)"}}>{denyTarget.kidName}</strong> why "{denyTarget.choreName}" was denied.
    </div>
    <div className="fg">
      <label className="fl">Reason (optional)</label>
      <input className="fi" autoFocus placeholder="e.g. Needs to be redone — missed the corners"
        value={note} onChange={e=>setNote(e.target.value)}/>
    </div>
    <div className="fax">
      <button className="btn btn-g" onClick={onCancel}>Cancel</button>
      <button className="btn btn-no" onClick={()=>onConfirm(note)}>✕ Deny</button>
    </div>
  </div></div>;
}

/* ── BATCH 4: Allowance modal ── */
function AllowanceModal({kid,onClose,onSave}){
  const existing=kid?.allowance||{};
  const[amt,setAmt]=useState(existing.weeklyCents?((existing.weeklyCents/100).toFixed(2)):"");
  const[dow,setDow]=useState(existing.dayOfWeek??6); // default Saturday
  if(!kid)return null;
  const cents=Math.round((parseFloat(amt)||0)*100);
  return <div className="mbd" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:400}}>
    <div className="mt">📅 Allowance — {kid.name}</div>
    <div className="fg">
      <label className="fl">Weekly amount ($)</label>
      <input className="fi" type="number" step=".25" autoFocus placeholder="e.g. 5.00" value={amt} onChange={e=>setAmt(e.target.value)}/>
      <div className="fhint">Set to 0 or leave blank to disable allowance.</div>
    </div>
    <div className="fg">
      <label className="fl">Pay day</label>
      <div className="daypicker">{DAY_NAMES.map((name,d)=>(
        <div key={d} className={`daychip${dow===d?" on":""}`} onClick={()=>setDow(d)}>{name.slice(0,3)}</div>
      ))}</div>
    </div>
    {cents>0&&<div style={{background:"rgba(74,196,125,.08)",border:"1px solid rgba(74,196,125,.18)",borderRadius:"var(--rs)",padding:"10px 13px",fontSize:12,color:"var(--gn)",marginBottom:4}}>
      {kid.name} will receive {centsToDisplay(cents)} every {DAY_NAMES[dow]}.
    </div>}
    <div className="fax">
      <button className="btn btn-g" onClick={onClose}>Cancel</button>
      <button className="btn btn-p" onClick={()=>onSave(kid.id,cents,dow)}>{cents>0?"Save allowance":"Remove allowance"}</button>
    </div>
  </div></div>;
}

/* ── BATCH 5: Change PIN modal ── */
function ChangePINModal({onClose,onSaved}){
  const[entry,setEntry]=useState('');
  const[step,setStep]=useState(1);
  const[first,setFirst]=useState('');
  const[error,setError]=useState(false);

  async function handleKey(key){
    if(key==='del'){setEntry(p=>p.slice(0,-1));setError(false);return;}
    const next=entry+key;
    setEntry(next);
    if(next.length<4)return;
    setTimeout(async()=>{
      if(step===1){setFirst(next);setEntry('');setStep(2);}
      else{
        if(next===first){
          await storePINHash(next);
          onSaved();
        } else {
          setError(true);
          setTimeout(()=>{setEntry('');setFirst('');setStep(1);setError(false);},700);
        }
      }
    },80);
  }

  const dots=[0,1,2,3];
  return <div className="mbd" onClick={onClose}><div className="pin-box" style={{background:"var(--s1)",border:"1px solid var(--b2)"}} onClick={e=>e.stopPropagation()}>
    <div className="pin-title">{step===1?"Set new PIN":"Confirm new PIN"}</div>
    <div className="pin-sub">{step===1?"Enter a 4-digit PIN":"Enter the same PIN again"}</div>
    <div className="pin-dots">
      {dots.map(i=><div key={i} className={`pin-dot${i<entry.length?' filled':''}${error?' error':''}`}/>)}
    </div>
    <div className="pin-pad">
      {['1','2','3','4','5','6','7','8','9','','0','del'].map((k,i)=>
        k===''?<div key={i}/>:
        <button key={i} className={`pin-key${k==='del'?' del':''}`} onClick={()=>handleKey(k)}>
          {k==='del'?'⌫':k}
        </button>
      )}
    </div>
    <button className="btn btn-g" style={{width:'100%'}} onClick={onClose}>Cancel</button>
  </div></div>;
}

function GrabChoreCard({chore,dk,kids,parents,comps,grabs,activeKid,parentMode,claimGrab,releaseGrab,completeChore,ckey,DIFF,xpToCents,centsShort,isPast,streakMult,kidById}){
  const todayGrabs=grabs[dk]||{};
  const claimedBy=todayGrabs[chore.id]||null;
  const claimedMember=claimedBy?([...kids,...parents].find(m=>m.id===claimedBy)):null;
  const comp=claimedBy?comps[dk]?.[ckey(chore.id,claimedBy)]:null;
  const isDone=comp?.status==='approved';
  const isPend=comp?.status==='pending';
  const past=isPast(dk)&&dk!==today();
  const myGrab=activeKid&&claimedBy===activeKid;
  const xp=DIFF[chore.diff]?.xp||0;
  const mult=activeKid?streakMult(kidById(activeKid)?.streak||0):1;
  const effectiveXp=Math.round(xp*(past?.75:1)*mult);

  return(
    <div className={`ccard${isDone?" cdone":""}`} style={{borderColor:claimedBy&&!isDone?"rgba(245,166,35,.3)":""}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:7}}>
        <div className="ct" style={{margin:0,flex:1,textDecoration:isDone?"line-through":""}}>{chore.title}</div>
        <span style={{fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:5,background:"rgba(245,166,35,.14)",color:"var(--am)",flexShrink:0,marginLeft:8}}>🙋 Grab</span>
      </div>
      <div className="cm">
        <span className="badge bxp">+{effectiveXp} XP</span>
        <span className={`badge ${DIFF[chore.diff].cls}`}>{DIFF[chore.diff].lbl}</span>
      </div>
      {claimedMember&&!isDone&&<div style={{fontSize:11,color:"var(--am)",marginBottom:8,fontWeight:700}}>
        Claimed by {claimedMember.name}{myGrab?" (you)":""}
      </div>}
      {isDone&&claimedMember&&<div style={{fontSize:11,color:"var(--te)",marginBottom:8,fontWeight:700}}>✓ Done by {claimedMember.name}</div>}
      <div className="ca">
        {!claimedBy&&!isDone&&activeKid&&<button className="mkb" onClick={()=>claimGrab(chore.id,activeKid,dk)}>🙋 Claim this chore</button>}
        {myGrab&&!isDone&&!isPend&&<button className="mkb" onClick={()=>completeChore(chore.id,activeKid,dk)}>✓ Mark complete</button>}
        {myGrab&&!isDone&&!isPend&&<button className="mkb" style={{color:"var(--tx3)"}} onClick={()=>releaseGrab(chore.id,dk)}>↩ Release</button>}
        {myGrab&&isPend&&<button className="mkb pend">⏳ Awaiting approval</button>}
        {!claimedBy&&!isDone&&parentMode&&!activeKid&&[...kids,...parents].map(m=>(
          <button key={m.id} className="btn btn-g btn-sm" onClick={()=>claimGrab(chore.id,m.id,dk)}>
            {m.initials||m.name}
          </button>
        ))}
        {claimedBy&&!isDone&&!myGrab&&parentMode&&<button className="btn btn-ok btn-sm" onClick={()=>completeChore(chore.id,claimedBy,dk)}>✓ Mark done</button>}
        {claimedBy&&!isDone&&parentMode&&<button className="btn btn-g btn-sm" onClick={()=>releaseGrab(chore.id,dk)}>↩ Release</button>}
      </div>
    </div>
  );
}

function EditParentModal({editParent,setEditParent,onSave}){
  if(!editParent)return null;
  return <div className="mbd" onClick={()=>setEditParent(null)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth:360}}>
    <div className="mt">Edit parent profile</div>
    <div className="fg"><label className="fl">Name</label>
      <input className="fi" autoFocus value={editParent.name} onChange={e=>setEditParent(p=>({...p,name:e.target.value}))}/>
    </div>
    <div className="fg"><label className="fl">Initials</label>
      <input className="fi" maxLength={2} value={editParent.initials||''} onChange={e=>setEditParent(p=>({...p,initials:e.target.value.toUpperCase()}))}/>
    </div>
    <div className="fax">
      <button className="btn btn-g" onClick={()=>setEditParent(null)}>Cancel</button>
      <button className="btn btn-p" disabled={!editParent.name.trim()} onClick={onSave}>Save</button>
    </div>
  </div></div>;
}

function EditItemModal({editItem,setEditItem,onSave,onDelete}){
  if(!editItem)return null;
  return <div className="mbd" onClick={()=>setEditItem(null)}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">Edit store item</div>
    <div className="f2">
      <div className="fg"><label className="fl">Emoji</label>
        <input className="fi" value={editItem.emoji||'🎁'} onChange={e=>setEditItem(p=>({...p,emoji:e.target.value}))}/>
      </div>
      <div className="fg"><label className="fl">Price (XP)</label>
        <input className="fi" type="number" step="1" value={editItem.priceXp||0} onChange={e=>setEditItem(p=>({...p,priceXp:Math.round(+e.target.value)||0}))}/>
      </div>
    </div>
    <div className="fg"><label className="fl">Name</label>
      <input className="fi" autoFocus value={editItem.name||''} onChange={e=>setEditItem(p=>({...p,name:e.target.value}))}/>
    </div>
    <div className="fg"><label className="fl">Description</label>
      <input className="fi" value={editItem.desc||''} onChange={e=>setEditItem(p=>({...p,desc:e.target.value}))}/>
    </div>
    <div className="fax">
      <button className="btn btn-no btn-sm" onClick={onDelete}>Remove from store</button>
      <div style={{flex:1}}/>
      <button className="btn btn-g" onClick={()=>setEditItem(null)}>Cancel</button>
      <button className="btn btn-p" disabled={!editItem.name?.trim()} onClick={onSave}>Save</button>
    </div>
  </div></div>;
}

function ProfilePicker({kids,enterKidMode,enterParentMode,isPINSet}){
  return(
    <div className="picker-wrap">
      <div style={{fontSize:28,fontWeight:900,letterSpacing:'-.4px'}}>Watts<span style={{color:'var(--pu)'}}>Hub</span></div>
      <div style={{fontSize:13,color:'var(--tx2)'}}>Who's using the app?</div>
      <div className="picker-grid">
        {kids.map(k=>{
          const c=getColor(k.colorIdx);
          return(
            <div key={k.id} className="picker-card" onClick={()=>enterKidMode(k.id)}>
              <div style={{width:64,height:64,borderRadius:'50%',background:c.bg,color:c.tx,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:900}}>{k.initials}</div>
              <div style={{fontSize:14,fontWeight:800}}>{k.name}</div>
              <div style={{fontSize:11,color:'var(--tx2)'}}>Age {k.age}</div>
            </div>
          );
        })}
        <div className="picker-card parent" onClick={enterParentMode}>
          <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(124,111,247,.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🔑</div>
          <div style={{fontSize:14,fontWeight:800}}>Parent</div>
          <div style={{fontSize:11,color:'var(--tx2)'}}>{isPINSet()?'PIN required':'Tap to enter'}</div>
        </div>
      </div>
    </div>
  );
}

function PINScreen({pinEntry,pinError,pinMode,pinStep,handlePINKey,onBack}){
  const dots=[0,1,2,3];
  const label=pinMode==='set'?pinStep===1?'Set a parent PIN':'Confirm your PIN':'Enter parent PIN';
  const sublabel=pinMode==='set'?pinStep===1?'Choose a 4-digit PIN you will remember':'Enter the same PIN again':'Required to access parent controls';
  return(
    <div className="pin-wrap">
      <div className="pin-box">
        <div className="pin-title">{label}</div>
        <div className="pin-sub">{sublabel}</div>
        <div className="pin-dots">
          {dots.map(i=><div key={i} className={`pin-dot${i<pinEntry.length?' filled':''}${pinError?' error':''}`}/>)}
        </div>
        <div className="pin-pad">
          {['1','2','3','4','5','6','7','8','9','','0','del'].map((k,i)=>
            k===''?<div key={i}/>:
            <button key={i} className={`pin-key${k==='del'?' del':''}`} onClick={()=>handlePINKey(k)}>
              {k==='del'?'⌫':k}
            </button>
          )}
        </div>
        <button className="btn btn-g" style={{width:'100%'}} onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}

function BonusModal({kids,bonusKid,setBonusKid,bonusType,setBonusType,bonusAmt,setBonusAmt,bonusNote,setBonusNote,onClose,onSave}){
  const kid=kids.find(k=>k.id===bonusKid);
  return <div className="mbd" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}>
    <div className="mt">🎁 Give a bonus</div>
    <div className="fg"><label className="fl">Who gets the bonus?</label>
      <div className="agrid">{kids.map(k=>{const cc=getColor(k.colorIdx);const sel=bonusKid===k.id;
        return <div key={k.id} className={`achip${sel?" sel":""}`} onClick={()=>setBonusKid(k.id)}>
          <span className="adot" style={{background:cc.bg}}/>{k.name}</div>;})}
      </div>
    </div>
    <div className="fg"><label className="fl">Bonus type</label>
      <div className="bonus-grid">
        {[{id:"xp",ic:"⚡",lbl:"XP + Dollars"},{id:"dollars",ic:"💵",lbl:"Dollars only"},{id:"custom",ic:"🌟",lbl:"Custom reward"}].map(t=>(
          <div key={t.id} className={`bonus-type${bonusType===t.id?" sel":""}`} onClick={()=>setBonusType(t.id)}>
            <div className="bonus-type-ic">{t.ic}</div>
            <div className="bonus-type-lbl">{t.lbl}</div>
          </div>
        ))}
      </div>
    </div>
    {bonusType==="xp"&&<div className="fg"><label className="fl">XP amount</label>
      <input className="fi" type="number" autoFocus placeholder="e.g. 50" value={bonusAmt} onChange={e=>setBonusAmt(e.target.value)}/>
      {bonusAmt&&<div className="fhint">+{bonusAmt} XP & {bonusAmt>0?`$${(bonusAmt*0.1).toFixed(2)}`:"$0.00"} added to balance</div>}
    </div>}
    {bonusType==="dollars"&&<div className="fg"><label className="fl">Dollar amount</label>
      <input className="fi" type="number" step=".25" autoFocus placeholder="e.g. 5.00" value={bonusAmt} onChange={e=>setBonusAmt(e.target.value)}/>
    </div>}
    {bonusType==="custom"&&<div className="fg"><label className="fl">What's the reward?</label>
      <input className="fi" autoFocus placeholder="e.g. Extra hour of gaming tonight" value={bonusNote} onChange={e=>setBonusNote(e.target.value)}/>
      <div className="fhint">This is a treat — no XP or dollars, just a logged reward.</div>
    </div>}
    {bonusType!=="custom"&&<div className="fg"><label className="fl">Note (optional)</label>
      <input className="fi" placeholder="e.g. Great job this week!" value={bonusNote} onChange={e=>setBonusNote(e.target.value)}/>
    </div>}
    <div style={{background:"var(--s2)",borderRadius:"var(--rs)",padding:"10px 13px",marginBottom:4,fontSize:12,color:"var(--pul)"}}>
      {kid?`Bonus goes to: ${kid.name}`:"Select a family member above"}
    </div>
    <div className="fax"><button className="btn btn-g" onClick={onClose}>Cancel</button>
      <button className="btn btn-p" disabled={!bonusKid||(bonusType!=="custom"&&!bonusAmt)} onClick={onSave}>Give bonus 🎁</button>
    </div>
  </div></div>;
}

export default function WattsHub(){
  const{ready,write,merge,listen,del}=useFB();

  const[kids,setKids]=useState(KIDS0);
  const[parents,setParents]=useState(PARENTS0);
  const[chores,setChores]=useState(CHORES0);
  const[comps,setComps]=useState({});
  const[periodXp,setPeriodXp]=useState({});
  const[storeItems,setStoreItems]=useState(DEFAULT_STORE);
  const[purchases,setPurchases]=useState([]);
  const[txLog,setTxLog]=useState([]);
  const[grabs,setGrabs]=useState({});

  const[view,setView]=useState("dashboard");
  const[activeKid,setActiveKid]=useState(null);
  const[parentMode,setParentMode]=useState(true);
  const[selDate,setSelDate]=useState(today());
  const[calMonth,setCalMonth]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const[storeCat,setStoreCat]=useState("all");
  const[kmView,setKmView]=useState("chores");

  const[showAddChore,setShowAddChore]=useState(false);
  const[showAddKid,setShowAddKid]=useState(false);
  const[showAddItem,setShowAddItem]=useState(false);
  const[goalKid,setGoalKid]=useState(null);
  const[editGoal,setEditGoal]=useState({weeklyXpTarget:75,weeklyBonusCents:400,monthlyXpTarget:300,monthlyBonusCents:1500,overageRate:10});
  const[buyBanner,setBuyBanner]=useState(null);
  const[cf,setCf]=useState({title:"",diff:"easy",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:[],requiresApproval:false,upForGrabs:false});
  const[editChore,setEditChore]=useState(null);
  const[deleteChoreTarget,setDeleteChoreTarget]=useState(null);
  const[kf,setKf]=useState({name:"",age:"",initials:""});
  const[editKid,setEditKid]=useState(null);
  const[editParent,setEditParent]=useState(null);
  const[showBonus,setShowBonus]=useState(false);
  const[bonusKid,setBonusKid]=useState(null);
  const[bonusType,setBonusType]=useState("xp");
  const[bonusAmt,setBonusAmt]=useState("");
  const[bonusNote,setBonusNote]=useState("");
  const[itemF,setItemF]=useState({name:"",desc:"",emoji:"🎁",priceXp:30});
  const[editItem,setEditItem]=useState(null);
  const[lvlUp,setLvlUp]=useState(null);
  const[goalUnlock,setGoalUnlock]=useState(null);
  const[denyTarget,setDenyTarget]=useState(null);
  const[convertAmt,setConvertAmt]=useState("");
  // BATCH 4+5 state
  const[allowanceKid,setAllowanceKid]=useState(null);
  const[showChangePIN,setShowChangePIN]=useState(false);
  const[badgeEarned,setBadgeEarned]=useState(null);       // {id,name,emoji,desc}
  const[kidNotif,setKidNotif]=useState(null);              // {type:'approved'|'denied', choreName, note}
  const prevCompsRef=useRef({});
  const{toasts,add:toast}=useToasts();

  const[screen,setScreen]=useState('picker');
  const[pinEntry,setPinEntry]=useState('');
  const[pinError,setPinError]=useState(false);
  const[pinMode,setPinMode]=useState('verify');
  const[pinStep,setPinStep]=useState(1);
  const[pinFirst,setPinFirst]=useState('');

  useEffect(()=>{
    if(!ready)return;
    const u=[
      listen("wh/kids",     v=>{if(v)setKids(Object.values(v));}),
      listen("wh/parents",  v=>{if(v)setParents(Object.values(v));}),
      listen("wh/chores",   v=>{if(v)setChores(Object.values(v));}),
      listen("wh/comps",    v=>{setComps(v||{});}),
      listen("wh/periodXp", v=>{setPeriodXp(v||{});}),
      listen("wh/store",    v=>{
        const custom=v?Object.values(v):[];
        listen("wh/hiddenStoreItems",h=>{
          const hidden=h||{};
          setStoreItems([...DEFAULT_STORE.filter(i=>!hidden[i.id]),...custom]);
        });
      }),
      listen("wh/purchases",v=>{if(v)setPurchases(Object.values(v));}),
      listen("wh/txlog",    v=>{if(v)setTxLog(Object.values(v));}),
      listen("wh/grabs",    v=>{setGrabs(v||{});}),
    ];
    return()=>u.forEach(f=>f());
  },[ready,listen]);

  useEffect(()=>{
    if(!kids.length)return;
    const todayKey=today();
    const reset=checkStreakReset(kids,todayKey);
    reset.forEach((k,i)=>{
      if(k.streak!==kids[i].streak){
        setKids(prev=>prev.map(p=>p.id===k.id?{...p,streak:0}:p));
        if(ready)merge(`wh/kids/${k.id}`,{streak:0});
      }
    });
  },[ready]); // eslint-disable-line

  useEffect(()=>{
    if(!ready)return;
    const unsub=listen('wh/kids',v=>{
      if(!v){
        KIDS0.forEach(k=>write(`wh/kids/${k.id}`,k));
        CHORES0.forEach(c=>write(`wh/chores/${c.id}`,c));
        PARENTS0.forEach(p=>write(`wh/parents/${p.id}`,p));
      }
      unsub();
    });
  },[ready]); // eslint-disable-line

  /* ── FCM: register token when entering parent or kid mode ── */
  useEffect(()=>{
    if(!ready||screen!=='app')return;
    const userId=activeKid||'parent_default';
    registerFCMToken(userId).catch(()=>{});
    // Handle foreground push messages (show as toast)
    const unsub=onFCMMessage(payload=>{
      const{title,body}=payload.notification||{};
      if(title||body)toast(`${title||''}${body?' — '+body:''}`);
    });
    return unsub;
  },[ready,screen,activeKid]); // eslint-disable-line

  /* ── Kid-mode approval watcher ──
     Polls comps changes via the existing Firebase listener.
     When a pending item for the active kid flips to approved/denied,
     show an in-app banner notification.
  ── */
  useEffect(()=>{
    if(!activeKid||parentMode)return;
    const prev=prevCompsRef.current;
    // Walk every day's comps looking for status changes on this kid
    Object.entries(comps).forEach(([dk,dayComps])=>{
      Object.entries(dayComps).forEach(([ck,c])=>{
        if(c.kidId!==activeKid)return;
        const prevStatus=prev[dk]?.[ck]?.status;
        if(!prevStatus||prevStatus===c.status)return;
        if(prevStatus==='pending'&&c.status==='approved'){
          const chore=chores.find(x=>x.id===c.choreId);
          setKidNotif({type:'approved',choreName:chore?.title||'Chore',note:''});
          setTimeout(()=>setKidNotif(null),3500);
        }
        if(prevStatus==='pending'&&c.status==='denied'){
          const chore=chores.find(x=>x.id===c.choreId);
          setKidNotif({type:'denied',choreName:chore?.title||'Chore',note:c.denyNote||''});
          setTimeout(()=>setKidNotif(null),4500);
        }
      });
    });
    // Deep-clone comps into ref for next comparison
    prevCompsRef.current=JSON.parse(JSON.stringify(comps));
  },[comps]); // eslint-disable-line

  /* ── Helpers ── */
  const getComp=(dk,cid,kid)=>comps[dk]?.[ckey(cid,kid)]||null;
  const kidById=id=>kids.find(k=>k.id===id);
  const parentById=id=>parents.find(p=>p.id===id);
  const memberById=id=>kidById(id)||parentById(id);
  const balanceUnlocked=kidId=>{
    const kid=kidById(kidId);
    if(!kid||!kid.goal)return true;
    const mg=monthGoalStatus(kid);
    return mg?mg.hit:true;
  };
  const getKidPeriodXp=(kidId,pk)=>(periodXp[pk]?.[kidId])||0;
  const weekXpFor=kidId=>getKidPeriodXp(kidId,currentWeekKey());
  const monthXpFor=kidId=>getKidPeriodXp(kidId,currentMonthKey());

  const pending=()=>{
    const out=[];
    Object.entries(comps).forEach(([dk,dd])=>Object.entries(dd).forEach(([ck,c])=>{
      if(c.status==="pending")out.push({dk,ck,...c});
    }));
    return out.sort((a,b)=>b.ts-a.ts);
  };

  /* ── Goal status ── */
  function weekGoalStatus(kid){
    if(!kid.goal)return null;
    const{weeklyXpTarget:target,weeklyBonusCents:bonus}=kid.goal;
    const earned=weekXpFor(kid.id);
    const pct=Math.min(earned/target,1);
    const hit=earned>=target;
    const near=earned>=target*0.8&&!hit;
    return{earned,target,pct,hit,near,bonus};
  }

  function monthGoalStatus(kid){
    if(!kid.goal)return null;
    const{monthlyXpTarget:target,monthlyBonusCents:bonus,overageRate}=kid.goal;
    const earned=monthXpFor(kid.id);
    const pct=Math.min(earned/target,1);
    const hit=earned>=target;
    const over=Math.max(0,earned-target);
    const overCents=over*(overageRate||XP_TO_CENTS);
    const totalBonus=hit?bonus+overCents:0;
    const near=earned>=target*0.8&&!hit;
    return{earned,target,pct,hit,near,over,overCents,totalBonus,bonus};
  }

  /* ── Award XP + dollars ── */
  async function awardEarnings(kidId,chore,dk){
    const isParentMember=parents.some(p=>p.id===kidId);
    const dayMult=(isPast(dk)&&dk!==today())?0.75:1;
    const isToday=dk===today();

    if(isParentMember){
      const earnedXp=Math.round(DIFF[chore.diff].xp*dayMult);
      const wk=weekKey(dk);const mo=monthKey(dk);
      const newWkXp=getKidPeriodXp(kidId,wk)+earnedXp;
      const newMoXp=getKidPeriodXp(kidId,mo)+earnedXp;
      const txEntry={id:"tx"+Date.now(),kidId,type:"earn",xp:earnedXp,cents:0,desc:chore.title,ts:Date.now()};
      setPeriodXp(prev=>({...prev,[wk]:{...(prev[wk]||{}),[kidId]:newWkXp},[mo]:{...(prev[mo]||{}),[kidId]:newMoXp}}));
      setTxLog(prev=>[txEntry,...prev].slice(0,300));
      if(ready){await merge(`wh/periodXp/${wk}`,{[kidId]:newWkXp});await merge(`wh/periodXp/${mo}`,{[kidId]:newMoXp});await write(`wh/txlog/${txEntry.id}`,txEntry);}
      const parentName=parents.find(p=>p.id===kidId)?.name||'Parent';
      toast(`${parentName} +${earnedXp} XP${dayMult<1?' (75%)':''}`,earnedXp,null);
      return;
    }

    const kid=kids.find(k=>k.id===kidId); if(!kid)return;
    const mult=streakMult(kid.streak);
    const earnedXp=Math.round(DIFF[chore.diff].xp*mult*dayMult);

    const oldLvl=levelFromXp(kid.xp);
    const newXp=kid.xp+earnedXp;
    const newLvl=levelFromXp(newXp);

    // ── Streak auto-update: only increment on today's completions ──
    let newStreak=kid.streak;
    let streakUpdates={};
    if(isToday){
      const lastActive=kid.lastActiveDate||"";
      const yesterday=dateKey(new Date(Date.now()-86400000));
      if(lastActive===today()){
        // Already active today — streak unchanged
      } else if(lastActive===yesterday||lastActive===""){
        // Consecutive day or first ever — increment
        newStreak=kid.streak+1;
        streakUpdates={streak:newStreak,lastActiveDate:today()};
      } else {
        // Gap — reset to 1
        newStreak=1;
        streakUpdates={streak:1,lastActiveDate:today()};
      }
    }

    const wk=weekKey(dk);const mo=monthKey(dk);
    const newWkXp=getKidPeriodXp(kidId,wk)+earnedXp;
    const newMoXp=getKidPeriodXp(kidId,mo)+earnedXp;

    const txEntry={id:"tx"+Date.now(),kidId,type:"earn",xp:earnedXp,cents:0,desc:chore.title,ts:Date.now()};

    const updatedKid={...kid,xp:newXp,...streakUpdates};
    setKids(prev=>prev.map(k=>k.id===kidId?updatedKid:k));
    setPeriodXp(prev=>({...prev,[wk]:{...(prev[wk]||{}),[kidId]:newWkXp},[mo]:{...(prev[mo]||{}),[kidId]:newMoXp}}));
    setTxLog(prev=>[txEntry,...prev].slice(0,300));

    if(ready){
      await merge(`wh/kids/${kidId}`,{xp:newXp,...streakUpdates});
      await merge(`wh/periodXp/${wk}`,{[kidId]:newWkXp});
      await merge(`wh/periodXp/${mo}`,{[kidId]:newMoXp});
      await write(`wh/txlog/${txEntry.id}`,txEntry);
    }

    toast(`${kid.name} +${earnedXp} XP${dayMult<1?' (75%)':''}${newStreak>kid.streak?' 🔥':''}`,earnedXp,null);

    if(newLvl>oldLvl){
      setTimeout(()=>{setLvlUp({name:kid.name,level:newLvl});setTimeout(()=>setLvlUp(null),2300);},600);
    }

    // ── Streak milestone toast ──
    if(newStreak!==kid.streak&&[3,7,14,30].includes(newStreak)){
      setTimeout(()=>toast(`🔥 ${kid.name} is on a ${newStreak}-day streak!`),700);
    }

    const prevWkXp=getKidPeriodXp(kidId,wk);
    const hitWeeklyGoal=newWkXp>=kid.goal.weeklyXpTarget&&prevWkXp<kid.goal.weeklyXpTarget;
    if(hitWeeklyGoal){
      const bonusCents=kid.goal.weeklyBonusCents;
      const bonusBalance=(kid.balanceCents||0)+bonusCents;
      const bonusTx={id:"tx"+Date.now()+"w",kidId,type:"weekly_bonus",xp:0,cents:bonusCents,desc:"Weekly goal bonus 🎯",ts:Date.now()+1};
      setKids(prev=>prev.map(k=>k.id===kidId?{...k,balanceCents:bonusBalance}:k));
      setTxLog(prev=>[bonusTx,...prev].slice(0,300));
      if(ready){await merge(`wh/kids/${kidId}`,{balanceCents:bonusBalance});await write(`wh/txlog/${bonusTx.id}`,bonusTx);}
      setTimeout(()=>toast(`🎯 ${kid.name} hit weekly goal! +${centsShort(bonusCents)} added to balance`),500);
      setTimeout(()=>{setGoalUnlock({name:kid.name,type:'weekly',bonus:centsShort(bonusCents)});setTimeout(()=>setGoalUnlock(null),2500);},800);
    }

    const prevMoXp=getKidPeriodXp(kidId,mo);
    const hitMonthlyGoal=newMoXp>=kid.goal.monthlyXpTarget&&prevMoXp<kid.goal.monthlyXpTarget;
    if(hitMonthlyGoal){
      const bonusCents=kid.goal.monthlyBonusCents;
      const currentBal=kids.find(k=>k.id===kidId)?.balanceCents||kid.balanceCents||0;
      const mBonusBalance=currentBal+bonusCents;
      const mTx={id:"tx"+Date.now()+"m",kidId,type:"monthly_bonus",xp:0,cents:bonusCents,desc:"Monthly goal bonus 🏆",ts:Date.now()+2};
      setKids(prev=>prev.map(k=>k.id===kidId?{...k,balanceCents:mBonusBalance}:k));
      setTxLog(prev=>[mTx,...prev].slice(0,300));
      if(ready){await merge(`wh/kids/${kidId}`,{balanceCents:mBonusBalance});await write(`wh/txlog/${mTx.id}`,mTx);}
      setTimeout(()=>toast(`🏆 ${kid.name} hit monthly goal! +${centsShort(bonusCents)} added`),700);
      setTimeout(()=>{setGoalUnlock({name:kid.name,type:'monthly',bonus:centsShort(bonusCents)});setTimeout(()=>setGoalUnlock(null),3000);},900);
    }

    // ── Badge check ──
    const statsForBadge=getBadgeStats(kidId,comps,chores);
    // Inject weekly/monthly hit counts from current session
    if(hitWeeklyGoal)statsForBadge.weeklyHits=(statsForBadge.weeklyHits||0)+1;
    if(hitMonthlyGoal)statsForBadge.monthlyHits=(statsForBadge.monthlyHits||0)+1;
    const kidForBadge={...updatedKid};
    const newBadges=getNewBadges(kidForBadge,statsForBadge);
    if(newBadges.length>0){
      const earned=[...(kid.badges||[]),...newBadges.map(b=>b.id)];
      setKids(prev=>prev.map(k=>k.id===kidId?{...k,badges:earned}:k));
      if(ready)await merge(`wh/kids/${kidId}`,{badges:earned});
      // Show badge popup for first new badge; queue others
      newBadges.forEach((b,i)=>{
        setTimeout(()=>{
          setBadgeEarned(b);
          setTimeout(()=>setBadgeEarned(null),2800);
        },i*3200+1000);
      });
    }
  }

  /* ── Up for Grabs ── */
  async function claimGrab(choreId,memberId,dk){
    const todayGrabs=grabs[dk]||{};
    const alreadyClaimed=todayGrabs[choreId];
    if(alreadyClaimed&&alreadyClaimed!==memberId){toast("Someone else already claimed this one!");return;}
    const alreadyHas=Object.entries(todayGrabs).some(([cid,mid])=>mid===memberId&&cid!==choreId);
    if(alreadyHas){toast("Finish your current grab chore first!");return;}
    const comp=comps[dk]?.[ckey(choreId,memberId)];
    if(comp?.status==='approved'){toast("Already done!");return;}
    const newGrabs={...todayGrabs,[choreId]:memberId};
    setGrabs(prev=>({...prev,[dk]:newGrabs}));
    if(ready)await write(`wh/grabs/${dk}`,newGrabs);
    toast("Chore claimed! Complete it to earn XP.");
  }

  async function releaseGrab(choreId,dk){
    const newGrabs={...(grabs[dk]||{})};
    delete newGrabs[choreId];
    setGrabs(prev=>({...prev,[dk]:newGrabs}));
    if(ready)await write(`wh/grabs/${dk}`,newGrabs);
    toast("Chore released.");
  }

  async function completeChore(choreId,kidId,dk){
    const chore=chores.find(c=>c.id===choreId); if(!chore)return;
    const ex=getComp(dk,choreId,kidId);
    if(ex&&ex.status!=="denied")return;
    const status=chore.requiresApproval?"pending":"approved";
    const comp={status,ts:Date.now(),kidId,choreId};
    setComps(prev=>({...prev,[dk]:{...(prev[dk]||{}),[ckey(choreId,kidId)]:comp}}));
    if(ready)await write(`wh/comps/${dk}/${ckey(choreId,kidId)}`,comp);
    if(status==="approved")await awardEarnings(kidId,chore,dk);
    else toast("Submitted for approval!");
  }

  async function approveComp(dk,ck,kidId,choreId){
    const comp={...(comps[dk]?.[ck]||{}),status:"approved"};
    setComps(prev=>({...prev,[dk]:{...(prev[dk]||{}),[ck]:comp}}));
    if(ready)await write(`wh/comps/${dk}/${ck}`,comp);
    const chore=chores.find(c=>c.id===choreId);
    if(chore)await awardEarnings(kidId,chore,dk);
  }

  function promptDeny(dk,ck,kidId,choreId){
    const chore=chores.find(c=>c.id===choreId);
    const kid=memberById(kidId);
    setDenyTarget({dk,ck,kidId,choreId,kidName:kid?.name||'',choreName:chore?.title||''});
  }

  async function confirmDeny(note){
    if(!denyTarget)return;
    const{dk,ck}=denyTarget;
    const comp={...(comps[dk]?.[ck]||{}),status:"denied",denyNote:note||""};
    setComps(prev=>({...prev,[dk]:{...(prev[dk]||{}),[ck]:comp}}));
    if(ready)await write(`wh/comps/${dk}/${ck}`,comp);
    toast(note?`Denied: "${note}"`:"Task denied.");
    setDenyTarget(null);
  }

  async function convertXP(kidId,xpAmount){
    const kid=kidById(kidId); if(!kid)return;
    const xp=Math.floor(xpAmount);
    if(xp<=0||xp>kid.xp){toast("Not enough XP to convert!");return;}
    const earnedCents=xpToCents(xp);
    const newXp=kid.xp-xp;
    const newBalance=(kid.balanceCents||0)+earnedCents;
    const txEntry={id:"tx"+Date.now(),kidId,type:"convert",xp:-xp,cents:earnedCents,desc:`Converted ${xp} XP → ${centsShort(earnedCents)}`,ts:Date.now()};
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,xp:newXp,balanceCents:newBalance}:k));
    setTxLog(prev=>[txEntry,...prev].slice(0,300));
    if(ready){await merge(`wh/kids/${kidId}`,{xp:newXp,balanceCents:newBalance});await write(`wh/txlog/${txEntry.id}`,txEntry);}
    toast(`Converted ${xp} XP → ${centsShort(earnedCents)}!`,null,earnedCents);
  }

  /* ── BATCH 4: Mark balance paid out in cash ── */
  async function markPaidOut(kidId){
    const kid=kidById(kidId); if(!kid)return;
    const cents=kid.balanceCents||0;
    if(cents<=0){toast("Nothing to pay out!");return;}
    const tx={id:"tx"+Date.now(),kidId,type:"payout",xp:0,cents:-cents,desc:`Cash payout — ${centsToDisplay(cents)}`,ts:Date.now()};
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,balanceCents:0}:k));
    setTxLog(prev=>[tx,...prev].slice(0,300));
    if(ready){await merge(`wh/kids/${kidId}`,{balanceCents:0});await write(`wh/txlog/${tx.id}`,tx);}
    toast(`💸 ${kid.name} paid out ${centsToDisplay(cents)} cash!`);
  }

  /* ── BATCH 4: Allowance ── */
  async function saveAllowance(kidId,weeklyCents,dayOfWeek){
    const allowance=weeklyCents>0?{weeklyCents,dayOfWeek,enabled:true}:null;
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,allowance}:k));
    if(ready)await merge(`wh/kids/${kidId}`,{allowance});
    setAllowanceKid(null);
    toast(weeklyCents>0?`📅 Allowance set: ${centsToDisplay(weeklyCents)}/week`:"Allowance removed.");
  }

  /* ── BATCH 5: CSV export ── */
  function exportCSV(){
    const rows=[['Date','Member','Type','Description','XP','Dollars']];
    [...txLog].sort((a,b)=>a.ts-b.ts).forEach(tx=>{
      const member=memberById(tx.kidId);
      const name=member?.name||tx.kidId||'';
      const date=new Date(tx.ts).toLocaleDateString('en-US',{year:'numeric',month:'2-digit',day:'2-digit'});
      const dollars=tx.cents?(tx.cents/100).toFixed(2):'';
      rows.push([date,name,tx.type||'',`"${(tx.desc||'').replace(/"/g,'""')}"`,tx.xp||'',dollars]);
    });
    const csv=rows.map(r=>r.join(',')).join('\n');
    const blob=new Blob([csv],{type:'text/csv'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=`wattshub-export-${today()}.csv`;a.click();
    URL.revokeObjectURL(url);
    toast('📊 CSV exported!');
  }

  async function buyItem(item,kidId){
    const kid=kidById(kidId); if(!kid)return;
    const price=item.priceXp||0;
    if(!balanceUnlocked(kidId)){toast("Monthly goal must be met first!");return;}
    if(kid.xp<price){toast("Not enough XP!");return;}
    const newXp=kid.xp-price;
    const purchase={id:"p"+Date.now(),kidId,itemId:item.id,ts:Date.now(),priceXp:price,itemName:item.name};
    const tx={id:"tx"+Date.now(),kidId,type:"spend",xp:-price,cents:0,desc:item.name,ts:Date.now()};
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,xp:newXp}:k));
    setPurchases(prev=>[purchase,...prev]);
    setTxLog(prev=>[tx,...prev].slice(0,300));
    if(ready){await merge(`wh/kids/${kidId}`,{xp:newXp});await write(`wh/purchases/${purchase.id}`,purchase);await write(`wh/txlog/${tx.id}`,tx);}
    setBuyBanner({name:item.name,emoji:item.emoji,price:`${price} XP`});
    setTimeout(()=>setBuyBanner(null),3000);
  }

  /* ── PIN actions ── */
  async function handlePINKey(key){
    if(key==='del'){setPinEntry(p=>p.slice(0,-1));setPinError(false);return;}
    const next=pinEntry+key;
    setPinEntry(next);
    if(next.length<4)return;
    setTimeout(async()=>{
      if(pinMode==='verify'){
        const hash=getStoredPINHash();
        if(!hash){setScreen('app');setPinEntry('');return;}
        const ok=await verifyPIN(next,hash);
        if(ok){setScreen('app');setParentMode(true);setPinEntry('');}
        else{setPinError(true);setTimeout(()=>{setPinEntry('');setPinError(false);},700);}
      } else {
        if(pinStep===1){setPinFirst(next);setPinEntry('');setPinStep(2);}
        else{
          if(next===pinFirst){
            await storePINHash(next);
            toast('Parent PIN set!');
            setScreen('app');setParentMode(true);setPinEntry('');setPinStep(1);setPinFirst('');setPinMode('verify');
          } else {
            setPinError(true);
            setTimeout(()=>{setPinEntry('');setPinFirst('');setPinStep(1);setPinError(false);},700);
          }
        }
      }
    },80);
  }

  function enterParentMode(){
    if(!isPINSet()){setPinMode('set');setPinStep(1);setPinEntry('');setPinFirst('');setScreen('pin');}
    else{setPinMode('verify');setPinEntry('');setScreen('pin');}
  }

  function enterKidMode(kidId){
    setActiveKid(kidId);setParentMode(false);setScreen('app');setKmView('chores');
  }

  /* ── Edit / delete chore ── */
  async function saveEditChore(){
    if(!editChore||!editChore.title.trim())return;
    const updated={...editChore,scheduleDays:editChore.freq==='daily'&&editChore.scheduleType==='fixed'?editChore.scheduleDays:[]};
    setChores(prev=>prev.map(c=>c.id===updated.id?updated:c));
    if(ready)await write(`wh/chores/${updated.id}`,updated);
    setEditChore(null);toast('Chore updated!');
  }

  function deleteChore(choreId){
    setDeleteChoreTarget(choreId);
    setEditChore(null);
  }
  async function confirmDeleteForward(choreId){
    const updated={...(chores.find(c=>c.id===choreId)||{}),deletedAfter:today()};
    setChores(prev=>prev.map(c=>c.id===choreId?updated:c));
    if(ready)await merge(`wh/chores/${choreId}`,{deletedAfter:today()});
    setDeleteChoreTarget(null);toast('Hidden going forward — history preserved.');
  }
  async function confirmDeletePermanent(choreId){
    setChores(prev=>prev.filter(c=>c.id!==choreId));
    if(ready)await del(`wh/chores/${choreId}`);
    setDeleteChoreTarget(null);toast('Chore permanently deleted.');
  }

  async function saveEditParent(){
    if(!editParent||!editParent.name.trim())return;
    const updated={...editParent,name:editParent.name.trim(),initials:(editParent.initials||editParent.name.slice(0,2)).toUpperCase().slice(0,2)};
    setParents(prev=>prev.map(p=>p.id===updated.id?updated:p));
    if(ready)await merge(`wh/parents/${updated.id}`,{name:updated.name,initials:updated.initials});
    setEditParent(null);toast('Profile updated!');
  }

  async function saveEditKid(){
    if(!editKid||!editKid.name.trim())return;
    setKids(prev=>prev.map(k=>k.id===editKid.id?{...k,name:editKid.name,age:editKid.age,initials:editKid.initials||editKid.name.slice(0,2).toUpperCase()}:k));
    if(ready)await merge(`wh/kids/${editKid.id}`,{name:editKid.name,age:editKid.age,initials:editKid.initials||editKid.name.slice(0,2).toUpperCase()});
    setEditKid(null);toast('Profile updated!');
  }

  async function addChore(){
    if(!cf.title.trim()||(!cf.upForGrabs&&!cf.assignedTo.length))return;
    const id="c"+Date.now();
    const c={...cf,id,title:cf.title.trim(),scheduleDays:cf.freq==="daily"&&cf.scheduleType==="fixed"?cf.scheduleDays:[]};
    setChores(p=>[...p,c]);
    if(ready)await write(`wh/chores/${id}`,c);
    setCf({title:"",diff:"easy",freq:"daily",scheduleType:"daily",scheduleDays:[],assignedTo:[],requiresApproval:false,upForGrabs:false});
    setShowAddChore(false);toast("Chore added!");
  }

  async function addKid(){
    if(!kf.name.trim())return;
    const id="k"+Date.now();
    const colorIdx=kids.length%COLORS.length;
    const initials=kf.initials.trim()||kf.name.slice(0,2).toUpperCase();
    const k={id,name:kf.name.trim(),age:parseInt(kf.age)||10,colorIdx,xp:0,streak:0,initials,balanceCents:0,
      goal:{weeklyXpTarget:50,weeklyBonusCents:300,monthlyXpTarget:200,monthlyBonusCents:1000,overageRate:10}};
    setKids(p=>[...p,k]);
    if(ready)await write(`wh/kids/${id}`,k);
    setKf({name:"",age:"",initials:""});setShowAddKid(false);toast(`${k.name} joined!`);
  }

  async function giveBonus(){
    const kid=kidById(bonusKid); if(!kid)return;
    const note=bonusNote.trim()||'Parent bonus';
    if(bonusType==='xp'){
      const xp=parseInt(bonusAmt)||0; if(xp<=0)return;
      const earnedCents=xpToCents(xp);
      const newXp=kid.xp+xp;
      const newBal=kid.balanceCents+earnedCents;
      const tx={id:'tx'+Date.now(),kidId:bonusKid,type:'bonus',xp,cents:earnedCents,desc:note,ts:Date.now()};
      setKids(prev=>prev.map(k=>k.id===bonusKid?{...k,xp:newXp,balanceCents:newBal}:k));
      setTxLog(prev=>[tx,...prev].slice(0,300));
      if(ready){await merge(`wh/kids/${bonusKid}`,{xp:newXp,balanceCents:newBal});await write(`wh/txlog/${tx.id}`,tx);}
      toast(`🎁 ${kid.name} +${xp} XP & ${centsShort(earnedCents)} bonus!`,xp,earnedCents);
    } else if(bonusType==='dollars'){
      const cents=Math.round((parseFloat(bonusAmt)||0)*100); if(cents<=0)return;
      const newBal=kid.balanceCents+cents;
      const tx={id:'tx'+Date.now(),kidId:bonusKid,type:'bonus',xp:0,cents,desc:note,ts:Date.now()};
      setKids(prev=>prev.map(k=>k.id===bonusKid?{...k,balanceCents:newBal}:k));
      setTxLog(prev=>[tx,...prev].slice(0,300));
      if(ready){await merge(`wh/kids/${bonusKid}`,{balanceCents:newBal});await write(`wh/txlog/${tx.id}`,tx);}
      toast(`🎁 ${kid.name} +${centsShort(cents)} bonus!`,0,cents);
    } else {
      const tx={id:'tx'+Date.now(),kidId:bonusKid,type:'custom_reward',xp:0,cents:0,desc:note,ts:Date.now()};
      setTxLog(prev=>[tx,...prev].slice(0,300));
      if(ready)await write(`wh/txlog/${tx.id}`,tx);
      toast(`🎁 ${kid.name}: "${note}"`);
    }
    setShowBonus(false);setBonusKid(null);setBonusAmt('');setBonusNote('');setBonusType('xp');
  }

  async function saveGoal(kidId){
    setKids(prev=>prev.map(k=>k.id===kidId?{...k,goal:editGoal}:k));
    if(ready)await merge(`wh/kids/${kidId}`,{goal:editGoal});
    setGoalKid(null);toast("Goals updated!");
  }

  async function addStoreItem(){
    if(!itemF.name.trim())return;
    const id="custom_"+Date.now();
    const item={...itemF,id,cat:"custom"};
    setStoreItems(prev=>[...prev,item]);
    if(ready)await write(`wh/store/${id}`,item);
    setItemF({name:"",desc:"",emoji:"🎁",priceXp:30});setShowAddItem(false);toast("Item added!");
  }

  async function saveEditItem(){
    if(!editItem||!editItem.name.trim())return;
    const isDefault=editItem.id.startsWith('s')&&!editItem.id.startsWith('custom');
    setStoreItems(prev=>prev.map(i=>i.id===editItem.id?editItem:i));
    if(ready&&!isDefault)await write(`wh/store/${editItem.id}`,editItem);
    setEditItem(null);toast('Item updated!');
  }

  async function deleteStoreItem(itemId){
    const isDefault=itemId.startsWith('s')&&!itemId.startsWith('custom');
    setStoreItems(prev=>prev.filter(i=>i.id!==itemId));
    if(ready&&!isDefault)await del(`wh/store/${itemId}`);
    if(ready&&isDefault)await write(`wh/hiddenStoreItems/${itemId}`,true);
    setEditItem(null);toast('Item removed from store.');
  }

  function toggleDay(dow){setCf(f=>{const days=f.scheduleDays.includes(dow)?f.scheduleDays.filter(d=>d!==dow):[...f.scheduleDays,dow].sort((a,b)=>a-b);return{...f,scheduleDays:days};});}

  /* ── Calendar helpers ── */
  function calCells(){
    const{y,m}=calMonth;const first=new Date(y,m,1).getDay();const dim=new Date(y,m+1,0).getDate();const prev=new Date(y,m,0).getDate();const cells=[];
    for(let i=first-1;i>=0;i--)cells.push({day:prev-i,cur:false,m:m===0?11:m-1,y:m===0?y-1:y});
    for(let i=1;i<=dim;i++)cells.push({day:i,cur:true,m,y});
    for(let i=1;cells.length<42;i++)cells.push({day:i,cur:false,m:m===11?0:m+1,y:m===11?y+1:y});
    return cells;
  }
  function cellDk(cell){return`${cell.y}-${String(cell.m+1).padStart(2,'0')}-${String(cell.day).padStart(2,'0')}`;}
  const dayHasAct=dk=>!!(comps[dk]&&Object.values(comps[dk]).some(c=>c.status==="approved"));
  const dayHasPend=dk=>!!(comps[dk]&&Object.values(comps[dk]).some(c=>c.status==="pending"));
  const dayHasMiss=dk=>{
    if(isFuture(dk)||dk===today())return false;
    const hasChores=chores.some(c=>choreAppearsOnDate(c,dk)&&!c.upForGrabs);
    if(!hasChores)return false;
    const hasAnyComp=comps[dk]&&Object.values(comps[dk]).some(c=>c.status==="approved");
    return !hasAnyComp;
  };
  function shiftDate(dk,d){const dt=parseDate(dk);dt.setDate(dt.getDate()+d);const nk=dateKey(dt);if(!isFuture(nk)){setSelDate(nk);setView("chores");}}

  /* ══════════════════════════════════════════════════════════════════════
     SHARED COMPONENTS
  ═══════════════════════════════════════════════════════════════════════ */
  function Av({kid,size=48,fs=16}){
    const c=getColor(kid.colorIdx);
    return <div className="av" style={{width:size,height:size,background:c.bg,color:c.tx,fontSize:fs}}>{kid.initials}</div>;
  }

  function GoalBlock({kid}){
    const wg=weekGoalStatus(kid);
    const mg=monthGoalStatus(kid);
    if(!wg||!mg)return null;
    return(
      <div className="goal-block">
        <div className="grow">
          <div className="ghead">
            <span className="glbl">Weekly</span>
            <span className="gval" style={{color:wg.hit?"var(--te)":wg.near?"var(--bl)":"var(--tx2)"}}>{wg.earned}/{wg.target} XP</span>
          </div>
          <div className="gtrack"><div className="gfill" style={{width:`${wg.pct*100}%`,background:wg.hit?"var(--te)":wg.near?"var(--bl)":"var(--pu)"}}/></div>
          <span className={`gpill ${wg.hit?"g-over":wg.near?"g-near":"g-lock"}`}>
            {wg.hit?"✓ Bonus earned":"🎯 Bonus"}: {centsShort(wg.bonus)}
            {!wg.hit&&<span style={{marginLeft:3,opacity:.6}}>locked</span>}
          </span>
        </div>
        <div className="grow">
          <div className="ghead">
            <span className="glbl">Monthly</span>
            <span className="gval" style={{color:mg.hit?"var(--te)":mg.near?"var(--am)":"var(--tx2)"}}>{mg.earned}/{mg.target} XP</span>
          </div>
          <div className="gtrack"><div className="gfill" style={{width:`${mg.pct*100}%`,background:mg.hit?"var(--te)":mg.near?"var(--am)":"var(--pu)"}}/></div>
          <span className={`gpill ${mg.hit&&mg.over?"g-over":mg.hit?"g-hit":mg.near?"g-near":"g-lock"}`}>
            {mg.hit?"🏆 Base":mg.near?"📈 Almost":"🏆 Goal"}: {centsShort(mg.bonus)}
            {mg.over>0&&<span style={{marginLeft:5}}>+{centsShort(mg.overCents)} overage ({mg.over} XP over)</span>}
            {!mg.hit&&<span style={{marginLeft:3,opacity:.6}}>locked</span>}
          </span>
        </div>
      </div>
    );
  }

  function KidCard({kid,onClick}){
    const c=getColor(kid.colorIdx);
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
            <div className="ksub">Age {kid.age} · {kid.xp.toLocaleString()} XP total</div>
            <div className="chips">
              <span className="chip" style={{color:kid.streak>=7?"var(--am)":"var(--tx2)"}}>{kid.streak>=7?"🔥":"⚡"}{kid.streak}d</span>
              {mult>1&&<span className="chip" style={{color:"var(--am)"}}>{mult}x</span>}
              <span className="chip" style={{color:"var(--te)"}}>{todayCt} done</span>
              {balanceUnlocked(kid.id)
                ?<span className="chip" style={{color:"var(--gn)",fontFamily:"var(--fm)"}}>{centsShort(kid.balanceCents||0)}</span>
                :<span className="chip" style={{color:"var(--co)",fontFamily:"var(--fm)"}}>🔒{centsShort(kid.balanceCents||0)}</span>}
              {kid.allowance?.enabled&&<span className="chip" style={{color:"var(--gn)"}}>📅 {centsToDisplay(kid.allowance.weeklyCents)}/wk</span>}
            </div>
          </div>
          {parentMode&&<div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
            <button className="btn btn-g btn-sm" onClick={e=>{e.stopPropagation();setEditGoal(kid.goal||{weeklyXpTarget:75,weeklyBonusCents:400,monthlyXpTarget:300,monthlyBonusCents:1500,overageRate:10});setGoalKid(kid.id);}}>Goals</button>
            <button className="btn btn-g btn-sm" onClick={e=>{e.stopPropagation();setEditKid({...kid});}}>Edit</button>
            <button className="btn btn-am btn-sm" onClick={e=>{e.stopPropagation();setBonusKid(kid.id);setBonusType('xp');setBonusAmt('');setBonusNote('');setShowBonus(true);}}>🎁 Bonus</button>
          </div>}
        </div>
        <div className="xr"><span>Lv {lvl} → {lvl+1}</span><span>{xpThis}/{xpNeed} XP</span></div>
        <div className="xt"><div className="xf" style={{width:`${pct*100}%`,background:c.bg}}/></div>
        <GoalBlock kid={kid}/>
      </div>
    );
  }

  function ChoreCard({chore,dk,kidMode=false}){
    const viewDk=dk||selDate;
    const past=isPast(viewDk)&&viewDk!==today();
    const myComp=activeKid?getComp(viewDk,chore.id,activeKid):null;
    const myStatus=myComp?.status||null;
    const assignedTo=chore.assignedTo||[];
    const allSt=assignedTo.map(kid=>({kid,comp:getComp(viewDk,chore.id,kid)}));
    const cardDone=activeKid?myStatus==="approved":allSt.every(s=>s.comp?.status==="approved");
    const cardPend=activeKid?myStatus==="pending":allSt.some(s=>s.comp?.status==="pending");
    const sLabel=scheduleLabel(chore);
    const xp=DIFF[chore.diff].xp;
    const dollars=centsShort(xpToCents(xp));
    const mult=activeKid?streakMult(kidById(activeKid)?.streak||0):1;
    const effectiveXp=Math.round(xp*(past?0.75:1)*mult);
    const effectiveDollars=centsShort(xpToCents(effectiveXp));
    const denyNote=myComp?.status==="denied"?myComp.denyNote:null;

    if(kidMode){
      return(
        <div className={`km-chore${cardDone?" done":""}${cardPend?" pend":""}`}>
          <div className="km-ci" style={{background:cardDone?"rgba(45,212,167,.1)":cardPend?"rgba(245,166,35,.1)":"var(--s2)"}}>{DIFF[chore.diff].icon}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className={`km-ct${cardDone?" done":""}`}>{chore.title}</div>
            {denyNote&&<div style={{fontSize:10,color:"var(--co)",marginTop:2}}>Denied: {denyNote}</div>}
            <div className="km-rw">
              <span className="km-rp" style={{background:"rgba(124,111,247,.14)",color:"var(--pul)"}}>+{effectiveXp} XP</span>
              <span className="km-rp" style={{background:"rgba(74,196,125,.14)",color:"var(--gn)"}}>{effectiveDollars}</span>
              {sLabel&&<span className="km-rp" style={{background:"rgba(255,255,255,.05)",color:"var(--tx2)"}}>{sLabel}</span>}
            </div>
          </div>
          <button className={`km-ck${cardDone?" done":cardPend?" pend":""}`}
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
          <span className="badge bxp">+{effectiveXp} XP{past&&!cardDone?" (75%)":""}</span>
          <span className="badge bdo">{effectiveDollars}</span>
          <span className={`badge ${DIFF[chore.diff].cls}`}>{DIFF[chore.diff].lbl}</span>
          {sLabel?<span className="badge" style={{background:"rgba(124,111,247,.1)",color:"var(--pul)"}}>{sLabel}</span>:<span className="badge bt">{chore.freq==="daily"?"Every day":FREQ[chore.freq]||chore.freq}</span>}
          {cardPend&&<span className="badge bp">⏳ Pending</span>}
          {cardDone&&<span className="badge ba">✓ Done</span>}
          {past&&!cardDone&&!cardPend&&<span className="badge bb">Past day</span>}
        </div>
        {!activeKid&&!chore.upForGrabs&&(
          <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
            {assignedTo.map(kidId=>{
              const k=kidById(kidId); if(!k)return null;const cc=getColor(k.colorIdx);const comp=getComp(viewDk,chore.id,kidId);
              return <span key={kidId} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,fontWeight:700,padding:"2px 6px",borderRadius:4,background:comp?.status==="approved"?"rgba(45,212,167,.1)":comp?.status==="pending"?"rgba(245,166,35,.1)":"var(--s2)",color:comp?.status==="approved"?"var(--te)":comp?.status==="pending"?"var(--am)":"var(--tx2)"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:cc.bg,display:"inline-block"}}/>{k.name}{comp?.status==="approved"?" ✓":comp?.status==="pending"?" ⏳":""}
              </span>;
            })}
          </div>
        )}
        {chore.requiresApproval&&!cardDone&&!cardPend&&<div style={{fontSize:10,color:"var(--tx3)",marginBottom:7}}>Requires approval</div>}
        <div className="ca">
          {activeKid&&!cardDone&&!cardPend&&<button className="mkb" onClick={()=>completeChore(chore.id,activeKid,viewDk)}>✓ {past?"Mark done (75%)":"Mark complete"}</button>}
          {activeKid&&cardPend&&<button className="mkb pend">⏳ Awaiting approval</button>}
          {activeKid&&cardDone&&<button className="mkb done">✓ Done</button>}
          {!activeKid&&cardPend&&parentMode&&allSt.filter(s=>s.comp?.status==="pending").map(s=>{
            const k=memberById(s.kid); if(!k)return null;
            return <button key={s.kid} className="btn btn-ok btn-sm" onClick={()=>approveComp(viewDk,ckey(chore.id,s.kid),s.kid,chore.id)}>✓ {k.name}</button>;
          })}
          {!activeKid&&cardPend&&parentMode&&allSt.filter(s=>s.comp?.status==="pending").map(s=>{
            const k=memberById(s.kid); if(!k)return null;
            return <button key={`deny-${s.kid}`} className="btn btn-no btn-sm" onClick={()=>promptDeny(viewDk,ckey(chore.id,s.kid),s.kid,chore.id)}>✕ {k.name}</button>;
          })}
          {!activeKid&&parentMode&&!cardDone&&!cardPend&&assignedTo.map(kidId=>{
            const k=memberById(kidId); if(!k)return null;
            const comp=getComp(viewDk,chore.id,kidId);
            if(comp&&comp.status!=="denied")return null;
            return <button key={kidId} className="btn btn-g btn-sm" onClick={()=>completeChore(chore.id,kidId,viewDk)}>✓ {k.name}{past?" (75%)":""}</button>;
          })}
        </div>
        {parentMode&&!kidMode&&<div className="chore-actions">
          <button className="edit-btn" onClick={()=>setEditChore({...chore})}>Edit</button>
          <button className="del-btn" onClick={()=>deleteChore(chore.id)}>Delete</button>
        </div>}
      </div>
    );
  }

  function Calendar(){
    const cells=calCells();const{y,m}=calMonth;const now=new Date();const canNext=y<now.getFullYear()||(y===now.getFullYear()&&m<now.getMonth());
    return(
      <div className="cal">
        <div className="calh"><div className="calt">{MONTHS[m]} {y}</div><div className="calnav">
          <button className="cnb" onClick={()=>setCalMonth(({y,m})=>m===0?{y:y-1,m:11}:{y,m:m-1})}>‹</button>
          <button className="cnb tod" onClick={()=>{const d=new Date();setCalMonth({y:d.getFullYear(),m:d.getMonth()});setSelDate(today());}}>Today</button>
          <button className="cnb" disabled={!canNext} onClick={()=>{if(canNext)setCalMonth(({y,m})=>m===11?{y:y+1,m:0}:{y,m:m+1});}}>›</button>
        </div></div>
        <div style={{padding:"0 8px 8px"}}><div className="cgrid">
          {DAY_NAMES.map(d=><div key={d} className="cdow">{d}</div>)}
          {cells.map((cell,i)=>{const dk=cellDk(cell);const fut=isFuture(dk);
            const missClass=cell.cur&&!fut&&dayHasMiss(dk)?" hmiss":"";
            return <div key={i} className={`cday${!cell.cur?" oth":""}${dk===today()?" tod":""}${selDate===dk&&cell.cur?" sel":""}${fut?" fut":""}${dayHasPend(dk)?" hpend":dayHasAct(dk)?" hact":missClass}`}
              onClick={()=>{if(!fut&&cell.cur){setSelDate(dk);setView("chores");}}}>{cell.day}</div>;
          })}
        </div></div>
        <div style={{display:"flex",gap:12,padding:"8px 16px",borderTop:"1px solid var(--b1)",fontSize:10,color:"var(--tx3)"}}>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--te)",display:"inline-block"}}/> Done</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--am)",display:"inline-block"}}/> Pending</span>
          <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"var(--co)",display:"inline-block"}}/> Missed</span>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     STORE
  ═══════════════════════════════════════════════════════════════════════ */
  function StoreView(){
    const kid=activeKid?kidById(activeKid):null;
    const filtered=storeCat==="all"?storeItems:storeItems.filter(i=>i.cat===storeCat);
    const unlocked=activeKid?balanceUnlocked(activeKid):true;
    const mg=kid?monthGoalStatus(kid):null;
    return(
      <>
        {kid&&<div style={{background:"var(--s2)",borderRadius:"var(--rs)",padding:"11px 15px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:13,fontWeight:700}}>{unlocked?"Available XP":"🔒 XP locked"}</span>
          <span style={{fontSize:20,fontWeight:900,fontFamily:"var(--fm)",color:unlocked?"var(--pul)":"var(--co)"}}>{kid.xp} XP</span>
        </div>}
        {kid&&!unlocked&&mg&&<div className="lock-banner">
          <span style={{fontSize:24}}>🔒</span>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:"var(--co)"}}>Store locked — monthly goal not yet met</div>
            <div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{mg.earned} of {mg.target} XP earned this month.</div>
            <div className="lock-prog"><div className="lock-fill" style={{width:`${Math.min(mg.pct*100,100)}%`}}/></div>
          </div>
        </div>}
        <div className="store-tabs">{STORE_CATS.map(c=><button key={c} className={`store-tab${storeCat===c?" on":""}`} onClick={()=>setStoreCat(c)}>{c.charAt(0).toUpperCase()+c.slice(1)}</button>)}</div>
        <div className="store-grid">
          {filtered.map(item=>{
            const canAfford=!kid||kid.xp>=(item.priceXp||0);
            const bought=kid&&purchases.some(p=>p.kidId===kid.id&&p.itemId===item.id);
            return(
              <div key={item.id} className={`store-card${canAfford&&kid?" can":""}${bought?" bought":""}`}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div className="store-emoji">{item.emoji}</div>
                  <div className="store-cat">{item.cat}</div>
                </div>
                <div><div className="store-name">{item.name}</div>{item.desc&&<div className="store-desc">{item.desc}</div>}</div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"auto"}}>
                  <div className="store-price" style={{color:"var(--pul)"}}>{item.priceXp||0} XP</div>
                  {kid&&!bought&&<button className="btn btn-am btn-sm" disabled={!canAfford||!unlocked} onClick={()=>buyItem(item,kid.id)}>{!unlocked?"🔒 Goal first":canAfford?"Redeem":"🔒"}</button>}
                  {kid&&bought&&<span style={{fontSize:11,color:"var(--te)",fontWeight:700}}>✓ Redeemed</span>}
                </div>
                {parentMode&&!kid&&<div className="chore-actions" style={{marginTop:8}}>
                  <button className="edit-btn" onClick={()=>setEditItem({...item})}>Edit</button>
                  <button className="del-btn" onClick={()=>deleteStoreItem(item.id)}>Remove</button>
                </div>}
              </div>
            );
          })}
        </div>
        {parentMode&&<div style={{marginTop:20,display:"flex",gap:8}}>
          <button className="btn btn-g" onClick={()=>setShowAddItem(true)}>+ Add item</button>
        </div>}
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     MONEY VIEW — BATCH 4 additions
  ═══════════════════════════════════════════════════════════════════════ */
  function MoneyView(){
    const kid=activeKid?kidById(activeKid):null;

    // All-kids view — payout tracker
    if(!kid){
      const payable=kids.filter(k=>(k.balanceCents||0)>0);
      return(
        <>
          <div className="g3" style={{marginBottom:20}}>
            {kids.map(k=>{
              const wg=weekGoalStatus(k);const mg=monthGoalStatus(k);
              return <div className="kcard" key={k.id} style={{cursor:"pointer"}} onClick={()=>{setActiveKid(k.id);setView("money");}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <Av kid={k} size={38} fs={13}/>
                  <div><div style={{fontWeight:800,fontSize:14}}>{k.name}</div>
                    <div style={{fontSize:13,fontWeight:900,fontFamily:"var(--fm)",color:"var(--gn)"}}>{centsToDisplay(k.balanceCents||0)}</div>
                  </div>
                </div>
                {wg&&<div style={{fontSize:11,color:wg.hit?"var(--te)":"var(--tx2)"}}>Week: {wg.earned}/{wg.target} XP {wg.hit?"✓":""}</div>}
                {mg&&<div style={{fontSize:11,color:mg.hit?"var(--te)":"var(--tx2)",marginTop:2}}>Month: {mg.earned}/{mg.target} XP {mg.hit?"✓":""}</div>}
              </div>;
            })}
          </div>

          {/* BATCH 4: Payout tracker */}
          {payable.length>0&&<>
            <div className="sh"><span className="sht">💸 Ready to pay out</span><span className="shc">{payable.length} kids</span></div>
            <div className="card0" style={{marginBottom:20}}>
              {payable.map(k=>(
                <div key={k.id} className="payout-row">
                  <Av kid={k} size={36} fs={12}/>
                  <div className="po-info">
                    <div className="po-title">{k.name}</div>
                    <div className="po-sub">Balance ready to hand over</div>
                  </div>
                  <div className="po-amt">{centsToDisplay(k.balanceCents)}</div>
                  <button className="btn btn-ok btn-sm" onClick={()=>markPaidOut(k.id)}>💸 Mark paid</button>
                </div>
              ))}
            </div>
          </>}

          {/* BATCH 5: CSV export */}
          {parentMode&&<div style={{display:"flex",gap:8}}>
            <button className="btn btn-g btn-sm" onClick={exportCSV}>📊 Export CSV</button>
          </div>}
        </>
      );
    }

    const wg=weekGoalStatus(kid);const mg=monthGoalStatus(kid);
    const kidTxs=txLog.filter(t=>t.kidId===kid.id).sort((a,b)=>b.ts-a.ts);

    return(
      <>
        <div className="balance-hero">
          <div className="bal-main">
            <div className={`bal-amt${balanceUnlocked(kid.id)?"":" bal-locked"}`}>
              {balanceUnlocked(kid.id)?"":"🔒 "}{centsToDisplay(kid.balanceCents||0)}
            </div>
            <div className="bal-lbl">{kid.name}'s {balanceUnlocked(kid.id)?"spendable":"locked"} balance</div>
            {!balanceUnlocked(kid.id)&&<div className="bal-pending" style={{color:"var(--co)"}}>Complete monthly goal to unlock spending</div>}
            <div style={{marginTop:10,fontSize:11,color:"var(--tx2)"}}>10 XP = $1.00 · Streak multiplier: {streakMult(kid.streak)}x</div>
            {/* BATCH 4: Mark paid button on individual kid view */}
            {parentMode&&(kid.balanceCents||0)>0&&<button className="btn btn-ok btn-sm" style={{marginTop:10}} onClick={()=>markPaidOut(kid.id)}>💸 Mark balance paid out</button>}
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontSize:11,fontWeight:700,color:"var(--tx2)",marginBottom:6}}>This week</div>
            <div style={{fontSize:20,fontWeight:900,fontFamily:"var(--fm)",color:wg?.hit?"var(--te)":"var(--pul)"}}>{wg?.earned||0} XP</div>
            <div style={{fontSize:11,color:"var(--tx3)"}}>of {wg?.target||0} target</div>
          </div>
        </div>

        {/* BATCH 4: XP → $ convert panel */}
        <div className="convert-panel">
          <div style={{fontSize:12,fontWeight:800,color:"var(--pul)",marginBottom:10}}>⚡ Convert XP to dollars</div>
          <div className="convert-row">
            <input className="convert-input" type="number" placeholder="XP" value={convertAmt}
              onChange={e=>setConvertAmt(e.target.value)}/>
            <span style={{fontSize:12,color:"var(--tx2)"}}>XP = <strong style={{color:"var(--gn)"}}>{convertAmt?centsToDisplay(xpToCents(Math.floor(+convertAmt||0))):"$0.00"}</strong></span>
            <button className="btn btn-p btn-sm" disabled={!convertAmt||+convertAmt<=0||+convertAmt>kid.xp}
              onClick={()=>{convertXP(kid.id,+convertAmt);setConvertAmt("");}}>Convert</button>
          </div>
          <div style={{fontSize:10,color:"var(--tx3)",marginTop:7}}>You have {kid.xp} XP available · 10 XP = $1.00</div>
        </div>

        {(wg||mg)&&<div className="card" style={{marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:800,marginBottom:14}}>Goal progress</div>
          {wg&&<div style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,marginBottom:5}}>
              <span style={{color:"var(--tx2)",textTransform:"uppercase",letterSpacing:".06em"}}>Weekly goal</span>
              <span style={{color:wg.hit?"var(--te)":"var(--tx2)",fontFamily:"var(--fm)"}}>{wg.earned}/{wg.target} XP</span>
            </div>
            <div className="gtrack" style={{height:8,marginBottom:5}}><div className="gfill" style={{width:`${wg.pct*100}%`,background:wg.hit?"var(--te)":wg.near?"var(--bl)":"var(--pu)"}}/></div>
            <span className={`gpill ${wg.hit?"g-over":wg.near?"g-near":"g-lock"}`}>{wg.hit?"✓ Bonus earned":"Bonus"}: {centsShort(wg.bonus)}{!wg.hit&&<span style={{marginLeft:3,opacity:.6}}>locked</span>}</span>
          </div>}
          {mg&&<div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,fontWeight:700,marginBottom:5}}>
              <span style={{color:"var(--tx2)",textTransform:"uppercase",letterSpacing:".06em"}}>Monthly goal</span>
              <span style={{color:mg.hit?"var(--te)":"var(--tx2)",fontFamily:"var(--fm)"}}>{mg.earned}/{mg.target} XP</span>
            </div>
            <div className="gtrack" style={{height:8,marginBottom:5}}><div className="gfill" style={{width:`${mg.pct*100}%`,background:mg.hit?"var(--te)":mg.near?"var(--am)":"var(--pu)"}}/></div>
            <span className={`gpill ${mg.hit&&mg.over?"g-over":mg.hit?"g-hit":mg.near?"g-near":"g-lock"}`}>
              {mg.hit?"🏆 Base bonus":"🏆 Monthly bonus"}: {centsShort(mg.bonus)}
              {mg.over>0&&<span style={{marginLeft:5}}>+{centsShort(mg.overCents)} from {mg.over} XP overage</span>}
              {!mg.hit&&<span style={{marginLeft:3,opacity:.6}}>locked</span>}
            </span>
          </div>}
        </div>}

        <div className="sh"><span className="sht">Transaction history</span><span className="shc">{kidTxs.length}</span></div>
        <div className="card0">
          {!kidTxs.length&&<div className="empty"><div className="emptyic">📋</div><div className="emptytx">No transactions yet.</div></div>}
          {kidTxs.map((tx,i)=>{
            const isEarn=tx.type==="earn"||tx.type==="weekly_bonus"||tx.type==="monthly_bonus"||tx.type==="bonus"||tx.type==="allowance";
            const isPayout=tx.type==="payout";
            const typeIcon=tx.type==="weekly_bonus"?"🎯":tx.type==="monthly_bonus"?"🏆":tx.type==="allowance"?"📅":tx.type==="payout"?"💸":tx.type==="convert"?"⚡":isEarn?"⬆️":"🛒";
            const amtColor=isPayout?"var(--co)":tx.type==="spend"?"var(--co)":tx.type==="convert"?"var(--am)":isEarn?"var(--pul)":"var(--gn)";
            const amtText=isPayout?`-${centsToDisplay(Math.abs(tx.cents||0))}`:tx.type==="spend"?`-${Math.abs(tx.xp||0)} XP`:tx.type==="convert"?`+${centsShort(tx.cents||0)}`:tx.xp?`+${tx.xp} XP`:centsShort(Math.abs(tx.cents||0));
            return <div className="tx-row" key={i}>
              <div className="tx-icon" style={{background:isEarn?"rgba(74,196,125,.1)":isPayout?"rgba(240,96,96,.07)":"rgba(240,96,96,.08)"}}>{typeIcon}</div>
              <div className="tx-info">
                <div className="tx-title">{tx.desc}</div>
                <div className="tx-sub">{tx.xp?`${tx.xp>0?'+':''}${tx.xp} XP · `:""}{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})} · {new Date(tx.ts).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</div>
              </div>
              <div className="tx-amt" style={{color:amtColor}}>{amtText}</div>
            </div>;
          })}
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     SETTINGS VIEW — BATCH 5
  ═══════════════════════════════════════════════════════════════════════ */
  function SettingsView(){
    return(
      <>
        {/* Family members */}
        <div className="settings-section">
          <div className="settings-section-title">Family members</div>
          {kids.map(k=>(
            <div key={k.id} className="settings-row">
              <Av kid={k} size={36} fs={12}/>
              <div className="settings-row-info">
                <div className="settings-row-title">{k.name}</div>
                <div className="settings-row-sub">Age {k.age} · {k.xp.toLocaleString()} XP{k.allowance?.enabled?` · 📅 ${centsToDisplay(k.allowance.weeklyCents)}/wk`:""}</div>
              </div>
              <button className="btn btn-g btn-sm" onClick={()=>setEditKid({...k})}>Edit</button>
              <button className="btn btn-g btn-sm" onClick={()=>setAllowanceKid(k.id)}>📅 Allowance</button>
            </div>
          ))}
          {parents.map(p=>{const cc=getColor(p.colorIdx);return(
            <div key={p.id} className="settings-row">
              <div style={{width:36,height:36,borderRadius:"50%",background:cc.bg,color:cc.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,flexShrink:0}}>{p.initials}</div>
              <div className="settings-row-info">
                <div className="settings-row-title">{p.name} <span style={{fontSize:10,color:"var(--tx3)"}}>👤 Parent</span></div>
                <div className="settings-row-sub">Parent account</div>
              </div>
              <button className="btn btn-g btn-sm" onClick={()=>setEditParent({...p})}>Edit</button>
            </div>
          );})}
        </div>

        {/* Security */}
        <div className="settings-section">
          <div className="settings-section-title">Security</div>
          <div className="settings-row">
            <span style={{fontSize:20}}>🔑</span>
            <div className="settings-row-info">
              <div className="settings-row-title">Parent PIN</div>
              <div className="settings-row-sub">{isPINSet()?"PIN is set — required to access parent mode":"No PIN set — anyone can access parent mode"}</div>
            </div>
            <button className="btn btn-g btn-sm" onClick={()=>setShowChangePIN(true)}>{isPINSet()?"Change PIN":"Set PIN"}</button>
          </div>
        </div>

        {/* Data */}
        <div className="settings-section">
          <div className="settings-section-title">Data & export</div>
          <div className="settings-row">
            <span style={{fontSize:20}}>📊</span>
            <div className="settings-row-info">
              <div className="settings-row-title">Export transaction history</div>
              <div className="settings-row-sub">Download all transactions as a CSV spreadsheet</div>
            </div>
            <button className="btn btn-g btn-sm" onClick={exportCSV}>Export CSV</button>
          </div>
          <div className="settings-row">
            <span style={{fontSize:20}}>{ready?"🟢":"🔴"}</span>
            <div className="settings-row-info">
              <div className="settings-row-title">Firebase sync</div>
              <div className="settings-row-sub">{ready?"Connected — data syncs live across all devices":"Not connected — running in demo mode"}</div>
            </div>
            <button className="btn btn-g btn-sm" onClick={()=>alert(ready?"Firebase is live!":"Check VITE_FIREBASE_* env vars.")}>Status</button>
          </div>
        </div>

        {/* Store */}
        <div className="settings-section">
          <div className="settings-section-title">Store</div>
          <div className="settings-row">
            <span style={{fontSize:20}}>🛍️</span>
            <div className="settings-row-info">
              <div className="settings-row-title">Manage store items</div>
              <div className="settings-row-sub">{storeItems.length} items available · 10 XP = $1.00</div>
            </div>
            <button className="btn btn-p btn-sm" onClick={()=>{setView("store");setActiveKid(null);}}>Open store →</button>
          </div>
        </div>

        {/* Badges overview */}
        <div className="settings-section">
          <div className="settings-section-title">Badges</div>
          {kids.map(k=>(
            <div key={k.id} className="settings-row" style={{flexDirection:"column",alignItems:"flex-start",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,width:"100%"}}>
                <Av kid={k} size={32} fs={11}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700}}>{k.name}</div>
                  <div style={{fontSize:11,color:"var(--tx2)"}}>{(k.badges||[]).length} of {BADGE_DEFS.length} badges earned</div>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,paddingLeft:42}}>
                {BADGE_DEFS.filter(b=>(k.badges||[]).includes(b.id)).map(b=>(
                  <span key={b.id} title={b.desc} style={{fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:6,background:"rgba(124,111,247,.12)",color:"var(--pul)",display:"flex",alignItems:"center",gap:4}}>
                    {b.emoji} {b.name}
                  </span>
                ))}
                {!(k.badges||[]).length&&<span style={{fontSize:11,color:"var(--tx3)"}}>No badges yet</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Notifications */}
        <div className="settings-section">
          <div className="settings-section-title">Push notifications</div>
          <div className="settings-row">
            <span style={{fontSize:20}}>🔔</span>
            <div className="settings-row-info">
              <div className="settings-row-title">Enable push notifications</div>
              <div className="settings-row-sub">Get notified when chores are submitted, approved, or denied</div>
            </div>
            <button className="btn btn-g btn-sm" onClick={()=>registerFCMToken("parent_default").then(t=>alert(t?"Notifications enabled!":"Could not enable — check browser permissions."))}>Enable</button>
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════════════
     KID MODE
  ═══════════════════════════════════════════════════════════════════════ */
  function KidMode(){
    const kid=kidById(activeKid); if(!kid)return null;
    const c=getColor(kid.colorIdx);
    const lvl=levelFromXp(kid.xp);
    const xpThis=kid.xp-xpForLevel(lvl);
    const xpNeed=xpForLevel(lvl+1)-xpForLevel(lvl);
    const pct=Math.min(xpThis/xpNeed,1);
    const wg=weekGoalStatus(kid);const mg=monthGoalStatus(kid);
    const myChores=chores.filter(ch=>(ch.assignedTo||[]).includes(kid.id)&&choreAppearsOnDate(ch,today()));
    const grabChores=chores.filter(c=>c.upForGrabs&&choreAppearsOnDate(c,today())&&!c.deletedAfter);
    const filtered=storeCat==="all"?storeItems:storeItems.filter(i=>i.cat===storeCat);
    const mult=streakMult(kid.streak);

    return(
      <div className="km">
        <div className="km-hd">
          <div className="km-hero">
            <div style={{position:"relative"}}>
              <div style={{width:68,height:68,borderRadius:"50%",background:c.bg,color:c.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900}}>
                {kid.initials}
                <div style={{position:"absolute",bottom:-3,right:-3,background:c.bg,color:c.tx,fontSize:10,fontWeight:900,borderRadius:8,padding:"1px 6px",border:"3px solid var(--bg)"}}>Lv{lvl}</div>
              </div>
            </div>
            <div style={{flex:1}}>
              <div className="km-name">{kid.name}</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                {kid.streak>0&&<span style={{fontSize:12,fontWeight:700,color:kid.streak>=7?"var(--am)":"var(--tx2)"}}>
                  {kid.streak>=7?"🔥":"⚡"} {kid.streak}-day streak{mult>1?` · ${mult}x XP`:""}
                </span>}
              </div>
              <div style={{marginBottom:4}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"var(--tx2)",marginBottom:3}}><span>Level {lvl}</span><span>{xpThis}/{xpNeed} XP</span></div>
                <div style={{height:5,background:"var(--s3)",borderRadius:3,overflow:"hidden"}}>
                  <div style={{height:"100%",borderRadius:3,background:c.bg,width:`${pct*100}%`,transition:"width .7s cubic-bezier(.34,1.56,.64,1)"}}/>
                </div>
              </div>
            </div>
            <div className="km-bal">
              <div className="km-bal-amt">{centsToDisplay(kid.balanceCents||0)}</div>
              <div className="km-bal-lbl">balance</div>
            </div>
          </div>
        </div>
        <div className="km-nav">
          {[{id:"chores",lbl:"✓ Tasks"},{id:"store",lbl:"🛍️ Store"},{id:"money",lbl:"💵 Money"},{id:"badges",lbl:"🏅 Badges"}].map(t=>(
            <button key={t.id} className={`km-nb${kmView===t.id?" act":""}`} onClick={()=>setKmView(t.id)}>{t.lbl}</button>
          ))}
        </div>
        <div className="km-body">
          {kmView==="chores"&&(
            <>
              <div style={{fontSize:11,fontWeight:800,color:"var(--tx2)",marginBottom:10,textTransform:"uppercase",letterSpacing:".07em"}}>Today · {new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
              {myChores.filter(c=>c.freq==="daily").map(ch=><ChoreCard key={ch.id} chore={ch} dk={today()} kidMode/>)}
              {myChores.filter(c=>c.freq!=="daily").length>0&&<>
                <div style={{fontSize:11,fontWeight:800,color:"var(--tx2)",margin:"14px 0 10px",textTransform:"uppercase",letterSpacing:".07em"}}>Recurring</div>
                {myChores.filter(c=>c.freq!=="daily").map(ch=><ChoreCard key={ch.id} chore={ch} dk={today()} kidMode/>)}
              </>}
              {grabChores.length>0&&<>
                <div style={{fontSize:11,fontWeight:800,color:"var(--am)",margin:"14px 0 6px",textTransform:"uppercase",letterSpacing:".07em"}}>🙋 Up for Grabs</div>
                <div style={{background:"rgba(245,166,35,.06)",border:"1px solid rgba(245,166,35,.15)",borderRadius:"var(--rs)",padding:"7px 11px",marginBottom:10,fontSize:11,color:"var(--am)"}}>
                  Claim one to earn bonus XP. One at a time.
                </div>
                {grabChores.map(c=><GrabChoreCard key={c.id} chore={c} dk={today()} kids={kids} parents={parents} comps={comps} grabs={grabs} activeKid={activeKid} parentMode={false} claimGrab={claimGrab} releaseGrab={releaseGrab} completeChore={completeChore} ckey={ckey} DIFF={DIFF} xpToCents={xpToCents} centsShort={centsShort} isPast={isPast} streakMult={streakMult} kidById={kidById}/>)}
              </>}
              {myChores.length===0&&grabChores.length===0&&<div className="empty"><div className="emptyic">🎉</div><div className="emptytx">All done for today!</div></div>}
            </>
          )}
          {kmView==="store"&&(
            <>
              <div style={{background:"var(--s2)",borderRadius:"var(--rs)",padding:"11px 14px",marginBottom:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:700}}>Your XP</span>
                <span style={{fontSize:18,fontWeight:900,fontFamily:"var(--fm)",color:"var(--pul)"}}>{kid.xp} XP</span>
              </div>
              <div className="store-tabs" style={{flexWrap:"nowrap",overflowX:"auto",paddingBottom:4}}>
                {STORE_CATS.map(cat=><button key={cat} className={`store-tab${storeCat===cat?" on":""}`} onClick={()=>setStoreCat(cat)}>{cat.charAt(0).toUpperCase()+cat.slice(1)}</button>)}
              </div>
              {filtered.map(item=>{
                const canAfford=(kid.xp||0)>=(item.priceXp||0);
                const storeOpen=balanceUnlocked(kid.id);
                const bought=purchases.some(p=>p.kidId===kid.id&&p.itemId===item.id);
                return <div key={item.id} className={`km-sc${canAfford&&storeOpen?" can":""}${bought?" bought":""}`}>
                  <div className="km-si">{item.emoji}</div>
                  <div style={{flex:1}}><div className="km-sn">{item.name}</div>{item.desc&&<div className="km-sd">{item.desc}</div>}</div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                    <div style={{fontSize:13,fontWeight:900,fontFamily:"var(--fm)",color:"var(--pul)"}}>{item.priceXp||0} XP</div>
                    {!bought&&<button className="km-buy" disabled={!canAfford||!storeOpen} onClick={()=>buyItem(item,kid.id)}>{!storeOpen?"🔒 Goal first":canAfford?"Redeem":"🔒 Need more XP"}</button>}
                    {bought&&<span style={{fontSize:11,color:"var(--te)",fontWeight:700}}>✓</span>}
                  </div>
                </div>;
              })}
            </>
          )}
          {kmView==="money"&&(
            <>
              <div style={{fontSize:32,fontWeight:900,fontFamily:"var(--fm)",color:"var(--pul)",marginBottom:4}}>{kid.xp} XP</div>
              <div style={{fontSize:12,color:"var(--tx2)",marginBottom:4}}>Your XP balance — spend in the store</div>
              {(kid.balanceCents||0)>0&&<div style={{fontSize:13,fontWeight:700,color:"var(--gn)",marginBottom:10}}>💰 Goal bonus: {centsToDisplay(kid.balanceCents||0)} cash earned</div>}
              {wg&&<div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:14,marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,fontWeight:800}}>Weekly goal</span><span style={{fontSize:12,fontFamily:"var(--fm)",color:wg.hit?"var(--te)":"var(--tx2)"}}>{wg.earned}/{wg.target} XP</span></div>
                <div className="gtrack" style={{height:7,marginBottom:6}}><div className="gfill" style={{width:`${wg.pct*100}%`,background:wg.hit?"var(--te)":"var(--pu)"}}/></div>
                <div style={{fontSize:11,color:wg.hit?"var(--te)":"var(--tx2)"}}>{wg.hit?`✓ Bonus earned: ${centsShort(wg.bonus)}`:`Bonus on completion: ${centsShort(wg.bonus)}`}</div>
              </div>}
              {mg&&<div style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:14,marginBottom:14}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,fontWeight:800}}>Monthly goal</span><span style={{fontSize:12,fontFamily:"var(--fm)",color:mg.hit?"var(--te)":"var(--tx2)"}}>{mg.earned}/{mg.target} XP</span></div>
                <div className="gtrack" style={{height:7,marginBottom:6}}><div className="gfill" style={{width:`${mg.pct*100}%`,background:mg.hit?"var(--te)":"var(--pu)"}}/></div>
                <div style={{fontSize:11,color:mg.hit?"var(--te)":"var(--tx2)"}}>
                  {mg.hit?`🏆 Base: ${centsShort(mg.bonus)}${mg.over?` + ${centsShort(mg.overCents)} overage!`:""}`:
                   `Base on completion: ${centsShort(mg.bonus)}`}
                </div>
              </div>}
              <div style={{fontSize:11,fontWeight:800,color:"var(--tx2)",marginBottom:8,textTransform:"uppercase",letterSpacing:".07em"}}>Recent</div>
              <div className="card0">
                {txLog.filter(t=>t.kidId===kid.id).slice(0,8).map((tx,i)=>{
                  const isEarn=tx.type!=="spend"&&tx.type!=="payout";
                  return <div className="tx-row" key={i}>
                    <div className="tx-icon" style={{background:isEarn?"rgba(74,196,125,.1)":"rgba(240,96,96,.08)"}}>{tx.type==="weekly_bonus"?"🎯":tx.type==="monthly_bonus"?"🏆":tx.type==="allowance"?"📅":tx.type==="payout"?"💸":isEarn?"⬆️":"🛒"}</div>
                    <div className="tx-info"><div className="tx-title">{tx.desc}</div><div className="tx-sub">{new Date(tx.ts).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div></div>
                    <div className="tx-amt" style={{color:tx.type==="spend"||tx.type==="payout"?"var(--co)":tx.type==="convert"?"var(--am)":isEarn?"var(--pul)":"var(--gn)"}}>{tx.type==="spend"?`-${Math.abs(tx.xp||0)} XP`:tx.type==="convert"?`+${centsShort(tx.cents||0)}`:tx.xp?`+${tx.xp} XP`:centsShort(Math.abs(tx.cents||0))}</div>
                  </div>;
                })}
                {!txLog.filter(t=>t.kidId===kid.id).length&&<div className="empty"><div className="emptyic">📋</div><div className="emptytx">No transactions yet.</div></div>}
              </div>
            </>
          )}
          {kmView==="badges"&&(
            <>
              <div style={{fontSize:11,fontWeight:800,color:"var(--tx2)",marginBottom:14,textTransform:"uppercase",letterSpacing:".07em"}}>
                Badges — {(kid.badges||[]).length} of {BADGE_DEFS.length} earned
              </div>
              <div style={{height:6,background:"var(--s3)",borderRadius:3,overflow:"hidden",marginBottom:18}}>
                <div style={{height:"100%",borderRadius:3,background:"var(--pu)",width:`${Math.round(((kid.badges||[]).length/BADGE_DEFS.length)*100)}%`,transition:"width .7s cubic-bezier(.34,1.56,.64,1)"}}/>
              </div>
              <div className="badge-grid">
                {BADGE_DEFS.map(b=>{
                  const earned=(kid.badges||[]).includes(b.id);
                  return(
                    <div key={b.id} className={`badge-card${earned?" earned":" locked"}`}>
                      <div className="badge-ic">{b.emoji}</div>
                      <div className="badge-name">{b.name}</div>
                      <div className="badge-desc">{earned?b.desc:"???"}</div>
                      {earned&&<div style={{fontSize:9,color:"var(--pul)",fontWeight:800,marginTop:4}}>EARNED</div>}
                    </div>
                  );
                })}
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
  const pendCount=pend.length;
  const todayDone=Object.values(comps[today()]||{}).filter(c=>c.status==="approved").length;

  function DashboardView(){
    const wkSummary=kids.map(k=>{
      const wg=weekGoalStatus(k);
      return{kid:k,earned:wg?.earned||0,target:wg?.target||1,hit:wg?.hit||false};
    });

    return(
      <>
        <div className="sg">
          {[{lbl:"Done today",val:todayDone,c:"var(--te)"},{lbl:"Pending",val:pendCount,c:"var(--am)"},{lbl:"Chores",val:chores.length,c:"var(--pu)"},{lbl:"Members",val:kids.length,c:"var(--pk)"}]
            .map(s=><div className="sc" key={s.lbl}><div className="sn" style={{color:s.c}}>{s.val}</div><div className="sl">{s.lbl}</div></div>)}
        </div>

        {kids.length>0&&<div className="week-summary">
          <div className="week-summary-title">This week — XP earned</div>
          {wkSummary.map(({kid:k,earned,target,hit})=>{
            const c=getColor(k.colorIdx);
            const pct=Math.min(earned/Math.max(target,1),1);
            return <div className="week-row" key={k.id}>
              <div style={{width:28,height:28,borderRadius:"50%",background:c.bg,color:c.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,flexShrink:0}}>{k.initials}</div>
              <div style={{fontSize:12,fontWeight:700,width:64,flexShrink:0}}>{k.name}</div>
              <div className="week-bar-wrap">
                <div className="week-bar" style={{width:`${pct*100}%`,background:hit?"var(--te)":c.bg}}/>
              </div>
              <div style={{fontSize:11,fontWeight:800,fontFamily:"var(--fm)",width:52,textAlign:"right",flexShrink:0,color:hit?"var(--te)":"var(--tx2)"}}>{earned} XP{hit?" ✓":""}</div>
            </div>;
          })}
        </div>}

        {kids.map(k=>{
          const wg=weekGoalStatus(k);const mg=monthGoalStatus(k);
          return[
            wg?.hit&&<div key={`wg-${k.id}`} className="gbanner gb-w"><div style={{fontSize:22}}>🎯</div><div><div style={{fontSize:13,fontWeight:800}}>{k.name} hit their weekly goal!</div><div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{wg.earned}/{wg.target} XP · <strong style={{color:"var(--bl)"}}>+{centsShort(wg.bonus)} bonus</strong></div></div></div>,
            mg?.hit&&<div key={`mg-${k.id}`} className="gbanner gb-m"><div style={{fontSize:22}}>🏆</div><div><div style={{fontSize:13,fontWeight:800}}>{k.name} {mg.over?"exceeded":"hit"} their monthly goal!</div><div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{mg.earned}/{mg.target} XP · <strong style={{color:"var(--am)"}}>{centsShort(mg.totalBonus)} total payout</strong></div></div></div>,
          ];
        })}
        <div className="sh" style={{marginBottom:12}}><span className="sht">Family</span>
          <div style={{display:"flex",gap:6}}>
            {parentMode&&<button className="btn btn-am btn-sm" onClick={()=>{setBonusKid(kids[0]?.id||null);setBonusType('xp');setBonusAmt('');setBonusNote('');setShowBonus(true);}}>🎁 Give bonus</button>}
            {parentMode&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddKid(true)}>+ Add kid</button>}
          </div>
        </div>
        <div className="g3" style={{marginBottom:22}}>
          {kids.map(k=><KidCard key={k.id} kid={k} onClick={()=>{setActiveKid(k.id);setSelDate(today());setView("chores");}}/>)}
        </div>
        {parents.length>0&&parentMode&&<>
          <div className="sh" style={{marginBottom:10,marginTop:4}}><span className="sht">Parent chores today</span></div>
          <div className="g2" style={{marginBottom:20}}>
            {parents.map(p=>{
              const cc=getColor(p.colorIdx);
              const myChores=chores.filter(c=>(c.assignedTo||[]).includes(p.id)&&choreAppearsOnDate(c,today()));
              const doneCt=myChores.filter(c=>comps[today()]?.[ckey(c.id,p.id)]?.status==='approved').length;
              return <div key={p.id} style={{background:"var(--s1)",border:"1px solid var(--b1)",borderRadius:"var(--r)",padding:"13px 15px",display:"flex",alignItems:"center",gap:11}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:cc.bg,color:cc.tx,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,flexShrink:0}}>{p.initials}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:800}}>{p.name}</div>
                  <div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{doneCt}/{myChores.length} done today</div>
                </div>
                {parentMode&&<button className="btn btn-g btn-sm" onClick={()=>setEditParent({...p})}>Edit</button>}
              </div>;
            })}
          </div>
        </>}
        {parentMode&&pend.length>0&&<>
          <div className="sh"><span className="sht">Approval queue</span><span className="shc">{pend.length} waiting</span></div>
          <div className="card0" style={{marginBottom:22}}>
            {pend.map(p=>{
              const chore=chores.find(c=>c.id===p.choreId);const kid=memberById(p.kidId); if(!chore||!kid)return null;
              const cc=getColor(kid.colorIdx);const past=isPast(p.dk)&&p.dk!==today();
              return <div className="aqr" key={`${p.dk}_${p.ck}`}>
                <div className="av-xs" style={{width:32,height:32,background:cc.bg,color:cc.tx,fontSize:11}}>{kid.initials}</div>
                <div className="aqi"><div className="aqt">{chore.title}</div>
                  <div className="aqs">{kid.name} · +{DIFF[chore.diff].xp} XP / {centsShort(xpToCents(DIFF[chore.diff].xp))}{past?" (75%)":""} · {past?<span style={{color:"var(--bl)"}}>{p.dk}</span>:"today"}</div>
                </div>
                <div className="aqa">
                  <button className="btn btn-ok btn-sm" onClick={()=>approveComp(p.dk,p.ck,p.kidId,p.choreId)}>✓ Approve</button>
                  <button className="btn btn-no btn-sm" onClick={()=>promptDeny(p.dk,p.ck,p.kidId,p.choreId)}>✕ Deny</button>
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
    const list=chores.filter(c=>{
      if(!choreAppearsOnDate(c,dk))return false;
      if(c.upForGrabs)return false;
      if(!activeKid)return true;
      return (c.assignedTo||[]).includes(activeKid);
    });
    const grabChores=chores.filter(c=>c.upForGrabs&&choreAppearsOnDate(c,dk)&&!c.deletedAfter);
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
          📅 Past day — anyone can mark tasks complete. Earns <strong>75% XP & dollars</strong>.
        </div>}
        {daily.length>0&&<><div className="sh"><span className="sht">Daily</span><span className="shc">{daily.length}</span></div><div className="ga" style={{marginBottom:20}}>{daily.map(c=><ChoreCard key={c.id} chore={c} dk={dk}/>)}</div></>}
        {recurring.length>0&&<><div className="sh"><span className="sht">Recurring</span><span className="shc">{recurring.length}</span></div><div className="ga" style={{marginBottom:20}}>{recurring.map(c=><ChoreCard key={c.id} chore={c} dk={dk}/>)}</div></>}
        {once.length>0&&<><div className="sh"><span className="sht">One-time</span><span className="shc">{once.length}</span></div><div className="ga" style={{marginBottom:20}}>{once.map(c=><ChoreCard key={c.id} chore={c} dk={dk}/>)}</div></>}
        {grabChores.length>0&&<>
          <div className="sh"><span className="sht">🙋 Up for Grabs</span><span className="shc" style={{color:"var(--am)"}}>Anyone can claim one</span></div>
          <div style={{background:"rgba(245,166,35,.05)",border:"1px solid rgba(245,166,35,.15)",borderRadius:"var(--rs)",padding:"8px 13px",marginBottom:12,fontSize:11,color:"var(--am)"}}>
            These chores earn bonus XP for whoever claims them. One at a time per person.
          </div>
          <div className="ga" style={{marginBottom:20}}>
            {grabChores.map(c=><GrabChoreCard key={c.id} chore={c} dk={dk} kids={kids} parents={parents} comps={comps} grabs={grabs} activeKid={activeKid} parentMode={parentMode} claimGrab={claimGrab} releaseGrab={releaseGrab} completeChore={completeChore} ckey={ckey} DIFF={DIFF} xpToCents={xpToCents} centsShort={centsShort} isPast={isPast} streakMult={streakMult} kidById={kidById}/>)}
          </div>
        </>}
        {list.length===0&&grabChores.length===0&&<div className="empty"><div className="emptyic">✓</div><div className="emptytx">No chores scheduled for this day.</div></div>}
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
          const chore=chores.find(x=>x.id===c.choreId);const kid=memberById(c.kidId); if(!chore||!kid)return null;
          const cc=getColor(kid.colorIdx);const past=isPast(c.dk)&&c.dk!==today();
          const xp=Math.round(DIFF[chore.diff].xp*(past?.75:1));
          return <div className="actr" key={i}>
            <div className="av-xs" style={{width:32,height:32,background:cc.bg,color:cc.tx,fontSize:11,borderRadius:"50%"}}>{kid.initials}</div>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{chore.title}</div>
              <div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>{kid.name} · <span style={{color:"var(--pul)"}}>+{xp} XP</span> · <span style={{color:"var(--gn)"}}>{centsShort(xpToCents(xp))}</span>{past?" (75%)":""} · {past?c.dk:"today"}</div>
            </div>
            <span className="badge ba">✓</span>
          </div>;
        })}
      </div>
    );
  }

  /* ── Bottom nav (mobile only) ── */
  function BottomNav(){
    const items=[
      {id:"dashboard",ic:"⬡",lbl:"Home"},
      {id:"chores",ic:"✓",lbl:"Chores"},
      {id:"store",ic:"🛍️",lbl:"Store"},
      {id:"money",ic:"💵",lbl:"Money"},
      {id:"activity",ic:"↻",lbl:"Activity"},
      {id:"settings",ic:"⚙",lbl:"Settings"},
    ];
    return(
      <div className="bottom-nav">
        <div className="bn-inner">
          {items.map(n=>(
            <button key={n.id} className={`bn-item${view===n.id?" act":""}`}
              onClick={()=>{setView(n.id);if(!["chores","store","money"].includes(n.id))setActiveKid(null);}}>
              <span className="bn-ic">{n.ic}</span>
              <span className="bn-lb">{n.lbl}</span>
              {n.id==="chores"&&pendCount>0&&<span className="bn-badge">{pendCount}</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ─── Profile picker / PIN routing ── */
  if(screen==='picker')return(<><style>{CSS}</style><ProfilePicker kids={kids} enterKidMode={enterKidMode} enterParentMode={enterParentMode} isPINSet={isPINSet}/></>);
  if(screen==='pin')return(<><style>{CSS}</style><PINScreen pinEntry={pinEntry} pinError={pinError} pinMode={pinMode} pinStep={pinStep} handlePINKey={handlePINKey} onBack={()=>{setPinEntry('');setScreen('picker');}}/></>);

  if(!parentMode&&activeKid){
    return(
      <>
        <style>{CSS}</style>
        <div className="twrap">{toasts.map(t=><div className="toast" key={t.id}>{t.xp&&<span className="t-xp">+{t.xp} XP</span>}{t.cents&&<span className="t-do">{centsShort(t.cents)}</span>}<span className="t-msg">{t.msg}</span></div>)}</div>
        {lvlUp&&<div className="lvlbd"><div className="lvlbox"><h2>Level Up! ⚡</h2><p>{lvlUp.name} reached Level {lvlUp.level}!</p></div></div>}
        {goalUnlock&&<div className="unlock-bd"><div className="unlock-box">
          <h2>{goalUnlock.type==='monthly'?"🏆 Monthly Goal Hit!":"🎯 Weekly Goal Hit!"}</h2>
          <p>{goalUnlock.name} earned a {goalUnlock.bonus} bonus!{goalUnlock.type==='monthly'?" Store is now unlocked 🛍️":""}</p>
        </div></div>}
        {buyBanner&&<div className="buy-banner"><div style={{fontSize:28}}>{buyBanner.emoji}</div><div><div style={{fontSize:14,fontWeight:800}}>{buyBanner.name}</div><div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>Redeemed for {buyBanner.price} 🎉</div></div></div>}
        {badgeEarned&&<div className="badge-earn-bd"><div className="badge-earn-box">
          <div className="big-ic">{badgeEarned.emoji}</div>
          <h2>Badge Unlocked!</h2>
          <p><strong>{badgeEarned.name}</strong> — {badgeEarned.desc}</p>
        </div></div>}
        {kidNotif&&<div className={`inkid-notif ${kidNotif.type}`}>
          <div className="ni-ic">{kidNotif.type==='approved'?'✅':'❌'}</div>
          <div>
            <div className="ni-title">{kidNotif.type==='approved'?`"${kidNotif.choreName}" approved!`:`"${kidNotif.choreName}" needs a redo`}</div>
            <div className="ni-sub">{kidNotif.type==='approved'?'XP and dollars added to your balance!':kidNotif.note||'Parent sent it back.'}</div>
          </div>
        </div>}
        <KidMode/>
        <button onClick={()=>setScreen('picker')} style={{position:"fixed",bottom:20,right:20,background:"var(--s2)",border:"1px solid var(--b2)",borderRadius:"var(--rs)",padding:"8px 14px",fontSize:12,fontWeight:700,color:"var(--tx2)",cursor:"pointer",fontFamily:"var(--f)"}}>← Switch profile</button>
      </>
    );
  }

  const vmeta={
    dashboard:{t:"Dashboard",s:"Family overview"},
    chores:{t:activeKid?`${kidById(activeKid)?.name}'s Chores`:"All Chores",s:selDate===today()?"Today":parseDate(selDate).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})},
    store:{t:"Family Store",s:"10 XP = $1.00"},
    money:{t:"Money",s:activeKid?`${kidById(activeKid)?.name}'s balance`:"All balances"},
    activity:{t:"Activity",s:"Completed tasks"},
    settings:{t:"Settings",s:"Family & app preferences"},
  };
  const vm=vmeta[view]||vmeta.dashboard;

  return(
    <>
      <style>{CSS}</style>
      <div className="twrap">{toasts.map(t=><div className="toast" key={t.id}>{t.xp&&<span className="t-xp">+{t.xp} XP</span>}{t.cents&&<span className="t-do">{centsShort(t.cents)}</span>}<span className="t-msg">{t.msg}</span></div>)}</div>
      {lvlUp&&<div className="lvlbd"><div className="lvlbox"><h2>Level Up! ⚡</h2><p>{lvlUp.name} reached Level {lvlUp.level}!</p></div></div>}
      {goalUnlock&&<div className="unlock-bd"><div className="unlock-box">
        <h2>{goalUnlock.type==='monthly'?"🏆 Monthly Goal Hit!":"🎯 Weekly Goal Hit!"}</h2>
        <p>{goalUnlock.name} earned a {goalUnlock.bonus} bonus!{goalUnlock.type==='monthly'?" Store is now unlocked 🛍️":""}</p>
      </div></div>}
      {buyBanner&&<div className="buy-banner"><div style={{fontSize:28}}>{buyBanner.emoji}</div><div><div style={{fontSize:14,fontWeight:800}}>{buyBanner.name}</div><div style={{fontSize:11,color:"var(--tx2)",marginTop:2}}>Redeemed for {buyBanner.price} 🎉</div></div></div>}
      {badgeEarned&&<div className="badge-earn-bd"><div className="badge-earn-box">
        <div className="big-ic">{badgeEarned.emoji}</div>
        <h2>Badge Unlocked!</h2>
        <p><strong>{badgeEarned.name}</strong> — {badgeEarned.desc}</p>
      </div></div>}
      {goalKid&&<GoalModal kid={kidById(goalKid)} editGoal={editGoal} setEditGoal={setEditGoal} onClose={()=>setGoalKid(null)} onSave={()=>saveGoal(goalKid)} centsShort={centsShort} xpToCents={xpToCents}/>}
      {showAddChore&&<AddChoreModal cf={cf} setCf={setCf} kids={kids} parents={parents} onClose={()=>setShowAddChore(false)} onSave={addChore} toggleDay={toggleDay}/>}
      {showAddKid&&<AddKidModal kf={kf} setKf={setKf} onClose={()=>setShowAddKid(false)} onSave={addKid}/>}
      {showAddItem&&<AddItemModal itemF={itemF} setItemF={setItemF} onClose={()=>setShowAddItem(false)} onSave={addStoreItem}/>}
      {editChore&&<EditChoreModal editChore={editChore} setEditChore={setEditChore} kids={kids} parents={parents} onSave={saveEditChore} onDelete={()=>deleteChore(editChore.id)}/>}
      {editKid&&<EditKidModal editKid={editKid} setEditKid={setEditKid} onSave={saveEditKid}/>}
      {editParent&&<EditParentModal editParent={editParent} setEditParent={setEditParent} onSave={saveEditParent}/>}
      {editItem&&<EditItemModal editItem={editItem} setEditItem={setEditItem} onSave={saveEditItem} onDelete={()=>deleteStoreItem(editItem.id)}/>}
      {deleteChoreTarget&&<DeleteChoreModal choreId={deleteChoreTarget} chores={chores} onForward={()=>confirmDeleteForward(deleteChoreTarget)} onPermanent={()=>confirmDeletePermanent(deleteChoreTarget)} onCancel={()=>setDeleteChoreTarget(null)}/>}
      {showBonus&&<BonusModal kids={kids} bonusKid={bonusKid} setBonusKid={setBonusKid} bonusType={bonusType} setBonusType={setBonusType} bonusAmt={bonusAmt} setBonusAmt={setBonusAmt} bonusNote={bonusNote} setBonusNote={setBonusNote} onClose={()=>setShowBonus(false)} onSave={giveBonus}/>}
      {denyTarget&&<DenyModal denyTarget={denyTarget} onConfirm={confirmDeny} onCancel={()=>setDenyTarget(null)}/>}
      {/* BATCH 4: Allowance modal */}
      {allowanceKid&&<AllowanceModal kid={kidById(allowanceKid)} onClose={()=>setAllowanceKid(null)} onSave={saveAllowance}/>}
      {/* BATCH 5: Change PIN modal */}
      {showChangePIN&&<ChangePINModal onClose={()=>setShowChangePIN(false)} onSaved={()=>{setShowChangePIN(false);toast('PIN updated!');}}/>}
      <BottomNav/>

      <div className="app">
        <aside className="sidebar">
          <div className="logo">Watts<span>Hub</span><em><span className={`sync-dot${ready?" live":""}`}/>{ready?"Live sync":"Demo mode"}</em></div>
          <div style={{padding:"0 9px",marginBottom:4}}>
            <div className="nlbl">Navigate</div>
            {[
              {id:"dashboard",ic:"⬡",lbl:"Dashboard"},
              {id:"chores",ic:"✓",lbl:"Chores"},
              {id:"store",ic:"🛍️",lbl:"Store"},
              {id:"money",ic:"💵",lbl:"Money"},
              {id:"activity",ic:"↻",lbl:"Activity"},
              {id:"settings",ic:"⚙",lbl:"Settings"},
            ].map(n=>(
              <button key={n.id} className={`ni${view===n.id?" act":""}`} onClick={()=>{setView(n.id);if(!["chores","store","money"].includes(n.id))setActiveKid(null);}}>
                <span className="ic">{n.ic}</span>{n.lbl}
                {n.id==="chores"&&pendCount>0&&<span className="nav-badge">{pendCount}</span>}
              </button>
            ))}
          </div>
          <div style={{padding:"0 9px"}}>
            <div className="nlbl">Family</div>
            {[...kids,...(parentMode?parents:[])].map(m=>{const cc=getColor(m.colorIdx);return(
              <button key={m.id} className={`kni${activeKid===m.id?" act":""}`} onClick={()=>{setActiveKid(m.id);setSelDate(today());setView("chores");}}>
                <div className="av-xs" style={{width:23,height:23,background:cc.bg,color:cc.tx,fontSize:9}}>{m.initials}</div>
                {m.name}{m.isParent&&<span style={{fontSize:9,marginLeft:3,opacity:.6}}>👤</span>}
              </button>
            );})}
            {activeKid&&<button className="kni" style={{color:"var(--tx3)"}} onClick={()=>{setActiveKid(null);setView("dashboard");}}><span style={{width:23,textAlign:"center"}}>←</span>Back</button>}
          </div>
          <div className="sfoot">
            <div className="swrow">
              <span style={{fontSize:11,fontWeight:600,color:"var(--tx2)"}}>Parent mode</span>
              {parentMode
                ?<button className="btn-g btn btn-sm" onClick={()=>{setParentMode(false);setActiveKid(null);setScreen('picker');}}>Exit</button>
                :<button className="btn-p btn btn-sm" onClick={enterParentMode}>Enter</button>
              }
            </div>
          </div>
        </aside>

        <main className="main">
          <div className="topbar">
            <div><div style={{fontSize:17,fontWeight:800}}>{vm.t}</div><div style={{fontSize:11,color:"var(--tx2)",marginTop:1}}>{vm.s}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:7}}>
              {pendCount>0&&parentMode&&<span style={{background:"rgba(245,166,35,.13)",color:"var(--am)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>{pendCount} pending</span>}
              {ready&&<span style={{background:"rgba(45,212,167,.09)",color:"var(--te)",fontSize:11,fontWeight:800,padding:"3px 8px",borderRadius:5}}>● Live</span>}
              {parentMode&&view==="store"&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddItem(true)}>+ Item</button>}
              {parentMode&&view!=="settings"&&<button className="btn btn-p btn-sm" onClick={()=>setShowAddChore(true)}>+ Chore</button>}
              {parentMode&&view!=="settings"&&<button className="btn btn-g btn-sm" onClick={()=>setShowAddKid(true)}>+ Kid</button>}
            </div>
          </div>
          <div className="content">
            {view==="dashboard"&&<DashboardView/>}
            {view==="chores"&&<ChoresView/>}
            {view==="store"&&<StoreView/>}
            {view==="money"&&<MoneyView/>}
            {view==="activity"&&<ActivityView/>}
            {view==="settings"&&<SettingsView/>}
          </div>
        </main>
      </div>
    </>
  );
}

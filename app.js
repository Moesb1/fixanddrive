/* ==========================================================================
   FIX & DRIVE — garage manager (offline PWA)

   Data lives entirely in localStorage under the original v2 keys, so a phone
   that already had the single-file version keeps every bill, expense and job.

     fixdrive_v2_bills   bills
     fixdrive_expenses   expenses
     fixdrive_jobs       job board
     fixdrive_currency   selected display currency

   Everything is plain ES5-flavoured JS with no build step and no dependencies
   so the whole app can be cached and run with zero network.
   ========================================================================== */
'use strict';

/* ══════════════════════════ CONSTANTS ══════════════════════════ */

var SK = 'fixdrive_v2_bills';
var EK = 'fixdrive_expenses';
var JK = 'fixdrive_jobs';
var CK = 'fixdrive_currency';

var START_ITEMS = 4;      // rows the form opens with
var PRINT_ROWS  = 7;      // minimum rows drawn on the printed A4 sheet

var EXP_ICONS = {
  'Rent':'🏠','Utilities':'💡','Tools & Equipment':'🔧','Parts Purchase':'📦',
  'Salaries':'👥','Fuel':'⛽','Insurance':'🛡️','Maintenance':'🔩',
  'Advertising':'📢','Other':'📋'
};
var EXP_COLORS = {
  'Rent':'#6366f1','Utilities':'#0ea5e9','Tools & Equipment':'#14b8a6',
  'Parts Purchase':'#8b5cf6','Salaries':'#f59e0b','Fuel':'#ef4444',
  'Insurance':'#10b981','Maintenance':'#f97316','Advertising':'#ec4899','Other':'#64748b'
};

var CURR_MAP = { USD:'$', EUR:'€', LBP:'L.L. ', GBP:'£', AED:'AED ' };
/* Exchange rates vs 1 USD — sourced June 2026 */
var RATES = { USD:1, EUR:0.855, LBP:89500, GBP:0.743, AED:3.673 };

var J_CYCLE    = ['waiting','in_progress','done','collected'];
var J_LABEL    = { waiting:'● Waiting', in_progress:'↻ In Progress', done:'✓ Done', collected:'↑ Collected' };
var J_NEXT_BTN = { waiting:'→ Start Job', in_progress:'✓ Mark Done', done:'↑ Mark Collected' };

/* ══════════════════════════ TINY HELPERS ══════════════════════════ */

function $(id){ return document.getElementById(id); }
function $$(sel, root){ return [].slice.call((root||document).querySelectorAll(sel)); }
function val(id){ var e=$(id); return e ? e.value.trim() : ''; }
function setVal(id,v){ var e=$(id); if(e) e.value = v==null ? '' : v; }

function esc(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* dd/mm/yyyy for display and print */
function fd(d){
  if(!d) return '';
  var p = String(d).split('-');
  return p.length === 3 ? p[2]+'/'+p[1]+'/'+p[0] : String(d);
}

function todayISO(){
  var n = new Date();
  return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0');
}

/* ══════════════════════════ STORAGE ══════════════════════════ */

function readJSON(key){
  try{
    var raw = localStorage.getItem(key);
    var v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  }catch(e){
    return [];
  }
}
function writeJSON(key,v){
  try{
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  }catch(e){
    // Quota exceeded, or Private Browsing on older iOS.
    toast('Could not save — phone storage is full','err',5000);
    return false;
  }
}

function gb(){ return readJSON(SK); }
function sb(v){ return writeJSON(SK,v); }
function ge(){ return readJSON(EK); }
function se(v){ return writeJSON(EK,v); }
function gj(){ return readJSON(JK); }
function sj(v){ return writeJSON(JK,v); }

/* ══════════════════════════ CURRENCY ══════════════════════════ */

function getCurr(){
  var c;
  try{ c = localStorage.getItem(CK); }catch(e){ c = null; }
  return RATES[c] ? c : 'USD';
}
function sym(c){ return CURR_MAP[c || getCurr()] || '$'; }

/* Convert an amount stored in `from` into the currently displayed currency. */
function cvt(n, from){
  var v = parseFloat(n) || 0;
  from = RATES[from] ? from : getCurr();
  var to = getCurr();
  if(from === to) return v;
  return (v / RATES[from]) * RATES[to];
}

/* Format a value that is already in the display currency. */
function fmtV(v){
  var c = getCurr(), s = sym();
  if(c === 'LBP') return s + Math.round(v).toLocaleString('en');
  return s + (parseFloat(v)||0).toFixed(2);
}

/* Short form for the stat tiles (12.4k, 3.2M …). */
function fmtBig(v){
  var c = getCurr(), s = sym();
  v = parseFloat(v) || 0;
  if(c === 'LBP'){
    if(v >= 1e9) return s + (v/1e9).toFixed(1) + 'B';
    if(v >= 1e6) return s + (v/1e6).toFixed(1) + 'M';
    return s + Math.round(v).toLocaleString('en');
  }
  if(v >= 1000) return s + (v/1000).toFixed(1) + 'k';
  return s + Math.round(v);
}

function fm(n, from){ return fmtV(cvt(n, from || getCurr())); }

function updateRateDisplay(){
  var c = getCurr(), el = $('curr-rate');
  if(!el) return;
  if(c === 'USD'){ el.textContent = 'Base · Jun 2026'; return; }
  var r = RATES[c];
  if(c === 'LBP')      el.textContent = '1 USD = ' + r.toLocaleString('en') + ' L.L.';
  else if(c === 'EUR') el.textContent = '1 USD = €' + r.toFixed(3);
  else if(c === 'GBP') el.textContent = '1 USD = £' + r.toFixed(3);
  else                 el.textContent = '1 USD = AED ' + r.toFixed(3);
}

function onCurrencyChange(c){
  try{ localStorage.setItem(CK,c); }catch(e){}
  updateRateDisplay();
  recalc();
  refreshAll();
  toast('Currency set to ' + c, 'ok');
}

/* ══════════════════════════ TOASTS ══════════════════════════ */

function toast(msg, type, dur){
  type = type || 'ok';
  dur  = dur  || 3200;
  var icons = { ok:'✓', err:'✕', info:'ℹ' };
  var wrap = $('toasts');
  if(!wrap) return;
  var t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<span class="ico">'+icons[type]+'</span><span class="msg">'+esc(msg)+'</span>';
  t.addEventListener('click', function(){ if(t.parentNode) t.parentNode.removeChild(t); });
  wrap.appendChild(t);
  setTimeout(function(){
    t.style.animation = 'tout .24s ease forwards';
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 250);
  }, dur);
}

/* ══════════════════════════ BOTTOM SHEETS ══════════════════════════ */

function openSheet(el){
  el.classList.remove('closing');
  el.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSheet(el){
  el.classList.add('closing');
  document.body.style.overflow = '';
  setTimeout(function(){
    el.classList.remove('open','closing');
  }, 190);
}

var _confirmCb = null;

function confirmSheet(opts){
  var ov = $('confirm-sheet');
  $('confirm-ico').className = 'sheet-ico ' + (opts.danger ? 'danger' : 'warn');
  $('confirm-ico').textContent = opts.icon || (opts.danger ? '🗑️' : '⚠️');
  $('confirm-title').textContent = opts.title || 'Are you sure?';
  $('confirm-msg').textContent   = opts.msg || '';
  var ok = $('confirm-ok');
  ok.textContent = opts.confirmText || 'Confirm';
  ok.className = 'btn btn-block ' + (opts.danger ? 'btn-red' : 'btn-dark');
  _confirmCb = opts.onConfirm || null;
  openSheet(ov);
}

/* ══════════════════════════ NAVIGATION ══════════════════════════ */

var TABS = ['new','saved','expenses','history','jobs'];

function goTab(name){
  if(TABS.indexOf(name) === -1) name = 'new';
  $$('.pane').forEach(function(p){ p.classList.remove('on'); });
  $$('.nav-btn').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-tab') === name); });
  var pane = $('pane-' + name);
  if(pane) pane.classList.add('on');

  if(name === 'saved')    renderBills();
  if(name === 'expenses') renderExpenses();
  if(name === 'history')  renderHistory();
  if(name === 'jobs')     renderJobs();

  window.scrollTo(0,0);
}

/* Redraw whatever is currently on screen plus the always-visible header. */
function refreshAll(){
  updateStats();
  renderBills();
  renderExpenses();
  renderHistory();
  renderJobs();
}

/* ══════════════════════════ STATS ══════════════════════════ */

function getStatus(b){
  if(b.status === 'paid') return 'paid';
  if(b.due && new Date(b.due) < new Date(new Date().toDateString())) return 'overdue';
  return 'unpaid';
}
function statusLabel(s){
  return s === 'paid' ? '✓ PAID' : s === 'overdue' ? '⚠ OVERDUE' : '● UNPAID';
}

function updateStats(){
  var bills = gb();
  var total  = bills.reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
  var labour = bills.reduce(function(s,b){ return s + cvt(b.labourTotal||0, b.currency||'USD'); }, 0);
  var unpaid = bills.filter(function(b){ return getStatus(b) !== 'paid'; })
                    .reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
  var avg = bills.length ? total / bills.length : 0;
  var expTotal = ge().reduce(function(s,e){ return s + cvt(e.amount, e.currency||'USD'); }, 0);
  var profit = total - expTotal;

  function set(id, v){ var e = $(id); if(e) e.textContent = v; }

  set('h-cnt', bills.length);
  set('h-rev', fmtBig(total));
  set('h-lab', fmtBig(labour));
  set('h-unp', fmtBig(unpaid));
  set('b-cnt', bills.length);
  set('b-rev', fmtBig(total));
  set('b-lab', fmtBig(labour));
  set('b-unp', fmtBig(unpaid));

  var hp = $('h-profit');
  if(hp){
    hp.textContent = fmtBig(Math.abs(profit));
    hp.style.color = profit >= 0 ? '#34d399' : '#f87171';
  }

  // Live count of jobs still on the board, shown on the nav.
  var open = gj().filter(function(j){ return j.status !== 'collected'; }).length;
  var dot = $('jobs-dot');
  if(dot){
    dot.textContent = open;
    dot.classList.toggle('show', open > 0);
  }

  return { total:total, labour:labour, unpaid:unpaid, avg:avg, expTotal:expTotal, profit:profit };
}

/* ══════════════════════════ NEW BILL — LINE ITEMS ══════════════════════════ */

function itemMarkup(n){
  return ''+
    '<div class="item-top">'+
      '<div class="item-num">'+n+'</div>'+
      '<input type="text" class="i-d item-desc" placeholder="Service or part" autocomplete="off">'+
      '<button class="item-del" type="button" data-act="del-item" aria-label="Remove item">✕</button>'+
    '</div>'+
    '<div class="item-grid">'+
      '<div class="item-cell">'+
        '<label>Type</label>'+
        '<button class="type-toggle parts" type="button" data-act="toggle-type">Parts</button>'+
      '</div>'+
      '<div class="item-cell">'+
        '<label>Qty</label>'+
        '<input type="number" class="i-q" placeholder="1" min="0" step="any" inputmode="decimal">'+
      '</div>'+
      '<div class="item-cell">'+
        '<label>Price</label>'+
        '<input type="number" class="i-p" placeholder="0.00" min="0" step="0.01" inputmode="decimal">'+
      '</div>'+
    '</div>'+
    // The line total is a readout, not something to type into, so it is shown
    // as text. The hidden input keeps the value where collect() expects it.
    '<div class="item-amount">'+
      '<span class="l">Amount</span>'+
      '<span class="v i-av">—</span>'+
      '<input type="hidden" class="i-a" value="">'+
    '</div>';
}

function addItem(){
  var wrap = $('items');
  var card = document.createElement('div');
  card.className = 'item-card';
  card.innerHTML = itemMarkup(wrap.children.length + 1);
  wrap.appendChild(card);
  return card;
}

function buildItems(n){
  var wrap = $('items');
  wrap.innerHTML = '';
  for(var i = 0; i < (n || START_ITEMS); i++) addItem();
}

function renumberItems(){
  $$('#items .item-num').forEach(function(el,i){ el.textContent = i + 1; });
}

function delItem(btn){
  var wrap = $('items');
  if(wrap.children.length <= 1){ toast('Need at least one item','err'); return; }
  var card = btn.closest('.item-card');
  if(card) card.remove();
  renumberItems();
  recalc();
}

function toggleType(btn){
  var isLabour = btn.classList.toggle('labour');
  btn.classList.toggle('parts', !isLabour);
  btn.textContent = isLabour ? 'Labour' : 'Parts';
  recalc();
}

function recalc(){
  var sub = 0, labour = 0;

  $$('#items .item-card').forEach(function(card){
    var q = card.querySelector('.i-q');
    var p = card.querySelector('.i-p');
    var a = card.querySelector('.i-a');
    var av = card.querySelector('.i-av');
    var t = card.querySelector('.type-toggle');
    var amt = (parseFloat(q.value)||0) * (parseFloat(p.value)||0);
    a.value = amt > 0 ? amt.toFixed(2) : '';
    av.textContent = amt > 0 ? fm(amt) : '—';
    av.classList.toggle('zero', amt <= 0);
    sub += amt;
    if(t && t.classList.contains('labour')) labour += amt;
  });

  var disc = parseFloat(val('discount')) || 0;
  var tp   = parseFloat(val('tax-pct'))  || 0;
  var tax  = (sub - disc) * (tp / 100);
  var tot  = Math.max(0, sub - disc + tax);

  $('c-sub').textContent   = fm(sub);
  $('c-lab').textContent   = labour > 0 ? fm(labour) : '—';
  $('c-total').textContent = fm(tot);
  $('s-total').textContent = fm(tot);
}

/* Read the form into a bill object (same shape as the original v2). */
function collect(){
  var items = $$('#items .item-card').map(function(card,i){
    var t = card.querySelector('.type-toggle');
    return {
      num:    i + 1,
      desc:   card.querySelector('.i-d').value.trim(),
      qty:    card.querySelector('.i-q').value,
      price:  card.querySelector('.i-p').value,
      amount: card.querySelector('.i-a').value,
      type:   (t && t.classList.contains('labour')) ? 'labour' : 'parts'
    };
  });

  var sub    = items.reduce(function(s,it){ return s + (parseFloat(it.amount)||0); }, 0);
  var disc   = parseFloat(val('discount')) || 0;
  var tp     = parseFloat(val('tax-pct'))  || 0;
  var tax    = (sub - disc) * (tp / 100);
  var total  = Math.max(0, sub - disc + tax);
  var labour = items.reduce(function(s,it){
    return s + (it.type === 'labour' ? (parseFloat(it.amount)||0) : 0);
  }, 0);

  return {
    id: _editingId || Date.now(),
    status: 'unpaid',
    currency: getCurr(),
    labourTotal: labour,
    invNo:     val('inv-no'),
    date:      val('inv-date'),
    due:       val('inv-due'),
    custName:  val('cust-name'),
    custPhone: val('cust-phone'),
    custAddr:  val('cust-addr'),
    vehModel:  val('veh-model'),
    vehPlate:  val('veh-plate'),
    vehKm:     val('veh-km'),
    notes:     val('inv-notes'),
    items: items, sub: sub, disc: disc, taxPct: tp, taxAmt: tax, total: total
  };
}

/* Set when an existing bill is loaded, so Save updates rather than duplicates. */
var _editingId = null;

function saveBill(){
  var d = collect();
  if(!d.custName && !d.invNo){
    toast('Add a customer name or invoice number first','err');
    return;
  }
  var bills = gb();
  var idx = bills.findIndex(function(b){ return b.id === d.id; });
  if(idx > -1){
    d.status = bills[idx].status || 'unpaid';
    bills[idx] = d;
  }else{
    bills.unshift(d);
  }
  if(!sb(bills)) return;
  _editingId = d.id;                 // keep editing the same bill
  updateStats();
  renderBills();
  toast(idx > -1 ? 'Bill updated ✓' : 'Bill saved ✓','ok');
}

function autoInvNo(){
  setVal('inv-no', 'INV-' + String(gb().length + 1).padStart(3,'0'));
}

function autodue(){
  var d = val('inv-date');
  if(!d) return;
  var dt = new Date(d);
  dt.setDate(dt.getDate() + 30);
  setVal('inv-due', dt.toISOString().split('T')[0]);
}

function clearForm(){
  confirmSheet({
    icon:'🧹', title:'Clear the form?',
    msg:'Everything you typed here will be wiped. Saved bills are not affected.',
    confirmText:'Clear', danger:false,
    onConfirm: function(){
      ['inv-no','inv-date','inv-due','cust-name','cust-phone','cust-addr',
       'veh-model','veh-plate','veh-km','inv-notes'].forEach(function(id){ setVal(id,''); });
      setVal('discount','0');
      setVal('tax-pct','0');
      _editingId = null;
      buildItems();
      setVal('inv-date', todayISO());
      autodue();
      autoInvNo();
      recalc();
      window.scrollTo({ top:0, behavior:'smooth' });
      toast('Form cleared','info');
    }
  });
}

function loadBill(id){
  var b = gb().find(function(x){ return String(x.id) === String(id); });
  if(!b){ toast('Bill not found','err'); return; }

  _editingId = b.id;
  setVal('inv-no',     b.invNo);
  setVal('inv-date',   b.date);
  setVal('inv-due',    b.due);
  setVal('cust-name',  b.custName);
  setVal('cust-phone', b.custPhone);
  setVal('cust-addr',  b.custAddr);
  setVal('veh-model',  b.vehModel);
  setVal('veh-plate',  b.vehPlate);
  setVal('veh-km',     b.vehKm);
  setVal('inv-notes',  b.notes);
  setVal('discount',   b.disc   || 0);
  setVal('tax-pct',    b.taxPct || 0);

  var items = b.items || [];
  buildItems(Math.max(START_ITEMS, items.length));
  var cards = $$('#items .item-card');
  items.forEach(function(it,i){
    var c = cards[i];
    if(!c) return;
    c.querySelector('.i-d').value = it.desc  || '';
    c.querySelector('.i-q').value = it.qty   || '';
    c.querySelector('.i-p').value = it.price || '';
    if(it.type === 'labour') toggleType(c.querySelector('.type-toggle'));
  });

  recalc();
  goTab('new');
  toast('Bill loaded for editing','info');
}

function dupeBill(id){
  var o = gb().find(function(b){ return String(b.id) === String(id); });
  if(!o) return;
  var n = JSON.parse(JSON.stringify(o));
  n.id = Date.now();
  n.status = 'unpaid';
  var bills = gb();
  bills.unshift(n);
  if(!sb(bills)) return;
  updateStats();
  renderBills();
  toast('Bill duplicated','ok');
}

function delBill(id){
  confirmSheet({
    icon:'🗑️', title:'Delete this bill?',
    msg:'This cannot be undone. The bill will be permanently removed.',
    confirmText:'Delete', danger:true,
    onConfirm: function(){
      sb(gb().filter(function(b){ return String(b.id) !== String(id); }));
      if(String(_editingId) === String(id)) _editingId = null;
      updateStats();
      renderBills();
      toast('Bill deleted','info');
    }
  });
}

function toggleStatus(id){
  var bills = gb();
  var idx = bills.findIndex(function(b){ return String(b.id) === String(id); });
  if(idx === -1) return;
  bills[idx].status = bills[idx].status === 'paid' ? 'unpaid' : 'paid';
  if(!sb(bills)) return;
  updateStats();
  renderBills();
  toast(bills[idx].status === 'paid' ? 'Marked as PAID' : 'Marked as UNPAID','ok');
}

/* ══════════════════════════ PRINT / PDF ══════════════════════════

   The invoice is rendered into #print-root inside this document and printed
   with window.print(). An <iframe> was used in the desktop version, but
   iframe printing silently fails on mobile Safari and in some Android
   WebViews — the in-document route works everywhere, including installed
   standalone PWAs.
   ============================================================================ */

function buildPrintHTML(d){
  var fromC = d.currency || 'USD';
  var toC   = getCurr();
  var s     = CURR_MAP[toC] || '$';

  function money(n){
    var v = parseFloat(n) || 0;
    if(fromC !== toC) v = (v / RATES[fromC]) * RATES[toC];
    if(toC === 'LBP') return s + Math.round(v).toLocaleString('en');
    return s + v.toFixed(2);
  }

  /* Only real lines get printed; blanks pad the table out to a full sheet. */
  var filled = (d.items || []).filter(function(it){
    return (it.desc && it.desc.trim()) || (parseFloat(it.amount) || 0) > 0;
  });
  var rowCount = Math.max(PRINT_ROWS, filled.length);

  var rows = '';
  for(var i = 0; i < rowCount; i++){
    var it = filled[i] || {};
    var bg = i % 2 === 1 ? '#f7f9fc' : '#fff';
    rows += '<tr style="background:'+bg+'">'+
      '<td class="p-c p-tc">'+(i+1)+'</td>'+
      '<td class="p-c">'+esc(it.desc)+'</td>'+
      '<td class="p-c p-tc">'+esc(it.qty || '')+'</td>'+
      '<td class="p-c p-tr p-pr">'+(it.price  ? money(it.price)  : '')+'</td>'+
      '<td class="p-c p-tr p-pr">'+(it.amount ? money(it.amount) : '')+'</td>'+
    '</tr>';
  }

  var nl  = String(d.notes || '').split('\n');
  var dsc = (d.disc > 0) ? '-' + money(d.disc) : s + '0.00';

  return '<div class="psheet'+(rowCount > PRINT_ROWS ? ' dense' : '')+'">'+
    '<div class="p-bar"></div>'+

    '<div class="p-hdr">'+
      '<div class="p-hl">'+
        '<svg class="p-car" viewBox="0 0 130 95" xmlns="http://www.w3.org/2000/svg">'+
          '<path d="M42 40Q44 20 56 18L74 18Q86 18 88 40Z" fill="#1a1a1a"/>'+
          '<rect x="10" y="40" width="110" height="23" rx="5" fill="#1a1a1a"/>'+
          '<rect x="6" y="44" width="9" height="12" rx="3" fill="#1a1a1a"/>'+
          '<rect x="115" y="44" width="9" height="12" rx="3" fill="#1a1a1a"/>'+
          '<circle cx="32" cy="63" r="16" fill="#1a1a1a"/><circle cx="32" cy="63" r="7" fill="#888"/>'+
          '<circle cx="98" cy="63" r="16" fill="#1a1a1a"/><circle cx="98" cy="63" r="7" fill="#888"/>'+
          '<rect x="56" y="77" width="18" height="13" fill="#1a1a1a"/>'+
          '<rect x="26" y="88" width="78" height="5" rx="2.5" fill="#1a1a1a"/>'+
        '</svg>'+
        '<div class="p-bn">FIX AND DRIVE</div>'+
        '<div class="p-bt">W E &nbsp; F I X &nbsp; Y O U &nbsp; D R I V E</div>'+
      '</div>'+
      '<div class="p-hr">'+
        '<div class="p-itl">INVOICE</div>'+
        '<div class="p-fr"><span class="p-fl">INVOICE NO. :</span><span class="p-fd"></span><span class="p-fv">'+esc(d.invNo)+'</span></div>'+
        '<div class="p-fr"><span class="p-fl">DATE :</span><span class="p-fd"></span><span class="p-fv">'+fd(d.date)+'</span></div>'+
        '<div class="p-fr"><span class="p-fl">DUE DATE :</span><span class="p-fd"></span><span class="p-fv">'+fd(d.due)+'</span></div>'+
      '</div>'+
    '</div>'+

    '<div class="p-bts">'+
      '<div class="p-btl">'+
        '<div class="p-btlb">BILL TO :</div>'+
        '<div class="p-btll">'+esc(d.custName)+'</div>'+
        '<div class="p-btll">'+esc(d.custPhone)+'</div>'+
        '<div class="p-btll">'+esc(d.custAddr)+'</div>'+
      '</div>'+
      '<div class="p-btr">'+
        '<div class="p-cn">FIX AND DRIVE</div><div class="p-cb"></div>'+
        '<div class="p-ct">WE FIX · YOU DRIVE</div>'+
      '</div>'+
    '</div>'+

    '<div class="p-items">'+
      '<table class="p-tbl"><thead><tr>'+
        '<th class="p-thc" style="width:8mm">#</th>'+
        '<th>DESCRIPTION</th>'+
        '<th class="p-thc" style="width:14mm">QTY</th>'+
        '<th class="p-thr" style="width:30mm">UNIT PRICE</th>'+
        '<th class="p-thr" style="width:30mm">AMOUNT</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table>'+
    '</div>'+

    '<div class="p-bot">'+
      '<div class="p-veh">'+
        '<div class="p-vh">VEHICLE INFORMATION</div>'+
        '<div class="p-vb">'+
          '<div class="p-vr"><span class="p-vk">MAKE &amp; MODEL :</span><span class="p-vd"></span><span class="p-vv">'+esc(d.vehModel)+'</span></div>'+
          '<div class="p-vr"><span class="p-vk">LICENSE PLATE :</span><span class="p-vd"></span><span class="p-vv">'+esc(d.vehPlate)+'</span></div>'+
          '<div class="p-vr"><span class="p-vk">KILOMETERS :</span><span class="p-vd"></span><span class="p-vv">'+esc(d.vehKm)+'</span></div>'+
        '</div>'+
      '</div>'+
      '<div class="p-tots">'+
        '<div class="p-tr2"><span>SUBTOTAL</span><span class="p-tv">'+money(d.sub)+'</span></div>'+
        (d.labourTotal > 0
          ? '<div class="p-tr2"><span style="color:#b45309;font-size:2.8mm">↳ LABOUR</span><span class="p-tv" style="color:#b45309">'+money(d.labourTotal)+'</span></div>'
          : '')+
        '<div class="p-tr2"><span>DISCOUNT</span><span class="p-tv">'+dsc+'</span></div>'+
        '<div class="p-tr2"><span>TAX ('+(d.taxPct||0)+'%)</span><span class="p-tv">'+money(d.taxAmt)+'</span></div>'+
        '<div class="p-tr2 gd"><span>TOTAL DUE</span><span>'+money(d.total)+'</span></div>'+
      '</div>'+
    '</div>'+

    '<div class="p-nt">'+
      '<div class="p-nl">NOTES :</div>'+
      '<div class="p-nl2">'+esc(nl[0] || '')+'</div>'+
      '<div class="p-nl2">'+esc(nl[1] || '')+'</div>'+
    '</div>'+

    '<div class="p-ft">'+
      '<div class="p-ftl">'+
        '<svg width="26" height="26" viewBox="0 0 24 24" fill="#c1272d"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>'+
        '<div class="p-ftt">THANK YOU FOR CHOOSING<br><strong>FIX AND DRIVE</strong><br>WE APPRECIATE YOUR TRUST.</div>'+
      '</div>'+
      '<div class="p-ftr">'+
        '<div class="p-tt">TERMS &amp; CONDITIONS</div>'+
        '<div class="p-ti">Payment is due upon receipt of this invoice.</div>'+
        '<div class="p-ti">Late payments may incur additional charges.</div>'+
      '</div>'+
    '</div>'+

    '<div class="p-cor"></div>'+
  '</div>';
}

function doPrint(d){
  var root = $('print-root');
  if(!root){ toast('Print unavailable','err'); return; }
  root.innerHTML = buildPrintHTML(d);
  // Give the layout a frame to settle before the browser snapshots it.
  setTimeout(function(){
    try{
      window.print();
    }catch(e){
      toast('Print failed — try again','err');
    }
  }, 120);
}

function printCurrent(){ doPrint(collect()); }

function printSaved(id){
  var b = gb().find(function(x){ return String(x.id) === String(id); });
  if(b) doPrint(b);
  else toast('Bill not found','err');
}

/* ══════════════════════════ WHATSAPP (two-step) ══════════════════════════

   WhatsApp has no web API for attaching a file, so the flow stays manual:
   print the invoice to PDF, then open the customer's chat and attach it.
   ============================================================================ */

function cleanPhone(p){
  p = String(p || '').replace(/\D/g,'');
  if(!p) return '';
  if(p.indexOf('00') === 0) p = p.slice(2);
  if(p.charAt(0) === '0')   p = '961' + p.slice(1);
  if(p.indexOf('961') !== 0 && p.length <= 8) p = '961' + p;
  return p;
}

function showWA(d){
  if(!d.custName && !d.invNo){
    toast('Fill in the customer name or invoice number first','err');
    return;
  }
  $('wa-info').textContent = (d.custName || 'Customer') + (d.invNo ? ' · ' + d.invNo : '');

  $('wa-print-btn').onclick = function(){
    doPrint(d);
    toast('Choose "Save as PDF", then come back for step 2','info',5000);
  };

  var phone = cleanPhone(d.custPhone);
  var link = $('wa-open-btn');
  link.href = 'https://wa.me/' + phone;
  link.textContent = '';
  link.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M11.999 2C6.477 2 2 6.477 2 12c0 1.775.462 3.448 1.27 4.906L2 22l5.237-1.242A9.953 9.953 0 0012 22c5.522 0 10-4.477 10-10S17.521 2 11.999 2zm.001 18a7.96 7.96 0 01-4.073-1.118l-.292-.174-3.108.736.773-3.03-.19-.31A7.96 7.96 0 014 12c0-4.411 3.589-8 8-8s8 3.589 8 8-3.589 8-8 8z"/></svg>'+
    (phone ? 'Open Chat with ' + esc(d.custName || phone) + ' →' : 'Open WhatsApp →');

  openSheet($('wa-sheet'));
}

function waCurrent(){ showWA(collect()); }
function waSaved(id){
  var b = gb().find(function(x){ return String(x.id) === String(id); });
  if(b) showWA(b);
  else toast('Bill not found','err');
}

/* ══════════════════════════ SAVED BILLS ══════════════════════════ */

function fmTime(id){
  var d = new Date(parseInt(id,10) || 0);
  if(isNaN(d.getTime())) return '';
  var h = d.getHours(), m = d.getMinutes();
  var ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + (m < 10 ? '0' + m : m) + ' ' + ap;
}

function renderBills(){
  var srch = $('srch');
  if(!srch) return;
  var q = (srch.value || '').toLowerCase().trim();
  updateStats();

  var bills = gb();
  if(q){
    bills = bills.filter(function(b){
      return ['custName','vehModel','vehPlate','invNo','custPhone'].some(function(k){
        return String(b[k] || '').toLowerCase().indexOf(q) > -1;
      });
    });
  }

  var sumEl = $('srch-sum');
  if(bills.length){
    var ft = bills.reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
    var fl = bills.reduce(function(s,b){ return s + cvt(b.labourTotal||0, b.currency||'USD'); }, 0);
    var fu = bills.filter(function(b){ return getStatus(b) !== 'paid'; })
                  .reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
    sumEl.innerHTML = '<div class="summary-bar">'+
      '<span><span class="hi">'+bills.length+'</span> bill'+(bills.length !== 1 ? 's' : '')+'</span>'+
      '<span>Total <span class="hi">'+fmtBig(ft)+'</span></span>'+
      (fl > 0 ? '<span>Labour <span class="warn">'+fmtBig(fl)+'</span></span>' : '')+
      (fu > 0 ? '<span>Unpaid <span class="warn">'+fmtBig(fu)+'</span></span>' : '')+
    '</div>';
  }else{
    sumEl.innerHTML = '';
  }

  var c = $('bills-list');
  if(!bills.length){
    c.innerHTML = emptyState(
      '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15h6"/>',
      q ? 'No matching bills' : 'No bills yet',
      q ? 'Try a different search' : 'Tap New Bill to create your first one'
    );
    return;
  }

  c.innerHTML = bills.map(function(b){
    var st = getStatus(b);
    var age = b.date ? Math.floor((Date.now() - new Date(b.date)) / 864e5) : null;
    var ageStr = age === null ? '' : age <= 0 ? 'Today' : age === 1 ? 'Yesterday' : age + 'd ago';
    var timeStr = fmTime(b.id);
    var when = ageStr ? (ageStr + (timeStr ? ' · ' + timeStr : '')) : timeStr;

    return '<div class="lcard '+st+'" data-id="'+esc(b.id)+'">'+
      '<div class="lcard-head">'+
        '<div>'+
          '<div class="lcard-name">'+esc(b.custName || 'Unnamed Customer')+'</div>'+
          (b.invNo ? '<div class="lcard-ref">'+esc(b.invNo)+'</div>' : '')+
          '<span class="badge '+st+'" data-act="toggle-status">'+statusLabel(st)+'</span>'+
        '</div>'+
        '<div class="lcard-amt">'+fm(b.total, b.currency||'USD')+'</div>'+
      '</div>'+
      '<div class="lcard-meta">'+
        '<span>🚗 '+esc(b.vehModel || '—')+'</span>'+
        '<span>🔖 '+esc(b.vehPlate || '—')+'</span>'+
        (when ? '<span>🕐 '+esc(when)+'</span>' : '')+
      '</div>'+
      '<div class="lcard-acts">'+
        '<button class="btn btn-ghost btn-sm" type="button" data-act="edit-bill">✏️ Edit</button>'+
        '<button class="btn btn-dark btn-sm" type="button" data-act="print-bill">🖨️ Print</button>'+
        '<button class="btn btn-wa btn-sm" type="button" data-act="wa-bill">💬 Send</button>'+
        '<button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="dupe-bill" aria-label="Duplicate">⧉</button>'+
        '<button class="btn btn-danger-ghost btn-sm btn-icon" type="button" data-act="del-bill" aria-label="Delete">✕</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

function emptyState(pathMarkup, title, sub){
  return '<div class="empty">'+
    '<svg width="70" height="70" viewBox="0 0 24 24" fill="none" stroke="#c1272d" stroke-width=".9">'+pathMarkup+'</svg>'+
    '<div class="empty-t">'+esc(title)+'</div>'+
    '<div class="empty-s">'+esc(sub)+'</div>'+
  '</div>';
}

/* ══════════════════════════ BACKUP / RESTORE ══════════════════════════ */

function download(filename, text){
  var blob = new Blob([text], { type:'application/json' });
  var url  = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

function exportBills(){
  var bills = gb();
  if(!bills.length){ toast('No bills to back up','info'); return; }
  download('fixdrive_backup_' + todayISO() + '.json', JSON.stringify(bills, null, 2));
  toast('Backed up ' + bills.length + ' bills','ok');
}

function exportExpenses(){
  var e = ge();
  if(!e.length){ toast('No expenses to export','info'); return; }
  download('fixdrive_expenses_' + todayISO() + '.json', JSON.stringify(e, null, 2));
  toast('Exported ' + e.length + ' expenses','ok');
}

function handleImport(file){
  var r = new FileReader();
  r.onload = function(ev){
    var data;
    try{
      data = JSON.parse(ev.target.result);
      if(!Array.isArray(data)) throw new Error('not an array');
    }catch(err){
      toast('That file is not a valid backup','err');
      return;
    }
    confirmSheet({
      icon:'⚠️', title:'Replace all bills?',
      msg:'This backup holds ' + data.length + ' bill' + (data.length !== 1 ? 's' : '') +
          '. Restoring replaces the ' + gb().length + ' bill' + (gb().length !== 1 ? 's' : '') +
          ' currently on this phone.',
      confirmText:'Restore', danger:true,
      onConfirm: function(){
        if(!sb(data)) return;
        _editingId = null;
        refreshAll();
        toast('Restored ' + data.length + ' bills','ok');
      }
    });
  };
  r.readAsText(file);
}

/* ══════════════════════════ EXPENSES ══════════════════════════ */

var _expFilterCat = '';

function saveExpense(){
  var cat = val('exp-cat');
  var amt = parseFloat(val('exp-amt')) || 0;
  if(!cat){ toast('Pick a category','err'); return; }
  if(!amt){ toast('Enter an amount','err'); return; }

  var exps = ge();
  exps.unshift({
    id: Date.now(),
    date: val('exp-date') || todayISO(),
    category: cat,
    desc: val('exp-desc'),
    vendor: val('exp-vendor'),
    amount: amt,
    currency: getCurr()
  });
  if(!se(exps)) return;

  setVal('exp-amt','');
  setVal('exp-desc','');
  setVal('exp-vendor','');
  updateStats();
  renderExpenses();
  toast('Expense added ✓','ok');
}

function delExpense(id){
  confirmSheet({
    icon:'🗑️', title:'Delete this expense?', msg:'This cannot be undone.',
    confirmText:'Delete', danger:true,
    onConfirm: function(){
      se(ge().filter(function(e){ return String(e.id) !== String(id); }));
      updateStats();
      renderExpenses();
      toast('Expense deleted','info');
    }
  });
}

function renderExpenses(){
  var listEl = $('exp-list');
  if(!listEl) return;

  var exps = ge();
  var total = exps.reduce(function(s,e){ return s + cvt(e.amount, e.currency||'USD'); }, 0);
  var now = new Date();
  var month = exps.filter(function(e){
    var d = new Date(e.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).reduce(function(s,e){ return s + cvt(e.amount, e.currency||'USD'); }, 0);

  var revenue = gb().reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
  var profit = revenue - total;

  $('e-cnt').textContent   = exps.length;
  $('e-total').textContent = fmtBig(total);
  $('e-month').textContent = fmtBig(month);

  var pEl = $('e-profit'), pCard = $('e-profit-card'), pLbl = $('e-profit-lbl');
  pEl.textContent = fmtBig(Math.abs(profit));
  pCard.className = 'stat-box ' + (profit >= 0 ? 'green' : 'amber');
  pLbl.textContent = profit >= 0 ? 'Net Profit' : 'Net Loss';

  var shown = _expFilterCat
    ? exps.filter(function(e){ return e.category === _expFilterCat; })
    : exps;

  var sumEl = $('exp-sum');
  if(shown.length){
    var st = shown.reduce(function(s,e){ return s + cvt(e.amount, e.currency||'USD'); }, 0);
    sumEl.innerHTML = '<div class="summary-bar">'+
      '<span><span class="hi">'+shown.length+'</span> shown</span>'+
      '<span>Total <span class="hi">'+fmtBig(st)+'</span></span>'+
    '</div>';
  }else{
    sumEl.innerHTML = '';
  }

  if(!shown.length){
    listEl.innerHTML = emptyState(
      '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
      _expFilterCat ? 'Nothing in this category' : 'No expenses yet',
      _expFilterCat ? 'Tap "All" to see everything' : 'Add your first expense above'
    );
    return;
  }

  listEl.innerHTML = shown.map(function(e){
    var icon  = EXP_ICONS[e.category]  || '📋';
    var color = EXP_COLORS[e.category] || '#64748b';
    return '<div class="lcard" data-id="'+esc(e.id)+'" style="padding-left:18px">'+
      '<span style="position:absolute;left:0;top:0;bottom:0;width:5px;background:'+color+'"></span>'+
      '<div class="lcard-flex">'+
        '<div class="lcard-ico" style="background:'+color+'1a">'+icon+'</div>'+
        '<div>'+
          '<div class="lcard-head" style="margin-bottom:4px">'+
            '<div class="lcard-name">'+esc(e.category)+'</div>'+
            '<div class="lcard-amt red">'+fm(e.amount, e.currency||'USD')+'</div>'+
          '</div>'+
          '<div class="lcard-meta" style="margin-bottom:10px">'+
            (e.desc   ? '<span>'+esc(e.desc)+'</span>' : '')+
            (e.vendor ? '<span>🏪 '+esc(e.vendor)+'</span>' : '')+
            (e.date   ? '<span>📅 '+fd(e.date)+'</span>' : '')+
          '</div>'+
          '<div class="lcard-acts end">'+
            '<button class="btn btn-danger-ghost btn-sm" type="button" data-act="del-exp">✕ Delete</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══════════════════════════ HISTORY ══════════════════════════

   Customers and vehicles are derived from saved bills — there is no separate
   store. (These functions were lost inside the <style> block of the previous
   single-file build, which is why the History tab rendered nothing.)
   ============================================================================ */

var _histView = 'customers';

function switchHistView(v){
  _histView = v;
  $$('#hist-segment button').forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-view') === v);
  });
  setVal('hist-srch','');
  syncClearButtons();
  renderHistory();
}

function renderHistory(){
  if(!$('hist-list')) return;
  if(_histView === 'customers') renderCustomers();
  else renderVehicles();
}

/* Jump to Saved Bills pre-filtered to this customer or plate. */
function viewBillsFor(term){
  setVal('srch', term);
  syncClearButtons();
  goTab('saved');
}

function renderCustomers(){
  var q = (val('hist-srch') || '').toLowerCase();
  var bills = gb();

  var map = {};
  bills.forEach(function(b){
    var key = String(b.custName || 'Unknown').trim() || 'Unknown';
    var lk = key.toLowerCase();
    if(!map[lk]) map[lk] = { name:key, phone:'', addr:'', bills:[], total:0, lastDate:'' };
    var m = map[lk];
    m.bills.push(b);
    m.total += cvt(b.total || 0, b.currency || 'USD');
    if(!m.lastDate || String(b.date) > m.lastDate){
      m.lastDate = b.date || '';
      if(b.custPhone) m.phone = b.custPhone;
      if(b.custAddr)  m.addr  = b.custAddr;
    }
  });

  var list = Object.keys(map).map(function(k){ return map[k]; });
  if(q){
    list = list.filter(function(x){
      return x.name.toLowerCase().indexOf(q) > -1 ||
             String(x.phone).toLowerCase().indexOf(q) > -1;
    });
  }
  list.sort(function(a,b){ return String(b.lastDate).localeCompare(String(a.lastDate)); });

  $('hist-stats-bar').innerHTML = list.length
    ? '<div class="summary-bar">'+
        '<span><span class="hi">'+list.length+'</span> customer'+(list.length !== 1 ? 's' : '')+'</span>'+
        '<span>Avg <span class="hi">'+(bills.length/(list.length||1)).toFixed(1)+'</span> visits each</span>'+
      '</div>'
    : '';

  var el = $('hist-list');
  if(!list.length){
    el.innerHTML = emptyState(
      '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
      q ? 'No matching customers' : 'No customer history yet',
      q ? 'Try a different name or phone' : 'Save bills to build your customer list'
    );
    return;
  }

  el.innerHTML = list.map(function(x){
    var unpaid = x.bills.filter(function(b){ return getStatus(b) !== 'paid'; }).length;
    return '<div class="lcard" data-term="'+esc(x.name)+'">'+
      '<div class="lcard-flex">'+
        '<div class="lcard-ico">👤</div>'+
        '<div>'+
          '<div class="lcard-head" style="margin-bottom:4px">'+
            '<div class="lcard-name">'+esc(x.name)+'</div>'+
            '<div class="lcard-amt">'+fmtBig(x.total)+'</div>'+
          '</div>'+
          (x.phone ? '<div class="lcard-desc">📞 '+esc(x.phone)+'</div>' : '')+
          '<div class="lcard-meta">'+
            '<span><span class="hi">'+x.bills.length+'</span> visit'+(x.bills.length !== 1 ? 's' : '')+'</span>'+
            '<span>Last <span class="hi">'+(x.lastDate ? fd(x.lastDate) : '—')+'</span></span>'+
            (unpaid > 0 ? '<span style="color:var(--amb);font-weight:800">'+unpaid+' unpaid</span>' : '')+
          '</div>'+
          '<div class="lcard-acts">'+
            '<button class="btn btn-ghost btn-sm" type="button" data-act="view-bills">View Bills →</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

function renderVehicles(){
  var q = (val('hist-srch') || '').toLowerCase();
  var bills = gb();

  var map = {};
  bills.forEach(function(b){
    var plate = String(b.vehPlate || '').trim() || 'No Plate';
    var lk = plate.toLowerCase();
    if(!map[lk]) map[lk] = { plate:plate, model:'', custName:'', bills:[], total:0, lastDate:'', lastKm:'' };
    var m = map[lk];
    m.bills.push(b);
    m.total += cvt(b.total || 0, b.currency || 'USD');
    if(!m.lastDate || String(b.date) > m.lastDate){
      m.lastDate = b.date || '';
      if(b.vehModel) m.model    = b.vehModel;
      if(b.custName) m.custName = b.custName;
      if(b.vehKm)    m.lastKm   = b.vehKm;
    }
  });

  var list = Object.keys(map).map(function(k){ return map[k]; });
  if(q){
    list = list.filter(function(x){
      return x.plate.toLowerCase().indexOf(q) > -1 ||
             String(x.model).toLowerCase().indexOf(q) > -1 ||
             String(x.custName).toLowerCase().indexOf(q) > -1;
    });
  }
  list.sort(function(a,b){ return String(b.lastDate).localeCompare(String(a.lastDate)); });

  $('hist-stats-bar').innerHTML = list.length
    ? '<div class="summary-bar">'+
        '<span><span class="hi">'+list.length+'</span> vehicle'+(list.length !== 1 ? 's' : '')+'</span>'+
        '<span>Avg <span class="hi">'+(bills.length/(list.length||1)).toFixed(1)+'</span> services each</span>'+
      '</div>'
    : '';

  var el = $('hist-list');
  if(!list.length){
    el.innerHTML = emptyState(
      '<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h13l4 4v4a2 2 0 01-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
      q ? 'No matching vehicles' : 'No vehicle history yet',
      q ? 'Try a different plate or model' : 'Save bills with vehicle info to build history'
    );
    return;
  }

  el.innerHTML = list.map(function(x){
    return '<div class="lcard" data-term="'+esc(x.plate)+'">'+
      '<div class="lcard-flex">'+
        '<div class="lcard-ico">🚗</div>'+
        '<div>'+
          '<div class="lcard-head" style="margin-bottom:4px">'+
            '<div class="lcard-name">'+esc(x.plate)+'</div>'+
            '<div class="lcard-amt">'+fmtBig(x.total)+'</div>'+
          '</div>'+
          (x.model    ? '<div class="lcard-desc">'+esc(x.model)+'</div>' : '')+
          (x.custName ? '<div class="lcard-meta" style="margin-bottom:4px"><span>Owner: <span class="hi">'+esc(x.custName)+'</span></span></div>' : '')+
          '<div class="lcard-meta">'+
            '<span><span class="hi">'+x.bills.length+'</span> service'+(x.bills.length !== 1 ? 's' : '')+'</span>'+
            '<span>Last <span class="hi">'+(x.lastDate ? fd(x.lastDate) : '—')+'</span></span>'+
            (x.lastKm ? '<span>📍 <span class="hi">'+esc(x.lastKm)+' km</span></span>' : '')+
          '</div>'+
          '<div class="lcard-acts">'+
            '<button class="btn btn-ghost btn-sm" type="button" data-act="view-bills">View Bills →</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══════════════════════════ JOB BOARD ══════════════════════════ */

function toggleAddJob(force){
  var f = $('add-job-form');
  var b = $('add-job-btn');
  var open = (typeof force === 'boolean') ? force : !f.classList.contains('open');
  f.classList.toggle('open', open);
  b.innerHTML = open
    ? '✕ Cancel'
    : '<svg width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg> Add New Job';
  if(open) $('j-cust').focus();
}

function saveJob(){
  var cust = val('j-cust');
  var job  = val('j-job');
  if(!cust){ toast('Enter the customer name','err'); return; }
  if(!job){  toast('Enter what needs doing','err'); return; }

  var jobs = gj();
  jobs.unshift({
    id: Date.now(),
    custName: cust,
    phone:    val('j-phone'),
    vehModel: val('j-model'),
    vehPlate: val('j-plate'),
    job:      job,
    notes:    val('j-notes'),
    status:  'waiting',
    created:  Date.now()
  });
  if(!sj(jobs)) return;

  ['j-cust','j-phone','j-model','j-plate','j-job','j-notes'].forEach(function(id){ setVal(id,''); });
  toggleAddJob(false);
  renderJobs();
  updateStats();
  toast('Job added to the board ✓','ok');
}

function advanceJob(id){
  var jobs = gj();
  var idx = jobs.findIndex(function(j){ return String(j.id) === String(id); });
  if(idx === -1) return;
  var ni = J_CYCLE.indexOf(jobs[idx].status) + 1;
  if(ni <= 0 || ni >= J_CYCLE.length) return;
  jobs[idx].status = J_CYCLE[ni];
  if(!sj(jobs)) return;
  renderJobs();
  updateStats();
  toast('Status: ' + J_LABEL[J_CYCLE[ni]],'ok');
}

function delJob(id){
  confirmSheet({
    icon:'🗑️', title:'Remove this job?', msg:'It will be taken off the board.',
    confirmText:'Remove', danger:true,
    onConfirm: function(){
      sj(gj().filter(function(j){ return String(j.id) !== String(id); }));
      renderJobs();
      updateStats();
      toast('Job removed','info');
    }
  });
}

function jobToInvoice(id){
  var j = gj().find(function(x){ return String(x.id) === String(id); });
  if(!j) return;
  _editingId = null;
  setVal('cust-name',  j.custName);
  setVal('cust-phone', j.phone);
  setVal('veh-model',  j.vehModel);
  setVal('veh-plate',  j.vehPlate);
  setVal('cust-addr','');
  setVal('veh-km','');
  setVal('inv-notes','');
  setVal('discount','0');
  setVal('tax-pct','0');
  buildItems();
  var first = document.querySelector('#items .i-d');
  if(first && j.job) first.value = j.job;
  setVal('inv-date', todayISO());
  autodue();
  autoInvNo();
  recalc();
  goTab('new');
  toast('Bill started from this job','info');
}

function renderJobs(){
  var el = $('jobs-list');
  if(!el) return;

  var jobs = gj();
  var showCollected = $('show-collected') && $('show-collected').checked;
  var shown = showCollected ? jobs : jobs.filter(function(j){ return j.status !== 'collected'; });

  ['waiting','in_progress','done','collected'].forEach(function(s,i){
    var box = $(['j-wait','j-wip','j-done','j-coll'][i]);
    if(box) box.textContent = jobs.filter(function(j){ return j.status === s; }).length;
  });

  if(!shown.length){
    el.innerHTML = emptyState(
      '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
      showCollected ? 'No jobs yet' : 'No active jobs',
      showCollected ? 'Tap Add New Job to start' : 'All caught up. Tick "Show collected" to see finished jobs.'
    );
    return;
  }

  el.innerHTML = shown.map(function(j){
    var mins = Math.floor((Date.now() - (j.created || j.id)) / 60000);
    var age = mins < 60 ? mins + 'm ago'
            : mins < 1440 ? Math.floor(mins/60) + 'h ago'
            : Math.floor(mins/1440) + 'd ago';
    var next = J_NEXT_BTN[j.status];

    return '<div class="lcard '+j.status+'" data-id="'+esc(j.id)+'">'+
      '<div class="lcard-head">'+
        '<div>'+
          '<div class="lcard-name">'+esc(j.custName)+'</div>'+
          '<span class="badge '+j.status+'" data-act="advance-job">'+J_LABEL[j.status]+'</span>'+
        '</div>'+
      '</div>'+
      '<div class="lcard-desc" style="margin-top:8px">'+esc(j.job)+'</div>'+
      '<div class="lcard-meta">'+
        ((j.vehModel || j.vehPlate)
          ? '<span>🚗 '+esc(j.vehModel || '')+(j.vehPlate ? ' — '+esc(j.vehPlate) : '')+'</span>' : '')+
        (j.phone ? '<span>📞 '+esc(j.phone)+'</span>' : '')+
        '<span>🕐 '+age+'</span>'+
        (j.notes ? '<span>📝 '+esc(j.notes)+'</span>' : '')+
      '</div>'+
      '<div class="lcard-acts">'+
        (next ? '<button class="btn btn-red btn-sm" type="button" data-act="advance-job">'+next+'</button>' : '')+
        ((j.status === 'in_progress' || j.status === 'done')
          ? '<button class="btn btn-dark btn-sm" type="button" data-act="job-invoice">Create Bill →</button>' : '')+
        '<button class="btn btn-danger-ghost btn-sm btn-icon" type="button" data-act="del-job" aria-label="Remove">✕</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══════════════════════════ EVENT WIRING ══════════════════════════

   Lists are rendered as HTML strings, so their buttons are handled by a
   single delegated listener instead of inline onclick attributes. That keeps
   customer names (quotes, apostrophes, &) from ever breaking the markup.
   ============================================================================ */

function syncClearButtons(){
  $$('.search-clear').forEach(function(btn){
    var input = $(btn.getAttribute('data-clears'));
    btn.classList.toggle('show', !!(input && input.value));
  });
}

function wireEvents(){

  /* ── bottom nav ── */
  $('bottom-nav').addEventListener('click', function(e){
    var btn = e.target.closest('.nav-btn');
    if(btn) goTab(btn.getAttribute('data-tab'));
  });

  /* ── currency ── */
  $('curr-sel').addEventListener('change', function(){ onCurrencyChange(this.value); });

  /* ── new bill form ── */
  $('inv-date').addEventListener('change', autodue);
  $('add-item-btn').addEventListener('click', function(){
    var card = addItem();
    card.querySelector('.i-d').focus();
  });

  // Live totals: one listener on the container covers every current and
  // future line item.
  $('items').addEventListener('input', function(e){
    if(e.target.matches('.i-q, .i-p')) recalc();
  });
  $('items').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var act = btn.getAttribute('data-act');
    if(act === 'del-item')    delItem(btn);
    if(act === 'toggle-type') toggleType(btn);
  });

  $('discount').addEventListener('input', recalc);
  $('tax-pct').addEventListener('input', recalc);

  $('save-bill-btn').addEventListener('click', saveBill);
  $('sticky-save-btn').addEventListener('click', saveBill);
  $('print-bill-btn').addEventListener('click', printCurrent);
  $('wa-bill-btn').addEventListener('click', waCurrent);
  $('clear-form-btn').addEventListener('click', clearForm);

  /* ── saved bills ── */
  $('srch').addEventListener('input', function(){ syncClearButtons(); renderBills(); });
  $('bills-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var card = btn.closest('[data-id]');
    if(!card) return;
    var id = card.getAttribute('data-id');
    switch(btn.getAttribute('data-act')){
      case 'toggle-status': toggleStatus(id); break;
      case 'edit-bill':     loadBill(id);     break;
      case 'print-bill':    printSaved(id);   break;
      case 'wa-bill':       waSaved(id);      break;
      case 'dupe-bill':     dupeBill(id);     break;
      case 'del-bill':      delBill(id);      break;
    }
  });

  $('export-bills-btn').addEventListener('click', exportBills);
  $('import-bills-btn').addEventListener('click', function(){ $('file-in').click(); });
  $('file-in').addEventListener('change', function(e){
    var f = e.target.files && e.target.files[0];
    if(f) handleImport(f);
    e.target.value = '';
  });

  /* ── expenses ── */
  $('save-exp-btn').addEventListener('click', saveExpense);
  $('export-exp-btn').addEventListener('click', exportExpenses);
  $('exp-cat-pills').addEventListener('click', function(e){
    var pill = e.target.closest('.pill');
    if(!pill) return;
    _expFilterCat = pill.getAttribute('data-cat') || '';
    $$('#exp-cat-pills .pill').forEach(function(p){ p.classList.remove('on'); });
    pill.classList.add('on');
    renderExpenses();
  });
  $('exp-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act="del-exp"]');
    if(!btn) return;
    var card = btn.closest('[data-id]');
    if(card) delExpense(card.getAttribute('data-id'));
  });

  /* ── history ── */
  $('hist-segment').addEventListener('click', function(e){
    var btn = e.target.closest('button[data-view]');
    if(btn) switchHistView(btn.getAttribute('data-view'));
  });
  $('hist-srch').addEventListener('input', function(){ syncClearButtons(); renderHistory(); });
  $('hist-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act="view-bills"]');
    if(!btn) return;
    var card = btn.closest('[data-term]');
    if(card) viewBillsFor(card.getAttribute('data-term'));
  });

  /* ── jobs ── */
  $('add-job-btn').addEventListener('click', function(){ toggleAddJob(); });
  $('cancel-job-btn').addEventListener('click', function(){ toggleAddJob(false); });
  $('save-job-btn').addEventListener('click', saveJob);
  $('show-collected').addEventListener('change', renderJobs);
  $('jobs-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var card = btn.closest('[data-id]');
    if(!card) return;
    var id = card.getAttribute('data-id');
    switch(btn.getAttribute('data-act')){
      case 'advance-job': advanceJob(id);   break;
      case 'job-invoice': jobToInvoice(id); break;
      case 'del-job':     delJob(id);       break;
    }
  });

  /* ── search clear buttons ── */
  $$('.search-clear').forEach(function(btn){
    btn.addEventListener('click', function(){
      var input = $(btn.getAttribute('data-clears'));
      if(!input) return;
      input.value = '';
      syncClearButtons();
      if(input.id === 'srch') renderBills();
      else renderHistory();
    });
  });

  /* ── sheets ── */
  $('confirm-cancel').addEventListener('click', function(){ closeSheet($('confirm-sheet')); });
  $('confirm-ok').addEventListener('click', function(){
    closeSheet($('confirm-sheet'));
    var cb = _confirmCb;
    _confirmCb = null;
    if(cb) setTimeout(cb, 200);
  });
  $('wa-close-btn').addEventListener('click', function(){ closeSheet($('wa-sheet')); });
  $('wa-open-btn').addEventListener('click', function(){
    setTimeout(function(){ closeSheet($('wa-sheet')); }, 400);
  });

  // Tapping the dimmed backdrop dismisses either sheet.
  ['confirm-sheet','wa-sheet'].forEach(function(id){
    $(id).addEventListener('click', function(e){ if(e.target === this) closeSheet(this); });
  });

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    ['confirm-sheet','wa-sheet'].forEach(function(id){
      var el = $(id);
      if(el.classList.contains('open')) closeSheet(el);
    });
  });

  /* Desktop keyboard shortcuts still work when the app is used on a laptop. */
  document.addEventListener('keydown', function(e){
    var mod = e.metaKey || e.ctrlKey;
    if(!mod || !$('pane-new').classList.contains('on')) return;
    if(e.key === 's'){ e.preventDefault(); saveBill(); }
    if(e.key === 'p'){ e.preventDefault(); printCurrent(); }
  });
}

/* ══════════════════════════ PWA PLUMBING ══════════════════════════ */

function registerSW(){
  if(!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('sw.js').then(function(reg){
      // Pick up a new build as soon as one is deployed.
      reg.addEventListener('updatefound', function(){
        var sw = reg.installing;
        if(!sw) return;
        sw.addEventListener('statechange', function(){
          if(sw.state === 'installed' && navigator.serviceWorker.controller){
            toast('Update ready — close and reopen the app','info',5000);
          }
        });
      });
    }).catch(function(){
      /* file:// or an unsupported browser — the app still works, just online-only. */
    });
  });
}

function wireInstallPrompt(){
  var deferred = null;
  var bar = $('install-bar');
  var btn = $('install-btn');

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    deferred = e;
    bar.classList.add('show');
  });

  btn.addEventListener('click', function(){
    if(!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function(){
      deferred = null;
      bar.classList.remove('show');
    });
  });

  window.addEventListener('appinstalled', function(){
    bar.classList.remove('show');
    toast('Installed — open it from your home screen','ok',4000);
  });

  // iOS Safari has no beforeinstallprompt, so show the manual instructions.
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var standalone = window.navigator.standalone === true ||
                   window.matchMedia('(display-mode: standalone)').matches;
  if(isIOS && !standalone){
    bar.querySelector('.txt').textContent =
      'Add to Home Screen: tap Share, then "Add to Home Screen".';
    btn.classList.add('hidden');
    bar.classList.add('show');
  }
}

/* ══════════════════════════ INIT ══════════════════════════ */

function init(){
  // Currency select must reflect storage before anything renders.
  var c = getCurr();
  var sel = $('curr-sel');
  for(var i = 0; i < sel.options.length; i++){
    if(sel.options[i].value === c){ sel.selectedIndex = i; break; }
  }
  updateRateDisplay();

  wireEvents();

  buildItems();
  setVal('inv-date', todayISO());
  setVal('exp-date', todayISO());
  autodue();
  autoInvNo();
  recalc();

  refreshAll();
  syncClearButtons();

  // Manifest shortcuts land on #new / #jobs.
  var hash = (location.hash || '').replace('#','');
  if(TABS.indexOf(hash) > -1) goTab(hash);

  registerSW();
  wireInstallPrompt();
}

if(document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', init);
}else{
  init();
}

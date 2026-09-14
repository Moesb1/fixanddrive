/* ==========================================================================
   FIX & DRIVE — daily cash register

   Every payment taken is recorded against a method (Cash, Whish, Bank
   Transfer, Card). The Day view totals one day's takings by method, subtracts
   that day's expenses and shows the net, so the till can be squared up at
   closing time.

   Expenses themselves live in app.js — this file owns payments and the day
   summary that reads both.
   ========================================================================== */
'use strict';

var _dayDate = '';   // which day the Day view is showing (ISO). Empty = today.

function dayDate(){ return _dayDate || todayISO(); }

/* ══════════════════════════ TAKING A PAYMENT ══════════════════════════ */

/* `billId` is optional — money can come in without an invoice behind it. */
function paymentSheet(billId){
  var bill = billId ? gb().find(function(b){ return String(b.id) === String(billId); }) : null;
  var due  = bill ? paidRemaining(bill) : 0;

  var methodBtns = PAY_METHODS.map(function(m,i){
    return '<button type="button" class="method-btn'+(i === 0 ? ' on' : '')+'" data-method="'+esc(m)+'">'+
      '<span class="method-ico">'+PAY_ICONS[m]+'</span>'+esc(m)+'</button>';
  }).join('');

  formSheet({
    title: 'Record a Payment',
    icon: '💵',
    sub: bill ? (bill.custName || 'Customer') + (bill.invNo ? ' · ' + bill.invNo : '') : '',
    body:
      (bill
        ? '<div class="due-banner">Still due <strong>' + fmtV(due) + '</strong>' +
          ' <span>of ' + fm(bill.total, bill.currency || 'USD') + '</span></div>'
        : '')+
      '<div class="wa-step-num">Paid by</div>'+
      '<div class="method-grid" id="pay-methods">'+methodBtns+'</div>'+
      '<div class="fields" style="margin-top:14px">'+
        fieldText('f-pay-amt','Amount', bill ? (Math.round(due * 100) / 100) : '', '0.00','m-full','number','decimal')+
        fieldText('f-pay-date','Date', todayISO(), '', '', 'date')+
        fieldText('f-pay-note','Note','','optional')+
      '</div>',
    confirmText: 'Record Payment',
    onOpen: function(){
      $('pay-methods').addEventListener('click', function(e){
        var b = e.target.closest('.method-btn');
        if(!b) return;
        $$('#pay-methods .method-btn').forEach(function(x){ x.classList.remove('on'); });
        b.classList.add('on');
      });
    },
    onConfirm: function(){
      var amt = parseFloat(val('f-pay-amt')) || 0;
      if(amt <= 0){ toast('Enter an amount','err'); return false; }
      var sel = document.querySelector('#pay-methods .method-btn.on');
      var method = sel ? sel.getAttribute('data-method') : 'Cash';

      var list = gPay();
      list.unshift({
        id: newId(),
        date: val('f-pay-date') || todayISO(),
        method: method,
        amount: amt,
        currency: getCurr(),
        billId: billId || '',
        customerId: bill ? (bill.customerId || '') : '',
        note: val('f-pay-note'),
        created: Date.now()
      });
      if(!sPay(list)) return false;

      // A bill that is now fully covered marks itself paid.
      if(bill){
        var bills = gb();
        var b = bills.find(function(x){ return String(x.id) === String(bill.id); });
        if(b && paidRemaining(b) <= 0.009){
          b.status = 'paid';
          sb(bills);
        }
      }

      renderDay();
      renderBills();
      updateStats();
      toast(PAY_ICONS[method] + ' ' + fmtV(amt) + ' recorded','ok');
    }
  });
}

/* How much of a bill is still outstanding. */
function paidSoFar(bill){
  return gPay()
    .filter(function(p){ return String(p.billId) === String(bill.id); })
    .reduce(function(s,p){ return s + cvt(p.amount, p.currency || 'USD'); }, 0);
}

function paidRemaining(bill){
  return Math.max(0, cvt(bill.total || 0, bill.currency || 'USD') - paidSoFar(bill));
}

function delPayment(id){
  confirmSheet({
    icon:'🗑️', title:'Delete this payment?', danger:true, confirmText:'Delete',
    msg:'It will come off the day\'s takings. Any bill it was against may go back to unpaid.',
    onConfirm: function(){
      var p = byId(gPay(), id);
      sPay(gPay().filter(function(x){ return String(x.id) !== String(id); }));
      // Re-open the bill if it is no longer covered.
      if(p && p.billId){
        var bills = gb();
        var b = bills.find(function(x){ return String(x.id) === String(p.billId); });
        if(b && paidRemaining(b) > 0.009 && b.status === 'paid'){
          b.status = 'unpaid';
          sb(bills);
        }
      }
      renderDay();
      renderBills();
      updateStats();
      toast('Payment deleted','info');
    }
  });
}

/* ══════════════════════════ THE DAY VIEW ══════════════════════════ */

function shiftDay(days){
  var d = new Date(dayDate());
  d.setDate(d.getDate() + days);
  _dayDate = d.toISOString().split('T')[0];
  renderDay();
}

function renderDay(){
  var el = $('day-body');
  if(!el) return;

  var date = dayDate();
  var isToday = date === todayISO();

  var label = $('day-label');
  if(label){
    label.textContent = isToday ? 'Today · ' + fd(date) : fd(date);
  }
  var fwd = $('day-next');
  if(fwd) fwd.disabled = isToday;

  var pays = gPay().filter(function(p){ return p.date === date; });
  var exps = ge().filter(function(e){ return e.date === date; });

  var byMethod = {};
  PAY_METHODS.forEach(function(m){ byMethod[m] = 0; });
  pays.forEach(function(p){
    var m = PAY_METHODS.indexOf(p.method) > -1 ? p.method : 'Cash';
    byMethod[m] += cvt(p.amount, p.currency || 'USD');
  });

  var takings  = PAY_METHODS.reduce(function(s,m){ return s + byMethod[m]; }, 0);
  var spent    = exps.reduce(function(s,e){ return s + cvt(e.amount, e.currency || 'USD'); }, 0);
  var net      = takings - spent;

  var methodRows = PAY_METHODS.map(function(m){
    var v = byMethod[m];
    return '<div class="day-row'+(v ? '' : ' zero')+'">'+
      '<span class="day-row-l">'+PAY_ICONS[m]+' '+esc(m)+'</span>'+
      '<span class="day-row-v">'+fmtV(v)+'</span>'+
    '</div>';
  }).join('');

  var payList = pays.length
    ? pays.map(function(p){
        var bill = p.billId ? gb().find(function(b){ return String(b.id) === String(p.billId); }) : null;
        return '<div class="pay-row" data-id="'+esc(p.id)+'">'+
          '<span class="pay-ico">'+(PAY_ICONS[p.method] || '💵')+'</span>'+
          '<span class="pay-body">'+
            '<span class="pay-who">'+esc(bill ? (bill.custName || 'Customer') : (p.note || 'Payment'))+'</span>'+
            '<span class="pay-sub">'+esc(p.method)+(bill && bill.invNo ? ' · '+esc(bill.invNo) : '')+'</span>'+
          '</span>'+
          '<span class="pay-amt">'+fm(p.amount, p.currency || 'USD')+'</span>'+
          '<button class="jline-x" type="button" data-act="pay-del" aria-label="Delete">✕</button>'+
        '</div>';
      }).join('')
    : '<div class="pay-row empty-line">Nothing taken in yet on this day.</div>';

  var expList = exps.length
    ? exps.map(function(e){
        return '<div class="pay-row">'+
          '<span class="pay-ico">'+(EXP_ICONS[e.category] || '📋')+'</span>'+
          '<span class="pay-body">'+
            '<span class="pay-who">'+esc(e.category)+'</span>'+
            '<span class="pay-sub">'+esc(e.desc || e.vendor || '')+'</span>'+
          '</span>'+
          '<span class="pay-amt red">−'+fm(e.amount, e.currency || 'USD')+'</span>'+
        '</div>';
      }).join('')
    : '<div class="pay-row empty-line">No expenses on this day.</div>';

  el.innerHTML =
    '<div class="card day-card">'+
      '<div class="sect-title" style="margin-bottom:12px">Money In</div>'+
      methodRows+
      '<div class="day-row total"><span class="day-row-l">Total taken</span>'+
        '<span class="day-row-v">'+fmtV(takings)+'</span></div>'+
      '<div class="day-row"><span class="day-row-l">Expenses</span>'+
        '<span class="day-row-v red">−'+fmtV(spent)+'</span></div>'+
      '<div class="day-net '+(net >= 0 ? 'pos' : 'neg')+'">'+
        '<span>Net for the day</span><strong>'+fmtV(net)+'</strong></div>'+
    '</div>'+

    '<div class="card">'+
      '<div class="sect-title" style="margin-bottom:12px">Payments ('+pays.length+')</div>'+
      '<div id="day-pays">'+payList+'</div>'+
    '</div>'+

    '<div class="card">'+
      '<div class="sect-title" style="margin-bottom:12px">Expenses ('+exps.length+')</div>'+
      expList+
    '</div>';
}

/* ══════════════════════════ WIRING ══════════════════════════ */

function wireMoney(){
  $('day-prev').addEventListener('click', function(){ shiftDay(-1); });
  $('day-next').addEventListener('click', function(){ shiftDay(1); });
  $('day-today').addEventListener('click', function(){ _dayDate = ''; renderDay(); });
  $('add-pay-btn').addEventListener('click', function(){ paymentSheet(null); });

  $('day-body').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act="pay-del"]');
    if(!btn) return;
    var row = btn.closest('[data-id]');
    if(row) delPayment(row.getAttribute('data-id'));
  });
}

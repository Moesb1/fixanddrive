/* ==========================================================================
   FIX & DRIVE — parts inventory and suppliers

   Stock is decremented when a part is put on a job card or a bill, and
   incremented when a purchase is booked in. Nothing is ever blocked on stock:
   a part fitted before it was booked in shows a negative level, which is
   information, not an error to argue with.
   ========================================================================== */
'use strict';

var _partSearch = '';
var _partFilter = '';      // '' = all, 'low' = at or below minimum
var _supSearch  = '';

/* ══════════════════════════ PARTS ══════════════════════════ */

function partForm(p){
  p = p || {};
  var catOpts = PART_CATEGORIES.map(function(c){
    return '<option value="'+esc(c)+'"'+(p.category === c ? ' selected' : '')+'>'+esc(c)+'</option>';
  }).join('');
  var supOpts = gSup().map(function(s){
    return '<option value="'+esc(s.id)+'"'+(String(p.supplierId) === String(s.id) ? ' selected' : '')+'>'+esc(s.name)+'</option>';
  }).join('');

  return ''+
    '<div class="fields">'+
      fieldText('f-part-name','Part Name',p.name,'e.g. Oil filter — Toyota','m-full d-wide')+
      '<div class="field"><label for="f-part-cat">Category</label>'+
        '<select id="f-part-cat"><option value="">—</option>'+catOpts+'</select></div>'+
      fieldText('f-part-sku','Code / SKU',p.sku,'optional')+
      fieldText('f-part-stock','In Stock',p.stock,'0','','number','decimal')+
      fieldText('f-part-min','Alert Below',p.minStock,'e.g. 2','','number','decimal')+
      fieldText('f-part-cost','Cost Price',p.cost,'what you pay','','number','decimal')+
      fieldText('f-part-price','Sell Price',p.price,'what you charge','','number','decimal')+
      '<div class="field m-full d-full"><label for="f-part-sup">Supplier</label>'+
        '<select id="f-part-sup"><option value="">— none —</option>'+supOpts+'</select></div>'+
    '</div>';
}

function editPart(id){
  var p = id ? byId(gPart(), id) : null;
  formSheet({
    title: p ? 'Edit Part' : 'New Part',
    icon: '📦',
    body: partForm(p),
    confirmText: p ? 'Save Changes' : 'Add Part',
    onConfirm: function(){
      var name = val('f-part-name');
      if(!name){ toast('Enter a part name','err'); return false; }
      var list = gPart();
      var rec  = id ? byId(list, id) : null;
      if(!rec){
        rec = { id:newId(), created:Date.now() };
        list.unshift(rec);
      }
      rec.name       = name;
      rec.category   = val('f-part-cat');
      rec.sku        = val('f-part-sku');
      rec.stock      = parseFloat(val('f-part-stock')) || 0;
      rec.minStock   = parseFloat(val('f-part-min'))   || 0;
      rec.cost       = parseFloat(val('f-part-cost'))  || 0;
      rec.price      = parseFloat(val('f-part-price')) || 0;
      rec.supplierId = val('f-part-sup');
      if(!sPart(list)) return false;
      renderParts();
      updateStats();
      toast(id ? 'Part updated' : 'Part added ✓','ok');
    }
  });
}

function delPart(id){
  var p = byId(gPart(), id);
  if(!p) return;
  confirmSheet({
    icon:'🗑️', title:'Delete ' + p.name + '?', danger:true, confirmText:'Delete',
    msg:'It will be removed from the inventory. Bills and job cards that already used it are not changed.',
    onConfirm: function(){
      sPart(gPart().filter(function(x){ return String(x.id) !== String(id); }));
      renderParts();
      updateStats();
      toast('Part deleted','info');
    }
  });
}

/* Quick stock correction without opening the whole edit form. */
function stockSheet(id){
  var p = byId(gPart(), id);
  if(!p) return;
  formSheet({
    title: 'Stock — ' + p.name,
    icon: '📦',
    body:
      '<div class="stock-now">In stock now <strong>' + (parseFloat(p.stock) || 0) + '</strong></div>' +
      '<div class="fields">'+
        fieldText('f-stock-delta','Add (use minus to remove)','','e.g. 10 or -2','m-full','number','decimal')+
        fieldText('f-stock-set','…or set the exact count to','','leave blank to ignore','m-full','number','decimal')+
      '</div>',
    confirmText: 'Update Stock',
    onConfirm: function(){
      var setTo = val('f-stock-set');
      var delta = parseFloat(val('f-stock-delta'));
      var list = gPart();
      var rec  = byId(list, id);
      if(!rec) return;
      if(setTo !== ''){
        rec.stock = parseFloat(setTo) || 0;
      }else if(!isNaN(delta)){
        rec.stock = (parseFloat(rec.stock) || 0) + delta;
      }else{
        toast('Enter an amount','err');
        return false;
      }
      if(!sPart(list)) return false;
      renderParts();
      updateStats();
      toast(rec.name + ': ' + rec.stock + ' in stock','ok');
    }
  });
}

function renderParts(){
  var el = $('parts-list');
  if(!el) return;

  var all = gPart();
  var low = lowStock();
  var stockValue = all.reduce(function(s,p){
    return s + cvt((parseFloat(p.stock) || 0) * (parseFloat(p.cost) || 0), 'USD');
  }, 0);

  $('part-count').textContent = all.length;
  $('part-low').textContent   = low.length;
  $('part-value').textContent = fmtBig(stockValue);

  var q = _partSearch.toLowerCase();
  var list = _partFilter === 'low' ? low.slice() : all.slice();
  if(q){
    list = list.filter(function(p){
      return [p.name, p.category, p.sku].some(function(f){
        return String(f || '').toLowerCase().indexOf(q) > -1;
      });
    });
  }
  list.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });

  if(!list.length){
    el.innerHTML = emptyState(
      '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/>',
      q ? 'No matching parts' : (_partFilter === 'low' ? 'Nothing is running low' : 'No parts yet'),
      q ? 'Try a different name or code' : (_partFilter === 'low' ? 'Stock levels are all above their alert point' : 'Tap Add Part to start the inventory')
    );
    return;
  }

  el.innerHTML = list.map(function(p){
    var stock = parseFloat(p.stock) || 0;
    var min   = parseFloat(p.minStock) || 0;
    var isLow = min > 0 && stock <= min;
    var isOut = stock <= 0;
    var sup   = byId(gSup(), p.supplierId);
    var margin = (parseFloat(p.price) || 0) - (parseFloat(p.cost) || 0);

    return '<div class="lcard'+(isOut ? ' overdue' : isLow ? ' unpaid' : '')+'" data-id="'+esc(p.id)+'">'+
      '<div class="lcard-flex">'+
        '<div class="lcard-ico">📦</div>'+
        '<div>'+
          '<div class="lcard-head" style="margin-bottom:4px">'+
            '<div class="lcard-name">'+esc(p.name)+
              (isOut ? ' <span class="badge overdue">OUT OF STOCK</span>'
                     : isLow ? ' <span class="badge unpaid">LOW</span>' : '')+
            '</div>'+
            '<div class="stock-pill'+(isOut ? ' out' : isLow ? ' low' : '')+'">'+stock+'</div>'+
          '</div>'+
          '<div class="lcard-meta">'+
            (p.category ? '<span>'+esc(p.category)+'</span>' : '')+
            (p.sku ? '<span>#'+esc(p.sku)+'</span>' : '')+
            (p.price ? '<span>Sell <span class="hi">'+fm(p.price,'USD')+'</span></span>' : '')+
            (p.cost  ? '<span>Cost '+fm(p.cost,'USD')+'</span>' : '')+
            (margin > 0 ? '<span style="color:var(--grn);font-weight:700">+'+fm(margin,'USD')+'</span>' : '')+
            (min ? '<span>Alert at '+min+'</span>' : '')+
            (sup ? '<span>🏪 '+esc(sup.name)+'</span>' : '')+
          '</div>'+
          '<div class="lcard-acts">'+
            '<button class="btn btn-dark btn-sm" type="button" data-act="part-stock">Stock ±</button>'+
            '<button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="part-edit" aria-label="Edit">✏️</button>'+
            '<button class="btn btn-danger-ghost btn-sm btn-icon" type="button" data-act="part-del" aria-label="Delete">✕</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══════════════════════════ SUPPLIERS ══════════════════════════ */

function supForm(s){
  s = s || {};
  return ''+
    '<div class="fields">'+
      fieldText('f-sup-name','Supplier Name',s.name,'e.g. AutoZone Jdeideh','m-full')+
      fieldText('f-sup-phone','Phone',s.phone,'+961 ...','','tel')+
      fieldText('f-sup-supplies','Supplies',s.supplies,'e.g. filters, oils, brakes','m-full d-wide')+
      fieldText('f-sup-notes','Notes',s.notes,'Payment terms, contact person...','m-full d-full')+
    '</div>';
}

function editSupplier(id){
  var s = id ? byId(gSup(), id) : null;
  formSheet({
    title: s ? 'Edit Supplier' : 'New Supplier',
    icon: '🏪',
    body: supForm(s),
    confirmText: s ? 'Save Changes' : 'Add Supplier',
    onConfirm: function(){
      var name = val('f-sup-name');
      if(!name){ toast('Enter a supplier name','err'); return false; }
      var list = gSup();
      var rec  = id ? byId(list, id) : null;
      if(!rec){
        rec = { id:newId(), created:Date.now() };
        list.unshift(rec);
      }
      rec.name     = name;
      rec.phone    = val('f-sup-phone');
      rec.supplies = val('f-sup-supplies');
      rec.notes    = val('f-sup-notes');
      if(!sSup(list)) return false;
      renderSuppliers();
      toast(id ? 'Supplier updated' : 'Supplier added ✓','ok');
    }
  });
}

function delSupplier(id){
  var s = byId(gSup(), id);
  if(!s) return;
  var owed = supplierBalance(id);
  confirmSheet({
    icon:'🗑️', title:'Delete ' + s.name + '?', danger:true, confirmText:'Delete',
    msg: owed > 0
      ? 'There is still ' + fmtV(owed) + ' outstanding on their purchases. Deleting them does not clear it — the purchase records stay.'
      : 'Their purchase history stays on record.',
    onConfirm: function(){
      sSup(gSup().filter(function(x){ return String(x.id) !== String(id); }));
      renderSuppliers();
      toast('Supplier deleted','info');
    }
  });
}

/* ── PURCHASES — booking stock in ────────────────────────────────────────── */

function purchaseSheet(supplierId){
  var sup = byId(gSup(), supplierId);
  if(!sup) return;
  var parts = gPart().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });

  if(!parts.length){
    toast('Add some parts to the inventory first','err',4000);
    return;
  }

  var rows = parts.map(function(p){
    return '<div class="buy-row">'+
        '<div class="buy-name">'+esc(p.name)+
          '<span class="buy-stock">'+(parseFloat(p.stock)||0)+' in stock</span></div>'+
        '<input type="number" class="buy-qty" data-part="'+esc(p.id)+'" min="0" step="any" placeholder="0" inputmode="decimal">'+
        '<input type="number" class="buy-cost" data-part="'+esc(p.id)+'" min="0" step="0.01" placeholder="'+(p.cost||'cost')+'" inputmode="decimal">'+
      '</div>';
  }).join('');

  formSheet({
    title: 'Book in stock',
    icon: '🚚',
    sub: 'from ' + sup.name,
    body:
      '<div class="fields">'+
        fieldText('f-buy-date','Date', todayISO(), '', 'm-full','date')+
      '</div>'+
      '<div class="buy-head"><span>Part</span><span>Qty</span><span>Unit cost</span></div>'+
      '<div class="buy-list">'+rows+'</div>'+
      '<label class="check-pill" style="margin-top:14px">'+
        '<input type="checkbox" id="f-buy-paid"> Already paid</label>'+
      '<div class="fields" style="margin-top:12px">'+
        fieldText('f-buy-note','Note','','Invoice no, delivery ref...','m-full d-full')+
      '</div>',
    confirmText: 'Add to Stock',
    onConfirm: function(){
      var items = [], total = 0;
      $$('.buy-qty').forEach(function(qi){
        var qty = parseFloat(qi.value) || 0;
        if(qty <= 0) return;
        var pid = qi.getAttribute('data-part');
        var p = byId(gPart(), pid);
        if(!p) return;
        var ci = document.querySelector('.buy-cost[data-part="' + pid + '"]');
        var cost = parseFloat(ci && ci.value);
        if(isNaN(cost)) cost = parseFloat(p.cost) || 0;
        items.push({ partId:pid, name:p.name, qty:qty, cost:cost });
        total += qty * cost;
      });

      if(!items.length){ toast('Enter a quantity for at least one part','err'); return false; }

      var purchases = gPur();
      purchases.unshift({
        id: newId(),
        supplierId: supplierId,
        date: val('f-buy-date') || todayISO(),
        items: items,
        total: total,
        currency: getCurr(),
        paid: $('f-buy-paid').checked,
        note: val('f-buy-note'),
        created: Date.now()
      });
      if(!sPur(purchases)) return false;

      // Book the stock in, and keep each part's cost price current.
      var partList = gPart();
      items.forEach(function(it){
        var p = byId(partList, it.partId);
        if(!p) return;
        p.stock = (parseFloat(p.stock) || 0) + it.qty;
        if(it.cost) p.cost = it.cost;
        if(!p.supplierId) p.supplierId = supplierId;
      });
      sPart(partList);

      renderSuppliers();
      renderParts();
      updateStats();
      toast(items.length + ' part' + (items.length !== 1 ? 's' : '') + ' added to stock ✓','ok');
    }
  });
}

function togglePurchasePaid(purchaseId){
  var list = gPur();
  var p = byId(list, purchaseId);
  if(!p) return;
  p.paid = !p.paid;
  if(!sPur(list)) return;
  renderSuppliers();
  toast(p.paid ? 'Marked paid' : 'Marked unpaid','ok');
}

function showSupplierHistory(id){
  var s = byId(gSup(), id);
  if(!s) return;
  var ps = purchasesOf(id).slice().sort(function(a,b){
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  var body = ps.length
    ? ps.map(function(p){
        var lines = (p.items || []).map(function(i){ return i.qty + ' × ' + esc(i.name); }).join(', ');
        return '<div class="hist-row" data-purchase="'+esc(p.id)+'">'+
          '<div class="hist-row-top">'+
            '<strong>'+(p.date ? fd(p.date) : 'No date')+'</strong>'+
            '<span>'+fm(p.total, p.currency || 'USD')+'</span>'+
          '</div>'+
          '<div class="hist-row-sub">'+lines+'</div>'+
          (p.note ? '<div class="hist-row-sub">'+esc(p.note)+'</div>' : '')+
          '<button class="btn btn-sm '+(p.paid ? 'btn-ghost' : 'btn-red')+'" type="button" '+
            'data-act="purchase-paid" style="margin-top:8px">'+
            (p.paid ? '✓ Paid' : 'Mark as paid')+'</button>'+
        '</div>';
      }).join('')
    : '<div class="hist-row"><div class="hist-row-sub">No purchases recorded yet.</div></div>';

  var owed = supplierBalance(id);
  infoSheet({
    icon:'🏪',
    title: s.name,
    sub: owed > 0 ? 'Outstanding: ' + fmtV(owed) : 'Nothing outstanding',
    body: body,
    onClick: function(e){
      var btn = e.target.closest('[data-act="purchase-paid"]');
      if(!btn) return;
      var row = btn.closest('[data-purchase]');
      if(row){
        togglePurchasePaid(row.getAttribute('data-purchase'));
        closeSheet($('info-sheet'));
        setTimeout(function(){ showSupplierHistory(id); }, 230);
      }
    }
  });
}

function renderSuppliers(){
  var el = $('sup-list');
  if(!el) return;

  var all = gSup();
  var owedTotal = all.reduce(function(s,x){ return s + supplierBalance(x.id); }, 0);
  $('sup-count').textContent = all.length;
  $('sup-owed').textContent  = fmtBig(owedTotal);

  var q = _supSearch.toLowerCase();
  var list = all.slice();
  if(q){
    list = list.filter(function(s){
      return [s.name, s.phone, s.supplies].some(function(f){
        return String(f || '').toLowerCase().indexOf(q) > -1;
      });
    });
  }
  list.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });

  if(!list.length){
    el.innerHTML = emptyState(
      '<path d="M3 9l1-5h16l1 5M4 9h16v11a1 1 0 01-1 1H5a1 1 0 01-1-1V9z"/><path d="M9 13h6"/>',
      q ? 'No matching suppliers' : 'No suppliers yet',
      q ? 'Try a different name' : 'Tap Add Supplier to keep track of who you buy from'
    );
    return;
  }

  el.innerHTML = list.map(function(s){
    var owed = supplierBalance(s.id);
    var ps   = purchasesOf(s.id);
    var spent = ps.reduce(function(a,p){ return a + cvt(p.total || 0, p.currency || 'USD'); }, 0);
    var partCount = gPart().filter(function(p){ return String(p.supplierId) === String(s.id); }).length;

    return '<div class="lcard'+(owed > 0 ? ' unpaid' : '')+'" data-id="'+esc(s.id)+'">'+
      '<div class="lcard-flex">'+
        '<div class="lcard-ico">🏪</div>'+
        '<div>'+
          '<div class="lcard-head" style="margin-bottom:4px">'+
            '<div class="lcard-name">'+esc(s.name)+'</div>'+
            '<div class="lcard-amt'+(owed > 0 ? ' red' : '')+'">'+
              (owed > 0 ? fmtV(owed) : '<span style="color:var(--grn)">Clear</span>')+'</div>'+
          '</div>'+
          (s.phone ? '<div class="lcard-desc">📞 '+esc(s.phone)+'</div>' : '')+
          (s.supplies ? '<div class="lcard-desc" style="color:var(--mute);font-weight:500">'+esc(s.supplies)+'</div>' : '')+
          '<div class="lcard-meta">'+
            '<span><span class="hi">'+ps.length+'</span> purchase'+(ps.length !== 1 ? 's' : '')+'</span>'+
            '<span>Spent <span class="hi">'+fmtBig(spent)+'</span></span>'+
            (partCount ? '<span><span class="hi">'+partCount+'</span> part'+(partCount !== 1 ? 's' : '')+'</span>' : '')+
          '</div>'+
          (s.notes ? '<div class="lcard-note">'+esc(s.notes)+'</div>' : '')+
          '<div class="lcard-acts">'+
            '<button class="btn btn-red btn-sm" type="button" data-act="sup-buy">🚚 Book in Stock</button>'+
            '<button class="btn btn-ghost btn-sm" type="button" data-act="sup-hist">Purchases →</button>'+
            '<button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="sup-edit" aria-label="Edit">✏️</button>'+
            '<button class="btn btn-danger-ghost btn-sm btn-icon" type="button" data-act="sup-del" aria-label="Delete">✕</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══════════════════════════ WIRING ══════════════════════════ */

function wireShop(){
  $('add-part-btn').addEventListener('click', function(){ editPart(null); });
  $('add-sup-btn').addEventListener('click',  function(){ editSupplier(null); });

  $('part-srch').addEventListener('input', function(){
    _partSearch = this.value.trim(); syncClearButtons(); renderParts();
  });
  $('sup-srch').addEventListener('input', function(){
    _supSearch = this.value.trim(); syncClearButtons(); renderSuppliers();
  });

  $('part-filters').addEventListener('click', function(e){
    var pill = e.target.closest('.pill');
    if(!pill) return;
    _partFilter = pill.getAttribute('data-filter') || '';
    $$('#part-filters .pill').forEach(function(p){ p.classList.remove('on'); });
    pill.classList.add('on');
    renderParts();
  });

  $('parts-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var card = btn.closest('[data-id]');
    if(!card) return;
    var id = card.getAttribute('data-id');
    switch(btn.getAttribute('data-act')){
      case 'part-edit':  editPart(id);   break;
      case 'part-del':   delPart(id);    break;
      case 'part-stock': stockSheet(id); break;
    }
  });

  $('sup-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var card = btn.closest('[data-id]');
    if(!card) return;
    var id = card.getAttribute('data-id');
    switch(btn.getAttribute('data-act')){
      case 'sup-edit': editSupplier(id);        break;
      case 'sup-del':  delSupplier(id);         break;
      case 'sup-buy':  purchaseSheet(id);       break;
      case 'sup-hist': showSupplierHistory(id); break;
    }
  });
}

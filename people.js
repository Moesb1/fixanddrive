/* ==========================================================================
   FIX & DRIVE — customers and vehicles

   These used to be derived from bills on the fly. They are real records now,
   so a car can be booked in before any bill exists, and things a bill never
   carried (VIN, year, next service due, notes) have somewhere to live.
   ========================================================================== */
'use strict';

var _custSearch = '';
var _vehSearch  = '';

/* ══════════════════════════ CUSTOMERS ══════════════════════════ */

function custForm(c){
  c = c || {};
  return ''+
    '<div class="fields">'+
      fieldText('f-cust-name','Name',c.name,'Full name','m-full') +
      fieldText('f-cust-phone','Phone',c.phone,'+961 ...','','tel') +
      fieldText('f-cust-phone2','Other Phone',c.phone2,'optional','','tel') +
      fieldText('f-cust-addr','Address',c.address,'Area, street','m-full d-wide') +
      fieldText('f-cust-notes','Notes',c.notes,'Anything worth remembering','m-full d-full')+
    '</div>';
}

function editCustomer(id){
  var c = id ? byId(gCust(), id) : null;
  formSheet({
    title: c ? 'Edit Customer' : 'New Customer',
    icon:'user',
    body: custForm(c),
    confirmText: c ? 'Save Changes' : 'Add Customer',
    onConfirm: function(){
      var name = val('f-cust-name');
      if(!name){ toast('Enter a name','err'); return false; }
      var list = gCust();
      var rec  = c ? byId(list, id) : null;
      if(!rec){
        rec = { id:newId(), created:Date.now() };
        list.unshift(rec);
      }
      rec.name    = name;
      rec.phone   = val('f-cust-phone');
      rec.phone2  = val('f-cust-phone2');
      rec.address = val('f-cust-addr');
      rec.notes   = val('f-cust-notes');
      if(!sCust(list)) return false;
      renderCustomers();
      updateStats();
      toast(c ? 'Customer updated' : 'Customer added ✓','ok');
    }
  });
}

function delCustomer(id){
  var c = byId(gCust(), id);
  if(!c) return;
  var vs = vehiclesOf(id).length;
  var bs = billsOf(id).length;
  confirmSheet({
    icon:'trash', title:'Delete ' + c.name + '?', danger:true, confirmText:'Delete',
    msg:'Their ' + vs + ' vehicle' + (vs !== 1 ? 's' : '') + ' will also be removed. ' +
        (bs ? 'The ' + bs + ' bill' + (bs !== 1 ? 's' : '') + ' already saved are kept.' : ''),
    onConfirm: function(){
      sCust(gCust().filter(function(x){ return String(x.id) !== String(id); }));
      sVeh(gVeh().filter(function(v){ return String(v.customerId) !== String(id); }));
      renderCustomers();
      updateStats();
      toast('Customer deleted','info');
    }
  });
}

/* Start a bill with this customer and, if they have exactly one car, that car. */
function billForCustomer(id){
  var c = byId(gCust(), id);
  if(!c) return;
  var vs = vehiclesOf(id);
  startBillFrom({ customer:c, vehicle: vs.length === 1 ? vs[0] : null });
}

function renderCustomers(){
  var el = $('cust-list');
  if(!el) return;

  var q = _custSearch.toLowerCase();
  var list = gCust();
  if(q){
    list = list.filter(function(c){
      return [c.name, c.phone, c.phone2, c.address].some(function(f){
        return String(f || '').toLowerCase().indexOf(q) > -1;
      });
    });
  }
  list.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });

  $('cust-count').textContent = gCust().length;
  var withUnpaid = gCust().filter(function(c){
    return billsOf(c.id).some(function(b){ return getStatus(b) !== 'paid'; });
  }).length;
  $('cust-owing').textContent = withUnpaid;

  if(!list.length){
    el.innerHTML = emptyState(
      '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>',
      q ? 'No matching customers' : 'No customers yet',
      q ? 'Try a different name or phone' : 'Tap Add Customer to start the database'
    );
    return;
  }

  el.innerHTML = list.map(function(c){
    var vs = vehiclesOf(c.id);
    var bs = billsOf(c.id);
    var spent  = bs.reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
    var unpaid = bs.filter(function(b){ return getStatus(b) !== 'paid'; })
                   .reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
    var last = bs.map(function(b){ return b.date || ''; }).sort().pop();

    return '<div class="lcard" data-id="'+esc(c.id)+'">'+
      '<div class="lcard-flex">'+
        '<div class="lcard-ico">'+ic('user',18)+'</div>'+
        '<div>'+
          '<div class="lcard-head" style="margin-bottom:4px">'+
            '<div class="lcard-name">'+esc(c.name)+'</div>'+
            '<div class="lcard-amt">'+fmtBig(spent)+'</div>'+
          '</div>'+
          (c.phone ? '<div class="lcard-desc">'+ic('phone',15)+esc(c.phone)+(c.phone2 ? ' · '+esc(c.phone2) : '')+'</div>' : '')+
          '<div class="lcard-meta">'+
            '<span><span class="hi">'+vs.length+'</span> vehicle'+(vs.length !== 1 ? 's' : '')+'</span>'+
            '<span><span class="hi">'+bs.length+'</span> bill'+(bs.length !== 1 ? 's' : '')+'</span>'+
            (last ? '<span>Last <span class="hi">'+fd(last)+'</span></span>' : '')+
            (c.address ? '<span>'+ic('pin',14)+esc(c.address)+'</span>' : '')+
            (unpaid > 0 ? '<span style="color:var(--amb);font-weight:800">'+fmtBig(unpaid)+' unpaid</span>' : '')+
          '</div>'+
          (c.notes ? '<div class="lcard-note">'+esc(c.notes)+'</div>' : '')+
          '<div class="lcard-acts">'+
            '<button class="btn btn-red btn-sm" type="button" data-act="cust-bill">'+ic('plus',15)+'Bill</button>'+
            '<button class="btn btn-ghost btn-sm" type="button" data-act="cust-vehicle">'+ic('car',15)+'Add Car</button>'+
            '<button class="btn btn-ghost btn-sm" type="button" data-act="cust-cars">History'+ic('arrowR',15)+'</button>'+
            '<button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="cust-edit" aria-label="Edit">'+ic('pencil',15)+'</button>'+
            '<button class="btn btn-danger-ghost btn-sm btn-icon" type="button" data-act="cust-del" aria-label="Delete">'+ic('trash',15)+'</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══════════════════════════ VEHICLES ══════════════════════════ */

function vehForm(v, lockCustomer){
  v = v || {};
  var opts = gCust().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); })
    .map(function(c){
      return '<option value="'+esc(c.id)+'"'+(String(c.customerId||v.customerId) === String(c.id) ? ' selected' : '')+'>'+esc(c.name)+'</option>';
    }).join('');
  return ''+
    '<div class="fields">'+
      (lockCustomer ? '' :
        '<div class="field m-full d-full"><label for="f-veh-cust">Owner</label>'+
        '<select id="f-veh-cust"><option value="">— no owner —</option>'+opts+'</select></div>')+
      fieldText('f-veh-make','Make',v.make,'e.g. Toyota') +
      fieldText('f-veh-model','Model',v.model,'e.g. Corolla') +
      fieldText('f-veh-year','Year',v.year,'2020','','text','numeric') +
      fieldText('f-veh-plate','Plate',v.plate,'ABC 1234','m-full') +
      fieldText('f-veh-vin','VIN',v.vin,'Chassis number','m-full d-wide') +
      fieldText('f-veh-km','Mileage (km)',v.km,'85,000','','text','numeric') +
      fieldText('f-veh-nextdate','Next Service Due',v.nextDate,'','','date') +
      fieldText('f-veh-nextkm','Next Service at (km)',v.nextKm,'95,000','','text','numeric') +
      fieldText('f-veh-notes','Notes',v.notes,'Anything worth remembering','m-full d-full')+
    '</div>';
}

function editVehicle(id, presetCustomerId){
  var v = id ? byId(gVeh(), id) : null;
  if(!v && presetCustomerId) v = { customerId: presetCustomerId };
  var locked = !!(presetCustomerId && !id);

  formSheet({
    title: id ? 'Edit Vehicle' : 'New Vehicle',
    icon:'car',
    body: vehForm(v, locked),
    confirmText: id ? 'Save Changes' : 'Add Vehicle',
    onConfirm: function(){
      var plate = val('f-veh-plate');
      var model = val('f-veh-model');
      if(!plate && !model){ toast('Enter at least a plate or a model','err'); return false; }
      var list = gVeh();
      var rec  = id ? byId(list, id) : null;
      if(!rec){
        rec = { id:newId(), created:Date.now() };
        list.unshift(rec);
      }
      rec.customerId = locked ? presetCustomerId : val('f-veh-cust');
      rec.make     = val('f-veh-make');
      rec.model    = model;
      rec.year     = val('f-veh-year');
      rec.plate    = plate;
      rec.vin      = val('f-veh-vin');
      rec.km       = val('f-veh-km');
      rec.nextDate = val('f-veh-nextdate');
      rec.nextKm   = val('f-veh-nextkm');
      rec.notes    = val('f-veh-notes');
      if(!sVeh(list)) return false;
      renderVehicles();
      renderCustomers();
      updateStats();
      toast(id ? 'Vehicle updated' : 'Vehicle added ✓','ok');
    }
  });
}

function delVehicle(id){
  var v = byId(gVeh(), id);
  if(!v) return;
  confirmSheet({
    icon:'trash', title:'Delete this vehicle?', danger:true, confirmText:'Delete',
    msg: vehicleLabel(v) + (v.plate ? ' (' + v.plate + ')' : '') + ' will be removed. Bills already saved are kept.',
    onConfirm: function(){
      sVeh(gVeh().filter(function(x){ return String(x.id) !== String(id); }));
      renderVehicles();
      updateStats();
      toast('Vehicle deleted','info');
    }
  });
}

function billForVehicle(id){
  var v = byId(gVeh(), id);
  if(!v) return;
  startBillFrom({ customer: byId(gCust(), v.customerId), vehicle: v });
}

/* How overdue a service is, for the badge on the vehicle row. */
function serviceDue(v){
  var out = { due:false, soon:false, text:'' };
  if(v.nextDate){
    var days = Math.round((new Date(v.nextDate) - new Date(new Date().toDateString())) / 864e5);
    if(days <= 0){ out.due = true;  out.text = 'Service due'; return out; }
    if(days <= 30){ out.soon = true; out.text = 'Service in ' + days + 'd'; return out; }
  }
  var nk = parseFloat(String(v.nextKm || '').replace(/[^\d.]/g,''));
  var ck = parseFloat(String(v.km || '').replace(/[^\d.]/g,''));
  if(nk && ck){
    if(ck >= nk){ out.due = true; out.text = 'Service due'; return out; }
    if(nk - ck <= 1000){ out.soon = true; out.text = Math.round(nk - ck) + ' km to service'; }
  }
  return out;
}

function renderVehicles(){
  var el = $('veh-list');
  if(!el) return;

  var q = _vehSearch.toLowerCase();
  var list = gVeh();
  if(q){
    list = list.filter(function(v){
      var owner = customerName(v.customerId);
      return [v.plate, v.make, v.model, v.year, v.vin, owner].some(function(f){
        return String(f || '').toLowerCase().indexOf(q) > -1;
      });
    });
  }
  list.sort(function(a,b){ return (b.created || 0) - (a.created || 0); });

  $('veh-count').textContent = gVeh().length;
  $('veh-due').textContent = gVeh().filter(function(v){ return serviceDue(v).due; }).length;

  if(!list.length){
    el.innerHTML = emptyState(
      '<path d="M5 17H3a2 2 0 01-2-2V9a2 2 0 012-2h13l4 4v4a2 2 0 01-2 2h-1"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
      q ? 'No matching vehicles' : 'No vehicles yet',
      q ? 'Try a different plate, model or owner' : 'Tap Add Vehicle, or add one from a customer'
    );
    return;
  }

  el.innerHTML = list.map(function(v){
    var owner = customerName(v.customerId);
    var bs = billsOfVehicle(v.id);
    var spent = bs.reduce(function(s,b){ return s + cvt(b.total||0, b.currency||'USD'); }, 0);
    var last  = bs.map(function(b){ return b.date || ''; }).sort().pop();
    var due   = serviceDue(v);

    return '<div class="lcard'+(due.due ? ' overdue' : '')+'" data-id="'+esc(v.id)+'">'+
      '<div class="lcard-flex">'+
        '<div class="lcard-ico">'+ic('car',18)+'</div>'+
        '<div>'+
          '<div class="lcard-head" style="margin-bottom:4px">'+
            '<div class="lcard-name">'+esc(vehicleLabel(v))+
              (v.plate ? ' <span class="plate">'+esc(v.plate)+'</span>' : '')+
              (due.text ? ' <span class="badge '+(due.due ? 'overdue' : 'unpaid')+'" data-act="none">'+esc(due.text)+'</span>' : '')+
            '</div>'+
            '<div class="lcard-amt">'+fmtBig(spent)+'</div>'+
          '</div>'+
          (owner ? '<div class="lcard-desc">'+ic('user',15)+esc(owner)+'</div>' : '<div class="lcard-desc" style="color:var(--mute)">No owner set</div>')+
          '<div class="lcard-meta">'+
            (v.km  ? '<span>'+ic('gauge',14)+'<span class="hi">'+esc(v.km)+' km</span></span>' : '')+
            (v.vin ? '<span>VIN <span class="hi">'+esc(v.vin)+'</span></span>' : '')+
            '<span><span class="hi">'+bs.length+'</span> repair'+(bs.length !== 1 ? 's' : '')+'</span>'+
            (last ? '<span>Last <span class="hi">'+fd(last)+'</span></span>' : '')+
            (v.nextDate ? '<span>'+ic('calendar',14)+'Next <span class="hi">'+fd(v.nextDate)+'</span></span>' : '')+
          '</div>'+
          (v.notes ? '<div class="lcard-note">'+esc(v.notes)+'</div>' : '')+
          '<div class="lcard-acts">'+
            '<button class="btn btn-red btn-sm" type="button" data-act="veh-bill">'+ic('plus',15)+'Bill</button>'+
            '<button class="btn btn-ghost btn-sm" type="button" data-act="veh-history">Repair History'+ic('arrowR',15)+'</button>'+
            '<button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="veh-edit" aria-label="Edit">'+ic('pencil',15)+'</button>'+
            '<button class="btn btn-danger-ghost btn-sm btn-icon" type="button" data-act="veh-del" aria-label="Delete">'+ic('trash',15)+'</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ── Repair history, shown as a read-only sheet ── */

function showVehicleHistory(id){
  var v = byId(gVeh(), id);
  if(!v) return;
  var bs = billsOfVehicle(id).slice().sort(function(a,b){
    return String(b.date || '').localeCompare(String(a.date || ''));
  });
  var js = jobsOfVehicle(id);

  var body = '';
  if(v.nextDate || v.nextKm){
    body += '<div class="wa-step"><div class="wa-step-num">Next service</div>'+
      '<div style="font-size:16px;font-weight:700">'+
      (v.nextDate ? fd(v.nextDate) : '') +
      (v.nextDate && v.nextKm ? ' · ' : '') +
      (v.nextKm ? 'at ' + esc(v.nextKm) + ' km' : '') + '</div></div>';
  }

  if(!bs.length && !js.length){
    body += '<div class="empty" style="padding:30px 10px"><div class="empty-t">No repairs recorded</div>'+
            '<div class="empty-s">Bills and job cards for this car will show up here.</div></div>';
  }else{
    body += js.filter(function(j){ return j.status !== 'collected'; }).map(function(j){
      return '<div class="hist-row"><div class="hist-row-top">'+
        '<strong>'+esc(j.problem || 'Job')+'</strong>'+
        '<span class="badge '+j.status+'">'+J_LABEL[j.status]+'</span></div>'+
        '<div class="hist-row-sub">On the board now'+(j.mechanic ? ' · '+esc(j.mechanic) : '')+'</div></div>';
    }).join('');

    body += bs.map(function(b){
      var lines = (b.items || []).filter(function(i){ return i.desc; })
                   .map(function(i){ return esc(i.desc); }).join(', ');
      return '<div class="hist-row"><div class="hist-row-top">'+
          '<strong>'+(b.date ? fd(b.date) : 'No date')+'</strong>'+
          '<span>'+fm(b.total, b.currency || 'USD')+'</span>'+
        '</div>'+
        '<div class="hist-row-sub">'+(lines || 'No line items')+'</div>'+
        (b.vehKm ? '<div class="hist-row-sub">At '+esc(b.vehKm)+' km</div>' : '')+
      '</div>';
    }).join('');
  }

  infoSheet({
    icon:'wrench',
    title: vehicleLabel(v) + (v.plate ? ' · ' + v.plate : ''),
    sub: customerName(v.customerId) || 'No owner set',
    body: body
  });
}

function showCustomerCars(id){
  var c = byId(gCust(), id);
  if(!c) return;
  var vs = vehiclesOf(id);
  var bs = billsOf(id).slice().sort(function(a,b){
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  var body = '';
  body += '<div class="wa-step-num">Vehicles</div>';
  body += vs.length
    ? vs.map(function(v){
        return '<div class="hist-row"><div class="hist-row-top">'+
          '<strong>'+esc(vehicleLabel(v))+'</strong>'+
          (v.plate ? '<span class="plate">'+esc(v.plate)+'</span>' : '')+'</div>'+
          '<div class="hist-row-sub">'+(v.km ? esc(v.km)+' km' : 'No mileage recorded')+
          (v.vin ? ' · VIN '+esc(v.vin) : '')+'</div></div>';
      }).join('')
    : '<div class="hist-row"><div class="hist-row-sub">No vehicles on file.</div></div>';

  body += '<div class="wa-step-num" style="margin-top:18px">Bills</div>';
  body += bs.length
    ? bs.map(function(b){
        var st = getStatus(b);
        return '<div class="hist-row"><div class="hist-row-top">'+
          '<strong>'+(b.invNo ? esc(b.invNo) : 'Bill')+'</strong>'+
          '<span>'+fm(b.total, b.currency || 'USD')+'</span></div>'+
          '<div class="hist-row-sub">'+(b.date ? fd(b.date) : '')+
          ' · <span style="color:'+(st === 'paid' ? 'var(--grn)' : 'var(--amb)')+';font-weight:700">'+
          statusLabel(st)+'</span></div></div>';
      }).join('')
    : '<div class="hist-row"><div class="hist-row-sub">No bills yet.</div></div>';

  infoSheet({ icon:'user', title:c.name, sub:c.phone || '', body:body });
}

/* ══════════════════════════ WIRING ══════════════════════════ */

function wirePeople(){
  $('add-cust-btn').addEventListener('click', function(){ editCustomer(null); });
  $('add-veh-btn').addEventListener('click',  function(){ editVehicle(null); });

  $('cust-srch').addEventListener('input', function(){
    _custSearch = this.value.trim();
    syncClearButtons();
    renderCustomers();
  });
  $('veh-srch').addEventListener('input', function(){
    _vehSearch = this.value.trim();
    syncClearButtons();
    renderVehicles();
  });

  $('cust-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var card = btn.closest('[data-id]');
    if(!card) return;
    var id = card.getAttribute('data-id');
    switch(btn.getAttribute('data-act')){
      case 'cust-edit':    editCustomer(id);       break;
      case 'cust-del':     delCustomer(id);        break;
      case 'cust-bill':    billForCustomer(id);    break;
      case 'cust-vehicle': editVehicle(null, id);  break;
      case 'cust-cars':    showCustomerCars(id);   break;
    }
  });

  $('veh-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var card = btn.closest('[data-id]');
    if(!card) return;
    var id = card.getAttribute('data-id');
    switch(btn.getAttribute('data-act')){
      case 'veh-edit':    editVehicle(id);       break;
      case 'veh-del':     delVehicle(id);        break;
      case 'veh-bill':    billForVehicle(id);    break;
      case 'veh-history': showVehicleHistory(id); break;
    }
  });
}

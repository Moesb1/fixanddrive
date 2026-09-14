/* ==========================================================================
   FIX & DRIVE — digital job cards

   A job card is what a car gets when it arrives: who owns it, what they said
   is wrong, what was actually found, which parts went on, whose labour, and
   what it comes to. It moves Waiting -> In Progress -> Done -> Collected, and
   turns into an invoice in one tap.

   Putting a part on a card takes it out of inventory immediately; taking it
   off puts it back. That is the only place stock is consumed, so the numbers
   cannot drift.
   ========================================================================== */
'use strict';

var J_CYCLE = ['waiting','in_progress','done','collected'];
var J_LABEL = {
  waiting:'● Waiting', in_progress:'↻ In Progress',
  done:'✓ Done', collected:'↑ Collected'
};
var J_NEXT  = {
  waiting:'→ Start Work', in_progress:'✓ Mark Done', done:'↑ Mark Collected'
};

var _jobFilter = 'active';   // active | all | waiting | in_progress | done

/* ══════════════════════════ CREATE / EDIT ══════════════════════════ */

function jobCardForm(j){
  j = j || {};
  var custs = gCust().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  var custOpts = custs.map(function(c){
    return '<option value="'+esc(c.id)+'"'+(String(j.customerId) === String(c.id) ? ' selected' : '')+'>'+esc(c.name)+'</option>';
  }).join('');

  var mechOpts = gMech().map(function(m){
    return '<option value="'+esc(m)+'"'+(j.mechanic === m ? ' selected' : '')+'>'+esc(m)+'</option>';
  }).join('');

  return ''+
    '<div class="fields">'+
      '<div class="field m-full d-wide"><label for="f-job-cust">Customer</label>'+
        '<select id="f-job-cust"><option value="">— walk-in / not on file —</option>'+custOpts+'</select></div>'+
      '<div class="field m-full"><label for="f-job-veh">Vehicle</label>'+
        '<select id="f-job-veh"><option value="">— pick a customer first —</option></select></div>'+
    '</div>'+

    '<div class="job-manual" id="job-manual">'+
      '<div class="wa-step-num">Or type it in by hand</div>'+
      '<div class="fields">'+
        fieldText('f-job-name','Customer Name',j.custName,'Full name','m-full')+
        fieldText('f-job-phone','Phone',j.phone,'+961 ...','','tel')+
        fieldText('f-job-model','Car',j.vehModel,'e.g. Toyota Corolla 2020','m-full')+
        fieldText('f-job-plate','Plate',j.vehPlate,'ABC 1234')+
      '</div>'+
    '</div>'+

    '<div class="fields" style="margin-top:14px">'+
      fieldText('f-job-problem','Problem Reported',j.problem,'What the customer says is wrong','m-full d-full')+
      fieldText('f-job-findings','Inspection Findings',j.findings,'What you actually found','m-full d-full')+
      '<div class="field m-full"><label for="f-job-mech">Mechanic</label>'+
        '<input list="mech-list" id="f-job-mech" value="'+esc(j.mechanic || '')+'" placeholder="Who is on it" autocomplete="off">'+
        '<datalist id="mech-list">'+mechOpts+'</datalist></div>'+
      fieldText('f-job-km','Mileage now',j.km,'85,000','','text','numeric')+
      fieldText('f-job-notes','Notes',j.notes,'Keys left at desk, customer waiting...','m-full d-full')+
    '</div>';
}

/* Repopulate the vehicle dropdown whenever the customer changes. */
function syncJobVehicles(selectedVehicleId){
  var custSel = $('f-job-cust');
  var vehSel  = $('f-job-veh');
  if(!custSel || !vehSel) return;

  var cid = custSel.value;
  var manual = $('job-manual');

  if(!cid){
    vehSel.innerHTML = '<option value="">— pick a customer first —</option>';
    vehSel.disabled = true;
    if(manual) manual.classList.add('show');
    return;
  }
  vehSel.disabled = false;
  if(manual) manual.classList.remove('show');

  var vs = vehiclesOf(cid);
  vehSel.innerHTML = '<option value="">— not listed —</option>' + vs.map(function(v){
    return '<option value="'+esc(v.id)+'"'+(String(selectedVehicleId) === String(v.id) ? ' selected' : '')+'>'+
      esc(vehicleLabel(v)) + (v.plate ? ' · ' + esc(v.plate) : '') + '</option>';
  }).join('');
}

function editJob(id){
  var j = id ? byId(gj(), id) : null;

  formSheet({
    title: id ? 'Edit Job Card' : 'New Job Card',
    icon: '🔧',
    body: jobCardForm(j),
    confirmText: id ? 'Save Changes' : 'Open Job Card',
    onOpen: function(){
      $('f-job-cust').addEventListener('change', function(){ syncJobVehicles(); });
      syncJobVehicles(j && j.vehicleId);
    },
    onConfirm: function(){
      var cid = val('f-job-cust');
      var vid = val('f-job-veh');
      var cust = cid ? byId(gCust(), cid) : null;
      var veh  = vid ? byId(gVeh(),  vid) : null;

      var name    = cust ? cust.name : val('f-job-name');
      var problem = val('f-job-problem');
      if(!name){ toast('Pick a customer or type a name','err'); return false; }
      if(!problem){ toast('Describe what is wrong','err'); return false; }

      var list = gj();
      var rec  = id ? byId(list, id) : null;
      if(!rec){
        rec = {
          id:newId(), status:'waiting', parts:[], labour:[],
          created:Date.now()
        };
        list.unshift(rec);
      }
      rec.customerId = cid;
      rec.vehicleId  = vid;
      rec.custName   = name;
      rec.phone      = cust ? cust.phone : val('f-job-phone');
      rec.vehModel   = veh ? vehicleLabel(veh) : val('f-job-model');
      rec.vehPlate   = veh ? veh.plate : val('f-job-plate');
      rec.problem    = problem;
      rec.findings   = val('f-job-findings');
      rec.mechanic   = val('f-job-mech');
      rec.km         = val('f-job-km');
      rec.notes      = val('f-job-notes');
      if(!sj(list)) return false;

      rememberMechanic(rec.mechanic);

      // Keep the vehicle's mileage current from whatever was read on arrival.
      if(veh && rec.km){
        var vlist = gVeh();
        var v2 = byId(vlist, veh.id);
        if(v2){ v2.km = rec.km; sVeh(vlist); }
      }

      renderJobs();
      updateStats();
      toast(id ? 'Job card updated' : 'Job card opened ✓','ok');
    }
  });
}

function rememberMechanic(name){
  name = String(name || '').trim();
  if(!name) return;
  var list = gMech();
  if(list.indexOf(name) === -1){
    list.push(name);
    sMech(list);
  }
}

/* ══════════════════════════ PARTS & LABOUR ON A CARD ══════════════════════════ */

function addPartToJob(jobId){
  var parts = gPart().sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
  if(!parts.length){
    toast('Add some parts to the inventory first','err',4000);
    return;
  }
  var opts = parts.map(function(p){
    var stock = parseFloat(p.stock) || 0;
    return '<option value="'+esc(p.id)+'">'+esc(p.name)+' — '+stock+' in stock</option>';
  }).join('');

  formSheet({
    title:'Add a Part', icon:'📦',
    body:
      '<div class="fields">'+
        '<div class="field m-full d-full"><label for="f-jp-part">Part</label>'+
          '<select id="f-jp-part">'+opts+'</select></div>'+
        fieldText('f-jp-qty','Quantity','1','1','','number','decimal')+
        fieldText('f-jp-price','Price each','','leave blank for the sell price','','number','decimal')+
      '</div>'+
      '<div class="wa-hint">Adding it here takes it straight out of stock.</div>',
    confirmText:'Add to Job',
    onOpen: function(){
      // Prefill the price from the selected part, and keep it in step.
      var sel = $('f-jp-part'), pr = $('f-jp-price');
      function sync(){
        var p = byId(gPart(), sel.value);
        pr.placeholder = p && p.price ? String(p.price) : '0.00';
      }
      sel.addEventListener('change', sync);
      sync();
    },
    onConfirm: function(){
      var pid = val('f-jp-part');
      var qty = parseFloat(val('f-jp-qty')) || 0;
      if(qty <= 0){ toast('Enter a quantity','err'); return false; }
      var p = byId(gPart(), pid);
      if(!p) return;
      var price = val('f-jp-price') !== '' ? parseFloat(val('f-jp-price')) : (parseFloat(p.price) || 0);

      var list = gj();
      var job  = byId(list, jobId);
      if(!job) return;
      job.parts = job.parts || [];
      job.parts.push({ partId:pid, name:p.name, qty:qty, price:price });
      if(!sj(list)) return false;

      adjustStock(pid, -qty);   // out of inventory the moment it goes on the car

      renderJobs();
      renderParts();
      updateStats();
      var left = (parseFloat(byId(gPart(), pid).stock) || 0);
      toast(p.name + ' added · ' + left + ' left in stock', left < 0 ? 'err' : 'ok', 4000);
    }
  });
}

function removePartFromJob(jobId, index){
  var list = gj();
  var job  = byId(list, jobId);
  if(!job || !job.parts || !job.parts[index]) return;
  var it = job.parts[index];
  job.parts.splice(index, 1);
  if(!sj(list)) return;
  if(it.partId) adjustStock(it.partId, it.qty);   // straight back on the shelf
  renderJobs();
  renderParts();
  updateStats();
  toast(it.name + ' removed, stock returned','info');
}

function addLabourToJob(jobId){
  formSheet({
    title:'Add Labour', icon:'🔧',
    body:
      '<div class="fields">'+
        fieldText('f-jl-desc','Work done','','e.g. Brake job, front','m-full d-full')+
        fieldText('f-jl-hours','Hours','1','1','','number','decimal')+
        fieldText('f-jl-rate','Rate per hour','','e.g. 15','','number','decimal')+
      '</div>',
    confirmText:'Add to Job',
    onConfirm: function(){
      var desc  = val('f-jl-desc');
      var hours = parseFloat(val('f-jl-hours')) || 0;
      var rate  = parseFloat(val('f-jl-rate'))  || 0;
      if(!desc){ toast('Describe the work','err'); return false; }
      if(hours <= 0 || rate <= 0){ toast('Enter hours and a rate','err'); return false; }

      var list = gj();
      var job  = byId(list, jobId);
      if(!job) return;
      job.labour = job.labour || [];
      job.labour.push({ desc:desc, hours:hours, rate:rate });
      if(!sj(list)) return false;
      renderJobs();
      updateStats();
      toast('Labour added ✓','ok');
    }
  });
}

function removeLabourFromJob(jobId, index){
  var list = gj();
  var job  = byId(list, jobId);
  if(!job || !job.labour || !job.labour[index]) return;
  job.labour.splice(index, 1);
  if(!sj(list)) return;
  renderJobs();
  updateStats();
  toast('Labour line removed','info');
}

/* ══════════════════════════ STATUS ══════════════════════════ */

function advanceJob(id){
  var list = gj();
  var j = byId(list, id);
  if(!j) return;
  var ni = J_CYCLE.indexOf(j.status) + 1;
  if(ni <= 0 || ni >= J_CYCLE.length) return;

  // A car should not leave without being billed.
  if(J_CYCLE[ni] === 'collected' && !j.billId && jobTotal(j) > 0){
    confirmSheet({
      icon:'⚠️', title:'No invoice for this job', confirmText:'Collect anyway',
      msg:'This card is worth ' + fmtV(jobTotal(j)) + ' but no invoice has been made from it yet. Create the invoice first?',
      onConfirm: function(){ setJobStatus(id, 'collected'); }
    });
    return;
  }
  setJobStatus(id, J_CYCLE[ni]);
}

function setJobStatus(id, status){
  var list = gj();
  var j = byId(list, id);
  if(!j) return;
  j.status = status;
  if(!sj(list)) return;
  renderJobs();
  updateStats();
  toast('Status: ' + J_LABEL[status],'ok');
}

function delJob(id){
  var j = byId(gj(), id);
  if(!j) return;
  var n = (j.parts || []).length;
  confirmSheet({
    icon:'🗑️', title:'Remove this job card?', danger:true, confirmText:'Remove',
    msg: n
      ? 'The ' + n + ' part' + (n !== 1 ? 's' : '') + ' booked to it will go back into stock.'
      : 'It will be taken off the board.',
    onConfirm: function(){
      (j.parts || []).forEach(function(p){
        if(p.partId) adjustStock(p.partId, p.qty);
      });
      sj(gj().filter(function(x){ return String(x.id) !== String(id); }));
      renderJobs();
      renderParts();
      updateStats();
      toast('Job card removed','info');
    }
  });
}

/* ══════════════════════════ JOB → INVOICE ══════════════════════════ */

function jobToInvoice(id){
  var j = byId(gj(), id);
  if(!j) return;

  var items = [];
  (j.parts || []).forEach(function(p){
    items.push({ desc:p.name, qty:p.qty, price:p.price, type:'parts' });
  });
  (j.labour || []).forEach(function(l){
    items.push({ desc:l.desc, qty:l.hours, price:l.rate, type:'labour' });
  });
  if(!items.length && j.problem){
    items.push({ desc:j.problem, qty:'', price:'', type:'parts' });
  }

  startBillFrom({
    customer: byId(gCust(), j.customerId),
    vehicle:  byId(gVeh(),  j.vehicleId),
    fallback: { custName:j.custName, phone:j.phone, vehModel:j.vehModel, vehPlate:j.vehPlate, km:j.km },
    items:    items,
    notes:    [j.problem, j.findings].filter(Boolean).join('\n'),
    jobId:    j.id
  });
}

/* Called back by the bills module once the invoice is actually saved. */
function linkJobToBill(jobId, billId){
  var list = gj();
  var j = byId(list, jobId);
  if(!j) return;
  j.billId = billId;
  sj(list);
  renderJobs();
}

/* ══════════════════════════ RENDER ══════════════════════════ */

function jobAge(j){
  var mins = Math.floor((Date.now() - (j.created || j.id)) / 60000);
  if(mins < 60)   return mins + 'm';
  if(mins < 1440) return Math.floor(mins / 60) + 'h';
  return Math.floor(mins / 1440) + 'd';
}

function renderJobs(){
  var el = $('jobs-list');
  if(!el) return;

  var jobs = gj();
  ['waiting','in_progress','done','collected'].forEach(function(s,i){
    var box = $(['j-wait','j-wip','j-done','j-coll'][i]);
    if(box) box.textContent = jobs.filter(function(j){ return j.status === s; }).length;
  });

  var shown;
  if(_jobFilter === 'all')          shown = jobs.slice();
  else if(_jobFilter === 'active')  shown = jobs.filter(function(j){ return j.status !== 'collected'; });
  else                              shown = jobs.filter(function(j){ return j.status === _jobFilter; });

  if(!shown.length){
    el.innerHTML = emptyState(
      '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
      _jobFilter === 'active' ? 'No cars in the shop' : 'Nothing here',
      _jobFilter === 'active' ? 'Tap New Job Card when a car comes in' : 'Try a different filter'
    );
    return;
  }

  el.innerHTML = shown.map(function(j){
    var pTotal = jobPartsTotal(j);
    var lTotal = jobLabourTotal(j);
    var total  = pTotal + lTotal;
    var next   = J_NEXT[j.status];

    var partRows = (j.parts || []).map(function(p,i){
      return '<div class="jline">'+
        '<span class="jline-q">'+p.qty+'×</span>'+
        '<span class="jline-d">'+esc(p.name)+'</span>'+
        '<span class="jline-a">'+fm(p.qty * p.price,'USD')+'</span>'+
        '<button class="jline-x" type="button" data-act="job-rmpart" data-i="'+i+'" aria-label="Remove">✕</button>'+
      '</div>';
    }).join('');

    var labourRows = (j.labour || []).map(function(l,i){
      return '<div class="jline labour">'+
        '<span class="jline-q">'+l.hours+'h</span>'+
        '<span class="jline-d">'+esc(l.desc)+'</span>'+
        '<span class="jline-a">'+fm(l.hours * l.rate,'USD')+'</span>'+
        '<button class="jline-x" type="button" data-act="job-rmlabour" data-i="'+i+'" aria-label="Remove">✕</button>'+
      '</div>';
    }).join('');

    return '<div class="lcard jobcard '+j.status+'" data-id="'+esc(j.id)+'">'+

      '<div class="lcard-head">'+
        '<div>'+
          '<div class="lcard-name">'+esc(j.custName)+
            ' <span class="badge '+j.status+'" data-act="job-advance">'+J_LABEL[j.status]+'</span>'+
            (j.billId ? ' <span class="badge paid" data-act="none">✓ INVOICED</span>' : '')+
          '</div>'+
        '</div>'+
        '<div class="lcard-amt">'+(total > 0 ? fm(total,'USD') : '—')+'</div>'+
      '</div>'+

      '<div class="jmeta">'+
        ((j.vehModel || j.vehPlate)
          ? '<span>🚗 '+esc(j.vehModel || '')+(j.vehPlate ? ' · <span class="plate">'+esc(j.vehPlate)+'</span>' : '')+'</span>' : '')+
        (j.phone ? '<span>📞 '+esc(j.phone)+'</span>' : '')+
        (j.mechanic ? '<span>🔧 <span class="hi">'+esc(j.mechanic)+'</span></span>' : '')+
        (j.km ? '<span>📍 '+esc(j.km)+' km</span>' : '')+
        '<span>🕐 '+jobAge(j)+'</span>'+
      '</div>'+

      '<div class="jsec"><span class="jsec-l">Reported</span>'+esc(j.problem || '—')+'</div>'+
      (j.findings ? '<div class="jsec"><span class="jsec-l">Found</span>'+esc(j.findings)+'</div>' : '')+
      (j.notes ? '<div class="jsec"><span class="jsec-l">Notes</span>'+esc(j.notes)+'</div>' : '')+

      '<div class="jlines">'+
        (partRows || '')+
        (labourRows || '')+
        (!partRows && !labourRows
          ? '<div class="jline empty-line">Nothing added yet — add the parts and labour as you go.</div>' : '')+
      '</div>'+

      (total > 0
        ? '<div class="jtotals">'+
            (pTotal ? '<span>Parts <strong>'+fm(pTotal,'USD')+'</strong></span>' : '')+
            (lTotal ? '<span>Labour <strong>'+fm(lTotal,'USD')+'</strong></span>' : '')+
            '<span class="jtotal">Total <strong>'+fm(total,'USD')+'</strong></span>'+
          '</div>' : '')+

      '<div class="lcard-acts">'+
        '<button class="btn btn-ghost btn-sm" type="button" data-act="job-addpart">＋ Part</button>'+
        '<button class="btn btn-ghost btn-sm" type="button" data-act="job-addlabour">＋ Labour</button>'+
        (next ? '<button class="btn btn-red btn-sm" type="button" data-act="job-advance">'+next+'</button>' : '')+
        (total > 0 && !j.billId
          ? '<button class="btn btn-dark btn-sm" type="button" data-act="job-invoice">Make Invoice →</button>' : '')+
        '<button class="btn btn-ghost btn-sm btn-icon" type="button" data-act="job-edit" aria-label="Edit">✏️</button>'+
        '<button class="btn btn-danger-ghost btn-sm btn-icon" type="button" data-act="job-del" aria-label="Remove">✕</button>'+
      '</div>'+
    '</div>';
  }).join('');
}

/* ══════════════════════════ WIRING ══════════════════════════ */

function wireJobs(){
  $('add-job-btn').addEventListener('click', function(){ editJob(null); });

  $('job-filters').addEventListener('click', function(e){
    var pill = e.target.closest('.pill');
    if(!pill) return;
    _jobFilter = pill.getAttribute('data-filter') || 'active';
    $$('#job-filters .pill').forEach(function(p){ p.classList.remove('on'); });
    pill.classList.add('on');
    renderJobs();
  });

  $('jobs-list').addEventListener('click', function(e){
    var btn = e.target.closest('[data-act]');
    if(!btn) return;
    var act = btn.getAttribute('data-act');
    if(act === 'none') return;
    var card = btn.closest('[data-id]');
    if(!card) return;
    var id = card.getAttribute('data-id');
    var i  = parseInt(btn.getAttribute('data-i'), 10);

    switch(act){
      case 'job-advance':   advanceJob(id);              break;
      case 'job-edit':      editJob(id);                 break;
      case 'job-del':       delJob(id);                  break;
      case 'job-addpart':   addPartToJob(id);            break;
      case 'job-addlabour': addLabourToJob(id);          break;
      case 'job-rmpart':    removePartFromJob(id, i);    break;
      case 'job-rmlabour':  removeLabourFromJob(id, i);  break;
      case 'job-invoice':   jobToInvoice(id);            break;
    }
  });
}

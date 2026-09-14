/* ==========================================================================
   FIX & DRIVE — data layer

   Loaded before app.js. Owns every store key, the record shapes, the
   relationships between them, and the one-time migration that turns the
   original bills-only data into real customer and vehicle records.

   Everything is localStorage. No server, no sync, no ids from anywhere but
   Date.now(), which is unique enough for one garage on one device.
   ========================================================================== */
'use strict';

/* ── STORE KEYS ─────────────────────────────────────────────────────────────
   The first four are the original keys and must never change: a phone that
   already has data is keyed on them. */
var SK  = 'fixdrive_v2_bills';
var EK  = 'fixdrive_expenses';
var JK  = 'fixdrive_jobs';
var CK  = 'fixdrive_currency';

var CUK = 'fixdrive_customers';
var VEK = 'fixdrive_vehicles';
var PAK = 'fixdrive_parts';
var SUK = 'fixdrive_suppliers';
var PUK = 'fixdrive_purchases';
var PYK = 'fixdrive_payments';
var MIK = 'fixdrive_migrated';

/* ── RECORD SHAPES ──────────────────────────────────────────────────────────

   customer  {id, name, phone, phone2, address, notes, created}
   vehicle   {id, customerId, make, model, year, plate, vin, km,
              nextDate, nextKm, notes, created}
   part      {id, name, category, sku, stock, minStock, cost, price,
              supplierId, created}
   supplier  {id, name, phone, supplies, notes, created}
   purchase  {id, supplierId, date, items[{partId,name,qty,cost}],
              total, paid, note, created}
   job       {id, customerId, vehicleId, custName, phone, vehModel, vehPlate,
              problem, findings, mechanic, parts[{partId,name,qty,price}],
              labour[{desc,hours,rate}], status, notes, billId, created}
   payment   {id, date, method, amount, billId, customerId, note, created}
   bill      (unchanged, plus optional customerId / vehicleId / jobId)
   ────────────────────────────────────────────────────────────────────────── */

var PAY_METHODS = ['Cash', 'Whish', 'Bank Transfer', 'Card'];
var PAY_ICONS   = { 'Cash':'💵', 'Whish':'📲', 'Bank Transfer':'🏦', 'Card':'💳' };

var PART_CATEGORIES = [
  'Oil Filter','Air Filter','Cabin Filter','Fuel Filter',
  'Brake Pads','Brake Discs','Engine Oil','Gear Oil','Coolant',
  'Spark Plugs','Battery','Belts','Wipers','Bulbs','Tyres','Other'
];

var MECHANICS_KEY = 'fixdrive_mechanics';

/* ── GENERIC ACCESS ───────────────────────────────────────────────────────── */

function dbRead(key){
  try{
    var raw = localStorage.getItem(key);
    var v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  }catch(e){ return []; }
}

function dbWrite(key, v){
  try{
    localStorage.setItem(key, JSON.stringify(v));
    return true;
  }catch(e){
    if(typeof toast === 'function') toast('Could not save — storage is full','err',5000);
    return false;
  }
}

function newId(){ return Date.now() + Math.floor(Math.random() * 1000); }

/* Typed accessors, so call sites never repeat a key string. */
function gCust(){ return dbRead(CUK); } function sCust(v){ return dbWrite(CUK,v); }
function gVeh(){  return dbRead(VEK); } function sVeh(v){  return dbWrite(VEK,v); }
function gPart(){ return dbRead(PAK); } function sPart(v){ return dbWrite(PAK,v); }
function gSup(){  return dbRead(SUK); } function sSup(v){  return dbWrite(SUK,v); }
function gPur(){  return dbRead(PUK); } function sPur(v){  return dbWrite(PUK,v); }
function gPay(){  return dbRead(PYK); } function sPay(v){  return dbWrite(PYK,v); }
function gMech(){ return dbRead(MECHANICS_KEY); }
function sMech(v){ return dbWrite(MECHANICS_KEY,v); }

function byId(list, id){
  for(var i = 0; i < list.length; i++){
    if(String(list[i].id) === String(id)) return list[i];
  }
  return null;
}

/* ── LOOKUPS ──────────────────────────────────────────────────────────────── */

function customerName(id){
  var c = byId(gCust(), id);
  return c ? c.name : '';
}

function vehicleLabel(v){
  if(!v) return '';
  var name = [v.year, v.make, v.model].filter(Boolean).join(' ').trim();
  return name || v.plate || 'Vehicle';
}

function vehiclesOf(customerId){
  return gVeh().filter(function(v){ return String(v.customerId) === String(customerId); });
}

/* Bills and jobs recorded before the customer database existed only carry a
   name string, so match on that too when pulling a customer's history. */
function billsOf(customerId){
  var c = byId(gCust(), customerId);
  var nm = c ? String(c.name).toLowerCase().trim() : null;
  return gb().filter(function(b){
    if(b.customerId && String(b.customerId) === String(customerId)) return true;
    return nm && String(b.custName || '').toLowerCase().trim() === nm;
  });
}

function billsOfVehicle(vehicleId){
  var v = byId(gVeh(), vehicleId);
  var plate = v ? String(v.plate || '').toLowerCase().trim() : null;
  return gb().filter(function(b){
    if(b.vehicleId && String(b.vehicleId) === String(vehicleId)) return true;
    return plate && String(b.vehPlate || '').toLowerCase().trim() === plate;
  });
}

function jobsOfVehicle(vehicleId){
  return dbRead(JK).filter(function(j){ return String(j.vehicleId) === String(vehicleId); });
}

/* ── STOCK ────────────────────────────────────────────────────────────────── */

/* Adjust a part's stock by `delta` (negative consumes). Returns the new level,
   or null if the part no longer exists. Stock is allowed to go negative — a
   mechanic fitting a part he forgot to book in should not be blocked, he
   should see a negative number and correct it. */
function adjustStock(partId, delta){
  var parts = gPart();
  var p = byId(parts, partId);
  if(!p) return null;
  p.stock = (parseFloat(p.stock) || 0) + delta;
  sPart(parts);
  return p.stock;
}

function lowStock(){
  return gPart().filter(function(p){
    var min = parseFloat(p.minStock) || 0;
    return min > 0 && (parseFloat(p.stock) || 0) <= min;
  });
}

/* ── SUPPLIER BALANCE ─────────────────────────────────────────────────────── */

/* What is still owed to a supplier: the sum of unpaid purchases. Derived
   rather than stored, so it can never drift from the purchase history. */
function supplierBalance(supplierId){
  return gPur()
    .filter(function(p){ return String(p.supplierId) === String(supplierId) && !p.paid; })
    .reduce(function(s,p){ return s + cvt(p.total || 0, p.currency || 'USD'); }, 0);
}

function purchasesOf(supplierId){
  return gPur().filter(function(p){ return String(p.supplierId) === String(supplierId); });
}

/* ── JOB CARD TOTALS ──────────────────────────────────────────────────────── */

function jobPartsTotal(j){
  return (j.parts || []).reduce(function(s,p){
    return s + (parseFloat(p.qty) || 0) * (parseFloat(p.price) || 0);
  }, 0);
}

function jobLabourTotal(j){
  return (j.labour || []).reduce(function(s,l){
    return s + (parseFloat(l.hours) || 0) * (parseFloat(l.rate) || 0);
  }, 0);
}

function jobTotal(j){ return jobPartsTotal(j) + jobLabourTotal(j); }

/* ── ONE-TIME MIGRATION ───────────────────────────────────────────────────────
   The original app had no customer or vehicle records: the History tab derived
   them from bills every time it rendered. Now they are real, editable records,
   so the existing bills are rolled up once into customers and vehicles and the
   bills are back-linked. Runs once and marks itself done.
   ────────────────────────────────────────────────────────────────────────── */

function migrateIfNeeded(){
  try{
    if(localStorage.getItem(MIK)) return { ran:false };
  }catch(e){ return { ran:false }; }

  var bills = gb();
  var custs = gCust();
  var vehs  = gVeh();
  var madeC = 0, madeV = 0;

  // Only seed from bills when the new stores are still empty, so a re-run can
  // never duplicate records someone has since entered by hand.
  if(bills.length && !custs.length && !vehs.length){
    var cByName = {};
    var vByPlate = {};

    // Oldest first, so the newest bill's details win when they disagree.
    bills.slice().sort(function(a,b){
      return String(a.date || '').localeCompare(String(b.date || ''));
    }).forEach(function(b){
      var nm = String(b.custName || '').trim();
      if(!nm) return;
      var key = nm.toLowerCase();

      if(!cByName[key]){
        cByName[key] = {
          id: newId() + madeC,
          name: nm, phone: '', phone2: '', address: '', notes: '',
          created: parseInt(b.id, 10) || Date.now()
        };
        custs.push(cByName[key]);
        madeC++;
      }
      var c = cByName[key];
      if(b.custPhone) c.phone   = b.custPhone;
      if(b.custAddr)  c.address = b.custAddr;

      var plate = String(b.vehPlate || '').trim();
      if(plate){
        var pk = plate.toLowerCase();
        if(!vByPlate[pk]){
          vByPlate[pk] = {
            id: newId() + 500 + madeV,
            customerId: c.id,
            make:'', model:'', year:'', plate:plate, vin:'', km:'',
            nextDate:'', nextKm:'', notes:'',
            created: parseInt(b.id, 10) || Date.now()
          };
          vehs.push(vByPlate[pk]);
          madeV++;
        }
        var v = vByPlate[pk];
        v.customerId = c.id;
        // "Toyota Corolla 2020" -> make "Toyota", model "Corolla", year "2020"
        if(b.vehModel){
          var parts = String(b.vehModel).trim().split(/\s+/);
          var yr = '';
          if(parts.length > 1 && /^(19|20)\d{2}$/.test(parts[parts.length - 1])){
            yr = parts.pop();
          }
          v.make  = parts.shift() || '';
          v.model = parts.join(' ');
          if(yr) v.year = yr;
        }
        if(b.vehKm) v.km = b.vehKm;
      }
    });

    // Back-link the bills so history queries are exact, not name matching.
    bills.forEach(function(b){
      var c = cByName[String(b.custName || '').trim().toLowerCase()];
      var v = vByPlate[String(b.vehPlate || '').trim().toLowerCase()];
      if(c) b.customerId = c.id;
      if(v) b.vehicleId  = v.id;
    });

    sCust(custs); sVeh(vehs); sb(bills);
  }

  // Existing job-board entries predate job cards; give them the new fields so
  // nothing reads undefined.
  var jobs = dbRead(JK);
  if(jobs.length){
    var touched = false;
    jobs.forEach(function(j){
      if(!('problem' in j)){ j.problem = j.job || ''; touched = true; }
      if(!j.parts){  j.parts  = []; touched = true; }
      if(!j.labour){ j.labour = []; touched = true; }
      if(!('findings' in j)){ j.findings = ''; touched = true; }
      if(!('mechanic' in j)){ j.mechanic = ''; touched = true; }
    });
    if(touched) dbWrite(JK, jobs);
  }

  try{ localStorage.setItem(MIK, String(Date.now())); }catch(e){}
  return { ran:true, customers:madeC, vehicles:madeV };
}

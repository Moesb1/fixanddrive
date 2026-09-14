/* ==========================================================================
   FIX & DRIVE — icon set

   Emoji were doing the job of icons, which is what made the app read as a toy
   rather than a tool: they carry their own colour, their own style, and they
   render differently on every machine. These are plain stroked SVG on a 24px
   grid, inheriting currentColor, so they sit in the type like punctuation.

   Usage:  ic('car')            18px, inherits colour
           ic('car', 22)        sized
           ic('car', 18, 'muted')  with a class
   ========================================================================== */
'use strict';

var ICONS = {

  /* people + vehicles */
  user:      '<circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.5a7 7 0 0114 0"/>',
  users:     '<circle cx="9" cy="7.5" r="3.2"/><path d="M3 20.5a6.4 6.4 0 0112 0"/><path d="M16 4.6a3.2 3.2 0 010 5.9"/><path d="M17.5 14.2a6 6 0 013.5 5.4"/>',
  car:       '<path d="M19 17h2a1 1 0 001-1v-3c0-.9-.7-1.7-1.5-1.9L16 10l-2.2-2.3a2.5 2.5 0 00-1.8-.7H5.6c-.6 0-1.2.4-1.4.9l-1.4 2.9c-.1.4-.2.8-.2 1.2v4a1 1 0 001 1h1.4"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  gauge:     '<path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M13.4 10.6L19 5"/><path d="M20.7 16a9 9 0 10-17.4 0"/>',

  /* work */
  wrench:    '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>',
  clipboard: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M16 5h1.5A1.5 1.5 0 0119 6.5v13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 015 19.5v-13A1.5 1.5 0 016.5 5H8"/><path d="M9 12h6M9 16h4"/>',

  /* money */
  banknote:  '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M5.5 12h.01M18.5 12h.01"/>',
  smartphone:'<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  bank:      '<path d="M3 10h18"/><path d="M12 3L3 7.5h18L12 3z"/><path d="M6 10v7M10 10v7M14 10v7M18 10v7"/><path d="M3 21h18"/>',
  card:      '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h3"/>',
  dollar:    '<path d="M12 2v20"/><path d="M17 6.5H9.75a3.25 3.25 0 000 6.5h4.5a3.25 3.25 0 010 6.5H6"/>',
  receipt:   '<path d="M5 3.5v17l2.5-1.5 2.5 1.5 2-1.5 2 1.5 2.5-1.5L19 20.5v-17A1.5 1.5 0 0017.5 2h-11A1.5 1.5 0 005 3.5z"/><path d="M9 8h6M9 12h6"/>',

  /* stock */
  box:       '<path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
  store:     '<path d="M4 9.5V20a1 1 0 001 1h14a1 1 0 001-1V9.5"/><path d="M3 9.5h18l-1.4-5A2 2 0 0017.7 3H6.3a2 2 0 00-1.9 1.5L3 9.5z"/><path d="M9.5 21v-6h5v6"/>',
  truck:     '<path d="M14 17V6.5a1.5 1.5 0 00-1.5-1.5H2.5A1.5 1.5 0 001 6.5V17h3"/><path d="M14 9h4l3 3.5V17h-3"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/><path d="M8.5 17.5h7"/>',

  /* contact + meta */
  phone:     '<path d="M21.5 16.9v2.6a1.8 1.8 0 01-2 1.8 17.6 17.6 0 01-7.7-2.7 17.3 17.3 0 01-5.3-5.3A17.6 17.6 0 013.8 5.5a1.8 1.8 0 011.8-2h2.6a1.8 1.8 0 011.8 1.5c.1.9.3 1.7.6 2.5a1.8 1.8 0 01-.4 1.9l-1.1 1.1a14 14 0 005.3 5.3l1.1-1.1a1.8 1.8 0 011.9-.4c.8.3 1.6.5 2.5.6a1.8 1.8 0 011.6 1.9z"/>',
  pin:       '<path d="M20 10.5c0 5.6-8 12-8 12s-8-6.4-8-12a8 8 0 1116 0z"/><circle cx="12" cy="10.5" r="2.8"/>',
  clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 6.5V12l3.5 2"/>',
  calendar:  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  note:      '<path d="M12 20H5a1.5 1.5 0 01-1.5-1.5v-13A1.5 1.5 0 015 4h13a1.5 1.5 0 011.5 1.5V12"/><path d="M8 9h8M8 13h5"/><path d="M19.5 15.5l-5 5-2.5.5.5-2.5 5-5a1.4 1.4 0 012 2z"/>',
  tag:       '<path d="M20.6 13.4l-7.2 7.2a2 2 0 01-2.8 0l-7-7A2 2 0 013 12.2V5a2 2 0 012-2h7.2a2 2 0 011.4.6l7 7a2 2 0 010 2.8z"/><circle cx="7.5" cy="7.5" r="1.3"/>',

  /* actions */
  plus:      '<path d="M12 5v14M5 12h14"/>',
  x:         '<path d="M18 6L6 18M6 6l12 12"/>',
  check:     '<path d="M20 6L9 17l-5-5"/>',
  pencil:    '<path d="M11 4H4.5A1.5 1.5 0 003 5.5v14A1.5 1.5 0 004.5 21h14a1.5 1.5 0 001.5-1.5V13"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  trash:     '<path d="M3 6h18"/><path d="M8 6V4.5A1.5 1.5 0 019.5 3h5A1.5 1.5 0 0116 4.5V6"/><path d="M18.5 6l-.9 13.1a2 2 0 01-2 1.9H8.4a2 2 0 01-2-1.9L5.5 6"/><path d="M10 11v6M14 11v6"/>',
  copy:      '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4.5A1.5 1.5 0 013 13.5v-9A1.5 1.5 0 014.5 3h9A1.5 1.5 0 0115 4.5V5"/>',
  printer:   '<path d="M7 9V3h10v6"/><path d="M7 18H5a2 2 0 01-2-2v-4a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2h-2"/><rect x="7" y="15" width="10" height="6" rx="1"/>',
  search:    '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/>',
  download:  '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  upload:    '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  arrowR:    '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevL:     '<path d="M15 6l-6 6 6 6"/>',
  chevR:     '<path d="M9 6l6 6-6 6"/>',
  save:      '<path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  alert:     '<path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  play:      '<path d="M6 4l14 8-14 8V4z"/>',

  /* expense categories */
  home:      '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5"/><path d="M9.5 21v-6h5v6"/>',
  zap:       '<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/>',
  droplet:   '<path d="M12 2.7l5.7 5.7a8 8 0 11-11.4 0L12 2.7z"/>',
  shield:    '<path d="M12 21s8-4 8-10V5.5L12 2.5 4 5.5V11c0 6 8 10 8 10z"/>',
  cog:       '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-1.8-.3 1.6 1.6 0 00-1 1.5v.2a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H3a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H9a1.6 1.6 0 001-1.5V3a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V9a1.6 1.6 0 001.5 1h.2a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z"/>',
  megaphone: '<path d="M3 11v2a1 1 0 001 1h2l5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M16 8.5a4 4 0 010 7"/><path d="M19 5.5a8 8 0 010 13"/>',
  list:      '<path d="M8 6h13M8 12h13M8 18h13"/><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  fuel:      '<path d="M4 20V5a2 2 0 012-2h5a2 2 0 012 2v15"/><path d="M3 20h11"/><path d="M6 8h5"/><path d="M16 9l2-2 2.5 2.5a2 2 0 01.5 1.3V17a1.5 1.5 0 01-3 0v-4h-2"/>',

  /* brand */
  whatsapp:  null   /* filled, handled separately */
};

/* Filled marks live apart: they set their own fill and ignore the stroke. */
var FILLED = {
  whatsapp: '<path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.53.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.03 1.02-1.03 2.48s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35z"/><path d="M12 2C6.48 2 2 6.48 2 12c0 1.78.46 3.45 1.27 4.91L2 22l5.24-1.24A9.95 9.95 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18a7.96 7.96 0 01-4.07-1.12l-.3-.17-3.1.73.77-3.03-.19-.31A7.96 7.96 0 014 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>'
};

function ic(name, size, cls){
  size = size || 18;
  var cl = 'ic' + (cls ? ' ' + cls : '');
  if(FILLED[name]){
    return '<svg class="'+cl+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" '+
           'fill="currentColor" aria-hidden="true">'+FILLED[name]+'</svg>';
  }
  var d = ICONS[name];
  if(!d) return '';
  return '<svg class="'+cl+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" '+
    'fill="none" stroke="currentColor" stroke-width="1.75" '+
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
}

/* Expense categories and payment methods map onto the set above, so nothing
   in the app has to reach for an emoji to say what kind of thing it is. */
var CAT_ICON = {
  'Rent':'home', 'Utilities':'zap', 'Tools & Equipment':'wrench',
  'Parts Purchase':'box', 'Salaries':'users', 'Fuel':'fuel',
  'Insurance':'shield', 'Maintenance':'cog', 'Advertising':'megaphone',
  'Other':'list'
};

var METHOD_ICON = {
  'Cash':'banknote', 'Whish':'smartphone', 'Bank Transfer':'bank', 'Card':'card'
};

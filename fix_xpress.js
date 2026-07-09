const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/js/interlogic.js');
let code = fs.readFileSync(filePath, 'utf8');

// Fix 1: Fix malformed XPRESS entrega option in mobile form
// Wrong: value=\"XPRESS\" + (record?.entrega === 'XPRESS' ? ' selected' : '') + >XPRESS</option>
// Correct: value=\"XPRESS\"' + (record?.entrega === 'XPRESS' ? ' selected' : '') + '>XPRESS</option>
const wrongEntrega = 'XPRESS" + (record?.entrega === \'XPRESS\' ? \' selected\' : \'\') + >XPRESS';
const correctEntrega = 'XPRESS"\' + (record?.entrega === \'XPRESS\' ? \' selected\' : \'\') + \'>XPRESS';

// Fix 2: Fix malformed XPRESS cobra option in mobile form
const wrongCobra = 'XPRESS" + (record?.cobra === \'XPRESS\' ? \' selected\' : \'\') + >XPRESS';
const correctCobra = 'XPRESS"\' + (record?.cobra === \'XPRESS\' ? \' selected\' : \'\') + \'>XPRESS';

let changes = 0;

// Fix entrega XPRESS
let idx = code.indexOf(wrongEntrega);
while (idx !== -1) {
  code = code.substring(0, idx) + correctEntrega + code.substring(idx + wrongEntrega.length);
  changes++;
  console.log('Fixed entrega XPRESS at ' + idx);
  idx = code.indexOf(wrongEntrega);
}

// Fix cobra XPRESS
idx = code.indexOf(wrongCobra);
while (idx !== -1) {
  code = code.substring(0, idx) + correctCobra + code.substring(idx + wrongCobra.length);
  changes++;
  console.log('Fixed cobra XPRESS at ' + idx);
  idx = code.indexOf(wrongCobra);
}

console.log('\nTotal fixes: ' + changes);

if (changes > 0) {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('File saved!');
} else {
  console.log('No malformed XPRESS found - might already be fixed');
}

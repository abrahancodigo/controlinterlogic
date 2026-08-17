const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/js/interlogic.js');
let code = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Fix 1: toggleCellField - update cycle to include XPRESS
const oldToggle = "const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' : '';";
const idx1 = code.indexOf(oldToggle);
if (idx1 !== -1) {
  const newToggle = "const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' :\n                     current === 'INTERLOGISTIC' ? 'XPRESS' : '';";
  code = code.substring(0, idx1) + newToggle + code.substring(idx1 + oldToggle.length);
  changes++;
  console.log('✅ toggleCellField updated');
} else {
  console.log('❌ toggleCellField not found');
}

// Fix 2: Add XPRESS button to batch assign HTML
const oldButtons = '<button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                </div>';
const idx2 = code.indexOf(oldButtons);
if (idx2 !== -1) {
  const newButtons = '<button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                    <button id="ba-xpress" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        📦 XPRESS\n                    </button>\n                </div>';
  code = code.substring(0, idx2) + newButtons + code.substring(idx2 + oldButtons.length);
  changes++;
  console.log('✅ Batch button HTML added');
} else {
  console.log('❌ Batch button HTML not found');
}

// Fix 3: Remove duplicate ba-xpress onclick
const duplicate = "document.getElementById('ba-xpress').onclick = () => doAssign('XPRESS');\n        document.getElementById('ba-xpress').onclick = () => doAssign('XPRESS');";
const idx3 = code.indexOf(duplicate);
if (idx3 !== -1) {
  code = code.substring(0, idx3) + "document.getElementById('ba-xpress').onclick = () => doAssign('XPRESS');" + code.substring(idx3 + duplicate.length);
  changes++;
  console.log('✅ Duplicate onclick fixed');
} else {
  console.log('❌ Duplicate onclick not found (may already be fixed)');
}

console.log('\nTotal fixes: ' + changes);

if (changes > 0) {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('File saved!');
} else {
  console.log('NO CHANGES MADE');
}

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public/js/interlogic.js');
let code = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// Normalize to \n for searching
const normalized = code.replace(/\r\n/g, '\n');

// toggleCellField cycle - search in normalized version
const oldCycle = "        const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' : '';";
let idx = normalized.indexOf(oldCycle);
if (idx !== -1) {
  // Find the exact match in original code
  const beforeNormalized = code.substring(0, idx);
  // The \r\n's before this position add extra chars. Count them.
  const crCount = (beforeNormalized.match(/\r\n/g) || []).length;
  const actualIdx = idx + crCount; // each \r adds 1 char
  const actualLen = oldCycle.length;
  
  const newCycle = "        const next = current === '' ? 'DALSE' :\n                     current === 'DALSE' ? 'INTERLOGISTIC' :\n                     current === 'INTERLOGISTIC' ? 'XPRESS' : '';";
  const newCycleWithCR = newCycle.replace(/\n/g, '\r\n');
  
  code = code.substring(0, actualIdx) + newCycleWithCR + code.substring(actualIdx + oldCycle.length + crCount);
  changes++;
  console.log('✅ toggleCellField cycle updated');
} else {
  console.log('❌ toggleCellField cycle NOT found');
}

// Batch assign buttons - search in normalized
const oldButtons = '<button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                </div>';
idx = normalized.indexOf(oldButtons);
if (idx !== -1) {
  const crCount = (code.substring(0, idx).match(/\r\n/g) || []).length;
  const actualIdx = idx + crCount;
  
  const newButtons = '<button id="ba-interlogistic" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        🚛 INTERLOGISTIC\n                    </button>\n                    <button id="ba-xpress" class="btn btn-accent" style="flex: 1; padding: 1rem; font-size: 1.1rem; font-weight: 700;">\n                        📦 XPRESS\n                    </button>\n                </div>';
  const newButtonsWithCR = newButtons.replace(/\n/g, '\r\n');
  
  code = code.substring(0, actualIdx) + newButtonsWithCR + code.substring(actualIdx + oldButtons.length + crCount);
  changes++;
  console.log('✅ Batch XPRESS button added');
} else {
  console.log('❌ Batch buttons NOT found');
}

console.log('\nTotal changes: ' + changes);

if (changes > 0) {
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('File saved!');
} else {
  console.log('No changes made');
}

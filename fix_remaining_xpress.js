const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'public/js/interlogic.js');
let code = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF -> LF
code = code.replace(/\r\n/g, '\n');

let total = 0;

function replaceOnce(oldStr, newStr, label) {
  if (code.includes(oldStr)) {
    code = code.replace(oldStr, newStr);
    total++;
    console.log('✅ ' + label);
  } else {
    console.log('❌ ' + label + ' - pattern not found');
  }
}

// Helper: combine old and new from string parts to avoid escaping issues
function buildMobileParts() {
  // The mobile cobra section currently has:
  // INTERLOGISTIC</option></select></div>
  // We want it to become:
  // INTERLOGISTIC</option><option value="XPRESS"' + (record?.cobra === 'XPRESS' ? ' selected' : '') + '>XPRESS</option></select></div>
  
  const oldPart = "INTERLOGISTIC</option></select></div>";
  const newPart = 
    "INTERLOGISTIC</option>" +
    "<option value=\"XPRESS\"" +
    "' + (record?.cobra === 'XPRESS' ? ' selected' : '') + " +
    "'>XPRESS</option></select></div>";
  
  return { oldPart, newPart };
}

const mobile = buildMobileParts();

replaceOnce(
  mobile.oldPart,
  mobile.newPart,
  'Mobile cobra: XPRESS option'
);

// 2. Desktop entrega
replaceOnce(
  "<option value=\"INTERLOGISTIC\" ${val('entrega') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n                                    </select>",
  "<option value=\"INTERLOGISTIC\" ${val('entrega') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n                                    <option value=\"XPRESS\" ${val('entrega') === 'XPRESS' ? 'selected' : ''}>XPRESS</option>\n                                    </select>",
  'Desktop entrega: XPRESS option'
);

// 3. Desktop cobra
replaceOnce(
  "<option value=\"INTERLOGISTIC\" ${val('cobra') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n                                    </select>",
  "<option value=\"INTERLOGISTIC\" ${val('cobra') === 'INTERLOGISTIC' ? 'selected' : ''}>INTERLOGISTIC</option>\n                                    <option value=\"XPRESS\" ${val('cobra') === 'XPRESS' ? 'selected' : ''}>XPRESS</option>\n                                    </select>",
  'Desktop cobra: XPRESS option'
);

console.log('\nTotal: ' + total + ' changes');

if (total > 0) {
  code = code.replace(/\n/g, '\r\n');
  fs.writeFileSync(filePath, code, 'utf8');
  console.log('File saved!');
}

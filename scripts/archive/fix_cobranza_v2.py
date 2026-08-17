import re

with open('public/js/cobranza.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the interlogic onSnapshot block (lines 74-83 approximately)
# Convert to one-time .get() 
i = 0
while i < len(lines):
    line = lines[i].rstrip()
    
    # FIX 1: interlogic onSnapshot -> one-time get (around line 74-83)
    if "this.unsubscribeRecords = db.collection('interlogic')" in line:
        # Find the end of this onSnapshot block (look for the closing );)
        start = i - 1  # includes the 'if (this.unsubscribeRecords)' line
        end = i
        depth = 0
        for j in range(i, min(i+15, len(lines))):
            for ch in lines[j]:
                if ch == '{': depth += 1
                elif ch == '}': depth -= 1
            if depth <= 0 and j > i:
                end = j
                break
            # Also catch the error handler closing
            if '});' in lines[j] or '}, err =>' in lines[j]:
                end = j
                break
        
        # Find the actual end by looking for }, err =>
        for j in range(i+2, min(i+15, len(lines))):
            if '}, err =>' in lines[j] or '});' in lines[j]:
                end = j
                break
        
        replacement = [
            "            // Reuse Interlogic.records to avoid duplicate listener (cost optimization)\n",
            "            if (window.Interlogic && window.Interlogic.records && window.Interlogic.records.length > 0) {\n",
            "                this.records = window.Interlogic.records;\n",
            "                checkDone('records');\n",
            "            } else {\n",
            "                db.collection('interlogic').orderBy('createdAt', 'desc').limit(5000).get().then(snap => {\n",
            "                    this.records = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));\n",
            "                    checkDone('records');\n",
            "                }).catch(err => { console.error('Error loading interlogic:', err); checkDone('records'); });\n",
            "            }\n"
        ]
        lines = lines[:start] + replacement + lines[end+1:]
        print(f'FIX 1: Interlogic onSnapshot replaced with one-time get (around original line {start+1})')
        continue
    
    # FIX 2: gestiones onSnapshot -> one-time get
    if "this.unsubscribeGestiones = db.collection('gestiones')" in line:
        start = i - 1
        for j in range(i+2, min(i+12, len(lines))):
            if '}, err =>' in lines[j] or '});' in lines[j]:
                end = j
                break
        else:
            end = i + 5
        
        replacement = [
            "            // One-time fetch: gestiones only changes on explicit user action\n",
            "            db.collection('gestiones').orderBy('createdAt', 'desc').limit(500).get().then(snap => {\n",
            "                this.gestiones = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));\n",
            "                checkDone('gestiones');\n",
            "            }).catch(err => { console.error('Error loading gestiones:', err); checkDone('gestiones'); });\n"
        ]
        lines = lines[:start] + replacement + lines[end+1:]
        print(f'FIX 2: Gestiones onSnapshot replaced with one-time get')
        continue
    
    # FIX 3: ajustes onSnapshot -> one-time get
    if "this.unsubscribeAjustes = db.collection('ajustes')" in line:
        start = i - 1
        for j in range(i+2, min(i+12, len(lines))):
            if '}, err =>' in lines[j] or '});' in lines[j]:
                end = j
                break
        else:
            end = i + 5
        
        replacement = [
            "            // One-time fetch: ajustes only changes on explicit user action\n",
            "            db.collection('ajustes').orderBy('createdAt', 'desc').limit(500).get().then(snap => {\n",
            "                this.ajustes = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));\n",
            "                checkDone('ajustes');\n",
            "            }).catch(err => { console.error('Error loading ajustes:', err); checkDone('ajustes'); });\n"
        ]
        lines = lines[:start] + replacement + lines[end+1:]
        print(f'FIX 3: Ajustes onSnapshot replaced with one-time get')
        continue
    
    # FIX 4: notasCredito onSnapshot -> one-time get
    if "this.unsubscribeNC = db.collection('notasCredito')" in line:
        start = i - 1
        for j in range(i+2, min(i+12, len(lines))):
            if '}, err =>' in lines[j] or '});' in lines[j]:
                end = j
                break
        else:
            end = i + 5
        
        replacement = [
            "            // One-time fetch: notasCredito only changes on explicit user action\n",
            "            db.collection('notasCredito').orderBy('createdAt', 'desc').limit(1000).get().then(snap => {\n",
            "                this.notasCredito = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));\n",
            "                checkDone('nc');\n",
            "            }).catch(err => { console.error('Error loading notasCredito:', err); checkDone('nc'); });\n"
        ]
        lines = lines[:start] + replacement + lines[end+1:]
        print(f'FIX 4: NotasCredito onSnapshot replaced with one-time get')
        continue
    
    i += 1

with open('public/js/cobranza.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'\ncobranza.js saved. Total lines: {len(lines)}')

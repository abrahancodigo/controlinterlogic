# 🚀 Guía Rápida de Despliegue - Dalse

## ⚡ Opción Más Rápida: Crear y Desplegar

Sigue estos pasos EN ORDEN:

### 1️⃣ Crear Proyecto en Firebase Console

1. **Abre:** https://console.firebase.google.com
2. **Clic en:** "Agregar proyecto" o "Add project"
3. **Nombre:** `dalse` (puedes usar otro nombre)
4. **Continuar** → Desactiva Analytics (opcional) → **Crear proyecto**
5. **Espera** ~30 segundos a que se cree

### 2️⃣ Activar Servicios

**Authentication:**
1. Menú lateral → **Authentication** → **Comenzar**
2. **Email/Password** → Activar → **Guardar**

**Firestore:**
1. Menú lateral → **Firestore Database** → **Crear base de datos**
2. **Modo producción** → Ubicación: `us-central` → **Habilitar**

### 3️⃣ Obtener Configuración

1. **Configuración** (⚙️ arriba izquierda) → **Configuración del proyecto**
2. Baja a **"Tus apps"** → Clic en **`</>`** (ícono web)
3. Nombre: `Dalse Web` → **NO** marcar Firebase Hosting → **Registrar app**
4. **COPIA** todo el código que aparece en `firebaseConfig`

Ejemplo de lo que verás:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "dalse-xxxxx.firebaseapp.com",
  projectId: "dalse-xxxxx",
  storageBucket: "dalse-xxxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### 4️⃣ Actualizar Código

Abre el archivo: `C:\Users\user\OneDrive\Escritorio\antigravity\dalse\public\js\app.js`

Busca las líneas 26-33 y reemplaza con TU configuración:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY_AQUI",
    authDomain: "TU_AUTH_DOMAIN_AQUI",
    projectId: "TU_PROJECT_ID_AQUI",
    storageBucket: "TU_STORAGE_BUCKET_AQUI",
    messagingSenderId: "TU_MESSAGING_SENDER_ID_AQUI",
    appId: "TU_APP_ID_AQUI"
};
```

**GUARDA** el archivo.

### 5️⃣ Actualizar ID del Proyecto

Abre: `C:\Users\user\OneDrive\Escritorio\antigravity\dalse\.firebaserc`

Reemplaza `dalse-project` con el **projectId** real de tu Firebase:

```json
{
  "projects": {
    "default": "dalse-xxxxx"
  }
}
```

**GUARDA** el archivo.

### 6️⃣ Desplegar

Abre PowerShell en la carpeta del proyecto y ejecuta:

```powershell
cd C:\Users\user\OneDrive\Escritorio\antigravity\dalse
firebase deploy
```

### 7️⃣ ¡Listo! 🎉

Al terminar verás algo como:

```
✔  Deploy complete!

Hosting URL: https://dalse-xxxxx.web.app
```

**Esa es tu URL** - ábrela en el navegador.

---

## 🔐 Primer Usuario (Admin)

1. Abre la URL de tu app
2. Clic en **"Registrarse"**
3. Completa el formulario
4. ¡Eres el administrador!

---

## ❓ Problemas Comunes

### "Project not found"
→ Verifica que actualizaste `.firebaserc` con el ID correcto

### "Permission denied" en Firestore
→ Ejecuta `firebase deploy` para subir las reglas

### La app no carga
→ Verifica que actualizaste `app.js` con tu configuración de Firebase

---

## 📞 ¿Necesitas Ayuda?

Dime en qué paso estás y te ayudo específicamente.

# 📦 Dalse - Sistema de Entrega de Muebles

Sistema web de gestión de entregas de muebles con autenticación, control de roles y captura de firmas digitales.

## 🌟 Características

- **Autenticación Segura**: Sistema de login y registro con Firebase Authentication
- **Control de Roles**: Administradores y usuarios regulares con permisos diferenciados
- **Gestión de Entregas**: Registro completo de entregas con todos los detalles
- **Firmas Digitales**: Captura de firmas del cliente y entregador con soporte táctil
- **Responsive Design**: Funciona perfectamente en desktop, tablet y móvil
- **Impresión**: Genera documentos imprimibles de cada entrega
- **Offline Ready**: Funciona sin conexión gracias a Firebase offline persistence

## 📋 Campos de Registro de Entrega

Cada entrega incluye:
- Fecha de entrega
- Nombre del cliente
- Nombre de la tienda
- Tipo de mueble
- Lista de accesorios
- Firma y sello del cliente
- Nombre y firma del entregador
- Fecha de firma

## 🏗️ Estructura del Proyecto

```
dalse/
├── public/
│   ├── css/
│   │   └── styles.css          # Estilos completos del sistema
│   ├── js/
│   │   ├── app.js              # Aplicación principal
│   │   ├── auth.js             # Sistema de autenticación
│   │   ├── users.js            # Gestión de usuarios (admin)
│   │   ├── deliveries.js       # Módulo de entregas
│   │   ├── signature-pad.js    # Componente de firmas
│   │   └── utils.js            # Funciones auxiliares
│   └── index.html              # Página principal
├── firebase.json               # Configuración de Firebase
├── firestore.rules             # Reglas de seguridad
├── firestore.indexes.json      # Índices de Firestore
├── .firebaserc                 # Proyecto Firebase
├── README.md                   # Este archivo
└── DEPLOY_GUIDE.md            # Guía de despliegue

```

## 🚀 Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Backend**: Firebase (Authentication, Firestore, Hosting)
- **Firmas**: Canvas API con soporte touch
- **Diseño**: CSS moderno con variables, gradientes y animaciones

## 👥 Roles de Usuario

### Administrador
- Primer usuario registrado automáticamente es admin
- Puede ver todas las entregas
- Puede gestionar usuarios y asignar roles
- Puede activar/desactivar usuarios

### Usuario Regular
- Puede crear entregas
- Solo ve sus propias entregas
- No tiene acceso al panel de administración

## 🎨 Características de Diseño

- Paleta de colores moderna con gradientes
- Tipografía Inter para mejor legibilidad
- Animaciones suaves y micro-interacciones
- Sidebar colapsable en móvil
- Notificaciones toast elegantes
- Formularios con validación visual

## 📱 Responsive

El sistema está optimizado para:
- Desktop (1920px+)
- Laptop (1366px+)
- Tablet (768px+)
- Móvil (320px+)

## 🔒 Seguridad

- Autenticación requerida para acceder al sistema
- Reglas de Firestore para proteger datos
- Validación de roles en frontend y backend
- Usuarios pueden ser desactivados por administradores

## 📄 Licencia

Proyecto privado - Todos los derechos reservados

## 👨‍💻 Desarrollo

Para desarrollo local, ver [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)

# 🎓 UNIE Lead Capture App

Aplicación Web Progresiva (PWA) de alto rendimiento diseñada específicamente para la captura de leads en eventos de **UNIE Universidad**. Optimizada para iPad y situaciones de alta movilidad con o sin conexión a internet.

## 🛡️ Características "Anti-Balas" (Seguridad de Datos)

# UNIE Lead Capture App (v18.0)

PWA optimizada para la captura de leads en stands y eventos, sincronizada con la API de Planeta Formación y Universidades. Diseñada para garantizar que los datos lleguen como **Leads de alta calidad** (no Pre-leads) al CRM Dynamics y BIRT.

## 🚀 Características Principales

### 💎 Integración Pro-Lead (Calidad CRM)
- **Trazabilidad Total**: Envío de IP del terminal, URL de origen y texto legal exacto aceptado.
- **Mapeo de Calidad**: 
    - Estados de estudio homologados (`ES-12` para Máster, etc.).
    - Sexo numérico (`1`/`2`) para compatibilidad directa con Dynamics.
    - Doble validación de provincia (ISO + Texto).
    - Marca forzada a `UNIE` (Mayúsculas) para correcta atribución.

### 📡 Sincronización Inteligente
- **Offline-First**: Los leads se guardan localmente en el iPad si no hay internet.
- **Auto-Sync**: Sincronización automática silenciosa al recuperar la conexión.
- **Túnel Vercel**: Uso de serverless functions para evitar problemas de CORS y bloqueos de red.

### 🛡️ Control de Flujo (Anti-Saturación)
- **Rate Limiting**: Límite de seguridad de **100 leads por cada 30 minutos** para el envío automático/estándar.
- **Envío Masivo**: Opción de forzar el envío total de la cola mediante una clave de seguridad.

### ⚙️ Administración en Dos Niveles
1. **Ajustes Stand**: Gestión rápida de programas y código de campaña para el personal del evento.
2. **Sistema (IT)**: Configuración crítica de API Keys, entornos (PRE/PROD) e IDs técnicos, bloqueada para personal no autorizado.

## 🔑 Credenciales de Seguridad

| Acción | Contraseña |
| :--- | :--- |
| **Acceso Panel Admin (Candado)** | `unie321` |
| **Acceso a SISTEMA (Ajustes IT)** | `adminunie` |
| **Ejecutar ENVÍO MASIVO** | `UNIEMAS` |
| **BORRAR TODO (Vaciado DB)** | `borradomax` |

## 🛠️ Instalación en iPad/iPhone
1. Abre la URL en Safari.
2. Pulsa el botón **Compartir** (cuadrado con flecha).
3. Selecciona **"Añadir a la pantalla de inicio"**.
4. Abre la App desde el icono del escritorio para usarla a pantalla completa y sin barras de navegación.

## 📋 Requisitos Técnicos
- **Base de Datos**: Dexie.js (IndexedDB).
- **Hoja de Estilos**: Vanilla CSS con efectos Glassmorphism.
- **Backend**: Vercel Serverless (Proxy API).
- **Excel**: Exportación nativa mediante SheetJS.

---
*Desarrollado para asegurar el flujo de datos entre eventos presenciales y el ecosistema Business Intelligence (BIRT) de Planeta Formación.*

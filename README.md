# 🎓 UNIE Lead Capture App

Aplicación Web Progresiva (PWA) de alto rendimiento diseñada específicamente para la captura de leads en eventos de **UNIE Universidad**. Optimizada para iPad y situaciones de alta movilidad con o sin conexión a internet.

## 🛡️ Características "Anti-Balas" (Seguridad de Datos)

Esta app ha sido diseñada para ser extremadamente robusta y evitar cualquier pérdida de información:

*   **⚡ Auto-Guardado de Borradores**: Si el iPad se apaga o se cierra la pestaña mientras alguien escribe, los datos se recuperan automáticamente al reabrir la app.
*   **🔌 Funcionamiento Offline-First**: Los datos se guardan en el almacenamiento físico del dispositivo (`IndexedDB`) de forma inmediata. No dependes de internet para asegurar el lead.
*   **🔋 Resistencia a Fallos**: Los datos se graban en disco, no en la memoria RAM, por lo que sobreviven a reinicios, falta de batería o cierres inesperados.
*   **🔒 Bloqueo de Salida Accidental**: La app avisa al usuario si intenta cerrar la ventana teniendo leads pendientes de sincronizar.
*   **🧼 Sanitización de Seguridad (Anti-XSS)**: Protección contra inyección de código malicioso en los campos de texto.

## 🤖 Protección Anti-Bots

Para evitar leads basura o ataques automatizados en la web:

1.  **Honeypot (Invisible)**: Un campo trampa que solo los bots ven y rellenan, permitiendo descartar sus envíos automáticamente.
2.  **Time Trap**: Bloqueo de envíos realizados en menos de 2 segundos (velocidad no humana).

## 📱 Instalación y Uso como App Nativa

Para una experiencia óptima en **iPad o iPhone**:

1.  Abre la URL de la aplicación en **Safari**.
2.  Pulsa el botón **Compartir** (icono cuadrado con flecha hacia arriba).
3.  Selecciona **"Añadir a pantalla de inicio"**.
4.  ¡Listo! La app aparecerá en tu escritorio y funcionará a pantalla completa, con icono propio y sin barras de navegador.

## ⚙️ Panel de Administración y Configuración

Accede mediante el icono del candado (🔒) en la pantalla principal:
-   **Contraseña Admin**:
-   **Contraseña de Borrado Crítico**: 

### Funciones disponibles:
-   **Sincronización Inteligente**: Envía los leads acumulados a la API de Planeta mediante túneles seguros que evitan bloqueos de red.
-   **Exportación**: Descarga todos los leads en formato **Excel (.xlsx)** en cualquier momento.
-   **Gestor de Programas**: Define ID de producto y dedicación para cada carrera de UNIE de forma dinámica.
-   **Configuración Global**: Cambia API Keys, entornos (PRE/PROD), campus y códigos de campaña sin tocar el código.

---
*Desarrollado para UNIE Universidad - Eficiencia y Seguridad en Captación de Leads.*


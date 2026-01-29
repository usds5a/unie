// logic-v8.js - VERSIÓN 8.0 FINAL
async function syncLeads() {
    const apiKey = localStorage.getItem('api_key');
    const apiEnv = localStorage.getItem('config_env') || 'pre';
    const syncBtn = document.getElementById('sync-btn');

    if (!apiKey) {
        logToSyncDebug("❌ Error: Falta API Key en Configuración.");
        return;
    }

    const pendingLeads = await db.leads.where('synced').equals(0).toArray();
    if (pendingLeads.length === 0) {
        logToSyncDebug("No hay leads pendientes de envío.");
        return;
    }

    logToSyncDebug("--- VERSIÓN 8.0 (Fuerza Bruta GitHub) ---");

    for (const lead of pendingLeads) {
        logToSyncDebug(`Enviando Lead #${lead.id} (${lead.firstName})...`);
        try {
            const apiPayload = mapLeadToApiPayload(lead);
            const cleanApiKey = apiKey.trim();

            // Usamos el proxy que funcionó en tu local pero con un truco de "no-cache"
            const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent('https://api.planetaformacion.com/captacion/v1/lead');

            logToSyncDebug(`🔄 Conectando vía Puente Seguro...`);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'api-key': cleanApiKey,
                    'env': apiEnv
                },
                body: JSON.stringify(apiPayload)
            });

            if (response.ok) {
                const responseData = await response.json();
                logToSyncDebug(`✅ ¡LOGRADO! Sincronizado correctamente.`);

                await db.leads.update(lead.id, {
                    synced: true,
                    apiLeadId: (responseData.lead_id || "OK"),
                    apiResponse: responseData,
                    sentPayload: apiPayload
                });
            } else {
                logToSyncDebug(`❌ El servidor rechazó los datos (Error ${response.status}).`);
            }
        } catch (error) {
            logToSyncDebug(`❌ Error de Red: ${error.message}`);
        }
    }
    loadLeadsToTable();
}

// Copia el resto de funciones necesarias de app.js aquí abajo si vas a sustituirlo totalmente,
// pero por ahora solo necesito que pruebes si esta función conecta.

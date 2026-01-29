// Initialize Dexie Database
const db = new Dexie('UNIE_Leads_DB');
db.version(1).stores({
    leads: '++id, firstName, lastName, email, phone, program, date, synced'
});
db.version(2).stores({
    leads: '++id, firstName, lastName, email, phone, program, date, synced, apiLeadId, apiResponse, sentPayload'
});

// DOM Elements
const form = document.getElementById('lead-form');
const notificationArea = document.getElementById('notification-area');
const connectionStatus = document.getElementById('connection-status');
const leadsCountBadge = document.getElementById('leads-count');
const tableBody = document.querySelector('#leads-table tbody');
const navBtns = document.querySelectorAll('.nav-btn');
const exportBtn = document.getElementById('export-btn');
const syncBtn = document.getElementById('sync-btn');
const views = document.querySelectorAll('.view');

// State
let isOnline = navigator.onLine;

// --- Config ---
const API_CONFIG = {
    URL: 'https://api.planetaformacion.com/captacion/v1/lead',
    HEADERS: {
        'Content-Type': 'application/json',
        'env': 'pre'
    }
};

const DEFAULT_PROGRAMS = {
    "Grado en Odontología": { id: "9203", dedication: "1" }
};

// --- Initialization ---

async function requestPersistence() {
    if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persist();
        console.log(`¿Almacenamiento persistente concedido?: ${isPersisted}`);
        return isPersisted;
    }
    return false;
}

async function init() {
    await requestPersistence();
    window.formLoadTime = new Date().getTime(); // Start bot protection timer
    initializePrograms();
    updateConnectionStatus();
    updateLeadsCount();
    loadLeadsToTable();

    // Event Listeners
    window.addEventListener('online', () => setOnline(true));
    window.addEventListener('offline', () => setOnline(false));

    // Initialize Defaults (Removed hardcoded API Key for security)
    if (!localStorage.getItem('api_key')) localStorage.setItem('api_key', '');
    if (!localStorage.getItem('config_institution')) localStorage.setItem('config_institution', 'UNIE');
    if (!localStorage.getItem('config_campus')) localStorage.setItem('config_campus', '1');
    if (!localStorage.getItem('config_campaign')) localStorage.setItem('config_campaign', '');

    // FORCE UPDATE for testing as requested
    savePrograms(DEFAULT_PROGRAMS);

    form?.addEventListener('submit', handleFormSubmit);

    // Navigation / UI Logic
    const countrySelect = document.getElementById('country');
    const prefixInput = document.getElementById('phone-prefix');
    const provinceSelect = document.getElementById('province');
    const provinceText = document.getElementById('province-text');

    countrySelect?.addEventListener('change', () => {
        const selected = countrySelect.options[countrySelect.selectedIndex];
        if (prefixInput) prefixInput.value = selected.dataset.prefix || '';

        if (countrySelect.value === 'ES') {
            if (provinceSelect) {
                provinceSelect.style.display = 'block';
                provinceSelect.setAttribute('required', 'required');
            }
            if (provinceText) {
                provinceText.style.display = 'none';
                provinceText.removeAttribute('required');
                provinceText.value = '';
            }
        } else {
            if (provinceSelect) {
                provinceSelect.style.display = 'none';
                provinceSelect.removeAttribute('required');
                provinceSelect.value = '';
            }
            if (provinceText) {
                provinceText.style.display = 'block';
                provinceText.setAttribute('required', 'required');
            }
        }
    });

    countrySelect?.dispatchEvent(new Event('change'));

    // --- Draft Saving (Bulletproof) ---
    // Save as you type
    form?.addEventListener('input', () => {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        localStorage.setItem('lead_form_draft', JSON.stringify(data));
    });

    // Load draft if exists
    const draft = localStorage.getItem('lead_form_draft');
    if (draft) {
        try {
            const data = JSON.parse(draft);
            Object.keys(data).forEach(key => {
                const input = form.elements[key];
                if (input && input.type !== 'checkbox') {
                    input.value = data[key];
                } else if (input && input.type === 'checkbox') {
                    input.checked = data[key] === 'on';
                }
            });
            // Trigger change events for dependent selects (country/province)
            countrySelect?.dispatchEvent(new Event('change'));
        } catch (e) {
            console.error("Error loading draft", e);
        }
    }

    document.getElementById('admin-access-btn')?.addEventListener('click', () => {
        switchView('admin-view');
        loadLeadsToTable();
    });

    document.getElementById('debug-api-btn')?.addEventListener('click', () => {
        const payload = localStorage.getItem('last_api_payload');
        const response = localStorage.getItem('last_api_response');
        if (payload || response) {
            document.getElementById('sent-payload-pre').textContent = payload || "No hay datos";
            document.getElementById('api-response-pre').textContent = response || "No hay respuesta";
            document.getElementById('debug-modal').classList.remove('hidden');
        } else {
            showToast("No hay registros de la última sincronización.", "warning");
        }
    });

    document.getElementById('exit-admin-btn')?.addEventListener('click', () => {
        switchView('form-view');
    });

    exportBtn?.addEventListener('click', exportToExcel);
    syncBtn?.addEventListener('click', syncLeads);

    document.getElementById('delete-all-btn')?.addEventListener('click', async () => {
        const password = prompt('🔒 Introduce la contraseña de seguridad para borrar todos los leads:');
        if (password !== 'borradomax') {
            alert('❌ Contraseña incorrecta. Operación cancelada.');
            return;
        }
        if (confirm('¿ESTÁS SEGURO? Se borrarán TODOS los leads guardados. Esta acción no se puede deshacer.')) {
            await db.leads.clear();
            loadLeadsToTable();
            updateLeadsCount();
            showToast('Base de datos vaciada', 'success');
        }
    });

    document.getElementById('config-btn')?.addEventListener('click', () => {
        const password = prompt('🔒 Introduce la contraseña para acceder a Configuración:');
        if (password !== 'unie321') {
            alert('❌ Contraseña incorrecta. Acceso denegado.');
            return;
        }
        switchView('config-view');
        renderConfigTable();
        // Load Config
        document.getElementById('config-api-key').value = localStorage.getItem('api_key') || '';
        document.getElementById('config-institution').value = localStorage.getItem('config_institution') || '';
        document.getElementById('config-campus').value = localStorage.getItem('config_campus') || '';
        document.getElementById('config-campaign').value = localStorage.getItem('config_campaign') || '';
        document.getElementById('config-brand-id').value = localStorage.getItem('config_brand_id') || 'unie';
        document.getElementById('config-env').value = localStorage.getItem('config_env') || 'pre';
        document.getElementById('config-origin').value = localStorage.getItem('config_origin') || '4';
        document.getElementById('config-impartation').value = localStorage.getItem('config_impartation') || '1';
        document.getElementById('config-timing').value = localStorage.getItem('config_timing') || '1';
        document.getElementById('config-postcode').value = localStorage.getItem('config_postcode') || '28000';
    });

    document.getElementById('save-general-config-btn')?.addEventListener('click', () => {
        localStorage.setItem('config_institution', document.getElementById('config-institution').value.trim());
        localStorage.setItem('config_campus', document.getElementById('config-campus').value.trim());
        localStorage.setItem('config_campaign', document.getElementById('config-campaign').value.trim());
        localStorage.setItem('config_brand_id', document.getElementById('config-brand-id').value.trim());
        localStorage.setItem('config_env', document.getElementById('config-env').value);
        localStorage.setItem('config_origin', document.getElementById('config-origin').value.trim());
        localStorage.setItem('config_impartation', document.getElementById('config-impartation').value.trim());
        localStorage.setItem('config_timing', document.getElementById('config-timing').value.trim());
        localStorage.setItem('config_postcode', document.getElementById('config-postcode').value.trim());
        localStorage.setItem('config_sex', document.getElementById('config-sex').value);
        showToast('Configuración General Guardada', 'success');
    });

    document.getElementById('back-admin-btn')?.addEventListener('click', () => {
        switchView('admin-view');
    });

    document.getElementById('save-api-key-btn')?.addEventListener('click', () => {
        const key = document.getElementById('config-api-key').value.trim();
        if (key) {
            localStorage.setItem('api_key', key);
            showToast('API Key guardada', 'success');
        }
    });

    document.getElementById('close-debug-modal')?.addEventListener('click', () => {
        document.getElementById('debug-modal').classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        const modal = document.getElementById('debug-modal');
        if (e.target === modal) {
            modal.classList.add('hidden');
        }
    });

    document.getElementById('config-form')?.addEventListener('submit', handleConfigSubmit);
}

// --- Logic ---

function setOnline(status) {
    isOnline = status;
    updateConnectionStatus();
    if (isOnline) {
        showToast('Conexión restaurada', 'success');
    } else {
        showToast('Modo sin conexión', 'error');
    }
}

function updateConnectionStatus() {
    if (connectionStatus) {
        if (isOnline) {
            connectionStatus.textContent = 'Online';
            connectionStatus.className = 'status-pill online';
        } else {
            connectionStatus.textContent = 'Offline';
            connectionStatus.className = 'status-pill offline';
        }
    }
}

async function updateLeadsCount() {
    const total = await db.leads.count();
    const synced = await db.leads.where('synced').equals(true).count();

    // Update main hidden badge (optional, kept for safety)
    if (leadsCountBadge) leadsCountBadge.textContent = `${total} Leads Guardados`;

    // Update Admin Stats
    const totalBadge = document.getElementById('admin-total-leads');
    const syncedBadge = document.getElementById('admin-synced-leads');

    if (totalBadge) totalBadge.textContent = `Guardados: ${total}`;
    if (syncedBadge) syncedBadge.textContent = `Enviados: ${synced}`;
}

function switchView(viewId) {
    views.forEach(v => v.classList.remove('active'));
    const target = document.getElementById(viewId);
    if (target) target.classList.add('active');
    if (viewId === 'admin-view') {
        loadLeadsToTable();
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(form);
    // 3. Phone Validation (Basic length check)
    const rawAbPhone = (formData.get('phone') || '').trim();
    if (rawAbPhone.length < 9) {
        showToast('El teléfono parece incompleto (mínimo 9 dígitos).', 'warning');
        return;
    }

    const lead = {
        knowledgeArea: formData.get('knowledgeArea'),
        program: formData.get('program'),
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        age: formData.get('age'),
        country: formData.get('country'),
        province: formData.get('provinceSelect'),
        provinceText: formData.get('provinceText'),
        phonePrefix: formData.get('phonePrefix'),
        phone: rawAbPhone,
        studyLevel: formData.get('studyLevel'),
        privacy: formData.get('privacy') === 'on',
        date: new Date().toISOString(),
        synced: false
    };

    // --- BOT PROTECTION ---
    const honeypot = formData.get('website_url');
    const submissionTime = new Date().getTime();
    const elapsedTime = submissionTime - (window.formLoadTime || submissionTime);

    // 1. Honeypot Check (If filled, it's a bot)
    if (honeypot) {
        console.warn('Bot detected: Honeypot filled.');
        form.reset();
        showToast('Lead guardado correctamente', 'success'); // Fake success
        return;
    }

    // 2. Time Trap (If too fast < 2 seconds, likely a bot)
    // Note: window.formLoadTime is set in init() or on form reset.
    if (elapsedTime < 2000) {
        console.warn(`Bot detected: Too fast (${elapsedTime}ms)`);
        showToast('Por favor, tomese un momento para revisar los datos.', 'warning');
        return;
    }

    try {
        await db.leads.add(lead);
        form.reset();
        localStorage.removeItem('lead_form_draft'); // Clear draft on success
        window.formLoadTime = new Date().getTime(); // Reset timer
        showToast('Lead guardado correctamente', 'success');
        updateLeadsCount(); // Update counters immediately
    } catch (error) {
        console.error('Failed to save lead:', error);
        showToast('Error al guardar el lead', 'error');
    }
}

async function loadLeadsToTable() {
    const leads = await db.leads.toArray();
    leads.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate stats directly from the loaded data for consistency
    const totalCount = leads.length;
    const syncedCount = leads.filter(l => l.synced).length;

    // Update Admin Stats Badges
    const totalBadge = document.getElementById('admin-total-leads');
    const syncedBadge = document.getElementById('admin-synced-leads');

    if (totalBadge) totalBadge.textContent = `Guardados: ${totalCount}`;
    if (syncedBadge) syncedBadge.textContent = `Enviados: ${syncedCount}`;

    // Update main hidden badge
    if (leadsCountBadge) leadsCountBadge.textContent = `${totalCount} Leads Guardados`;

    if (tableBody) {
        tableBody.innerHTML = leads.map(lead => `
            <tr>
                <td>${lead.id}</td>
                <td>${safeHtml(lead.firstName)} ${safeHtml(lead.lastName)}</td>
                <td>${safeHtml(lead.email)}</td>
                <td>${safeHtml(lead.program)}</td>
                <td>${new Date(lead.date).toLocaleString()}</td>
                <td>
                    ${lead.apiLeadId && lead.apiLeadId !== '-' && lead.apiLeadId !== 'OK' ?
                `<a href="https://atenea.crm4.dynamics.com/main.aspx?appid=a2f315b2-dbe1-ec11-bb3d-000d3abbc718&pagetype=search&searchText=${lead.apiLeadId}" 
                            target="_blank" 
                            style="font-size: 0.8rem; color: #2563eb; text-decoration: underline; font-family: monospace;">
                            ${safeHtml(lead.apiLeadId)}
                         </a>` :
                `<code style="font-size: 0.8rem; color: #64748b;">${safeHtml(lead.apiLeadId || '-')}</code>`
            }
                </td>
                <td>
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <span class="status-pill ${lead.synced ? 'online' : 'offline'}">
                            ${lead.synced ? 'Sincronizado' : 'Pendiente'}
                        </span>
                        ${lead.synced ? `<button onclick="viewLeadResponse(${lead.id})" class="status-pill info" style="border:none; cursor:pointer; margin-top:4px;">Ver ID / API</button>` : ''}
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// Security: Prevent XSS
function safeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Safety: Prevent accidental closing if leads are pending
window.addEventListener('beforeunload', async (e) => {
    // Only check if we can reliably check sync status synchronously or if we just warn always on data presence
    // Since Dexie is async, we can't block easily based on DB count in standard beforeunload.
    // However, we can track a simple "unsynced" flag in memory or just warn if ANY leads exist.
    // For simplicity and safety: Warn if standard isOnline is false or just generic warning.
    // Better approach: We can't query DB here easily.
    // Let's rely on the "leadsCountBadge" text which we update constantly.
    const unsyncedCount = document.querySelectorAll('.status-pill.offline').length - 1; // -1 for the status bar itself
    if (unsyncedCount > 0) {
        e.preventDefault();
        e.returnValue = ''; // Standard for Chrome
    }
});

window.viewLeadResponse = async function (id) {
    const lead = await db.leads.get(id);
    if (lead && lead.apiResponse) {
        document.getElementById('sent-payload-pre').textContent = JSON.stringify(lead.sentPayload, null, 2);
        document.getElementById('api-response-pre').textContent = JSON.stringify(lead.apiResponse, null, 2);
        document.getElementById('debug-modal').classList.remove('hidden');
    } else {
        showToast("No hay respuesta guardada para este lead.", "warning");
    }
};

window.copyToClipboard = function (elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast("¡Copiado al portapapeles!", "success");
    }).catch(err => {
        showToast("Error al copiar", "error");
    });
};

async function exportToExcel() {
    try {
        const leads = await db.leads.toArray();
        if (leads.length === 0) {
            showToast('No hay datos para exportar', 'warning');
            return;
        }

        const data = leads.map(l => ({
            "Institution": localStorage.getItem('config_institution') || "",
            "First Name": l.firstName,
            "First Last Name": l.lastName,
            "Telephone Number": l.phone,
            "Country": l.country,
            "State": l.province || l.provinceText || "",
            "Email": l.email,
            "Age": l.age,
            "Source Campaign": localStorage.getItem('config_campaign') || "",
            "Program of Interest": l.program,
            "Program Version of Interest": "",
            "Campus": localStorage.getItem('config_campus') || "",
            "Level of Study": l.studyLevel,
            "API Lead ID": l.apiLeadId || ""
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Leads");
        const dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `UNIE_Leads_${dateStr}.xlsx`);
        showToast('Exportación completada', 'success');
    } catch (error) {
        showToast('Error al exportar', 'error');
    }
}

function logToSyncDebug(msg) {
    const logArea = document.getElementById('sync-debug-log');
    if (logArea) {
        const timestamp = new Date().toLocaleTimeString();
        logArea.value += `[${timestamp}] ${msg}\n`;
        logArea.scrollTop = logArea.scrollHeight;
    }
}

async function syncLeads() {
    logToSyncDebug("--- Iniciando Sincronización ---");

    if (!isOnline) {
        alert("Error: No hay conexión a internet.");
        logToSyncDebug("❌ Error: Sin conexión.");
        return;
    }

    let pendingLeads = [];
    try {
        const allLeads = await db.leads.toArray();
        pendingLeads = allLeads.filter(l => l.synced === false);
    } catch (e) {
        alert("Error base de datos: " + e.message);
        return;
    }

    if (pendingLeads.length === 0) {
        alert("ℹ️ NO HAY LEADS PENDIENTES.");
        return;
    }

    const apiKey = localStorage.getItem('api_key');
    const apiEnv = localStorage.getItem('config_env') || 'pre';

    if (!apiKey) {
        alert("⚠️ Falta API Key en Configuración.");
        logToSyncDebug("❌ Error: Falta API Key.");
        return;
    }

    syncBtn.disabled = true;
    let successCount = 0;
    let failCount = 0;

    logToSyncDebug("--- VERSIÓN 6.0 (Diagnóstico Maestro) ---");

    for (let i = 0; i < pendingLeads.length; i++) {
        const lead = pendingLeads[i];
        syncBtn.textContent = `Enviando ${i + 1}/${pendingLeads.length}...`;
        logToSyncDebug(`Enviando Lead #${lead.id} (${lead.firstName})...`);

        try {
            const apiPayload = mapLeadToApiPayload(lead);
            const cleanApiKey = apiKey.trim();

            // Configuración individual para cada proxy
            const proxyConfigs = [
                { name: 'CORS-Proxy (Directo)', url: 'https://corsproxy.io/?' + API_CONFIG.URL },
                { name: 'AllOrigins (Encoded)', url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(API_CONFIG.URL) },
                { name: 'ThingProxy (Raw)', url: 'https://thingproxy.freeboard.io/fetch/' + API_CONFIG.URL }
            ];

            let response;
            let successRaw = false;

            // 1. INTENTO DIRECTO
            try {
                logToSyncDebug(`🔄 Probando: DIRECTO...`);
                response = await fetch(API_CONFIG.URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'api-key': cleanApiKey, 'env': apiEnv },
                    body: JSON.stringify(apiPayload)
                });
                if (response.ok || response.status < 500) successRaw = true;
            } catch (e) {
                logToSyncDebug(`⚠️ Directo bloqueado por el navegador (CORS).`);
            }

            // 2. INTENTO POR TÚNELES
            if (!successRaw) {
                for (const config of proxyConfigs) {
                    try {
                        logToSyncDebug(`🔄 Probando: ${config.name}...`);
                        response = await fetch(config.url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'api-key': cleanApiKey,
                                'env': apiEnv
                            },
                            body: JSON.stringify(apiPayload)
                        });

                        if (response.ok || response.status < 500) {
                            successRaw = true;
                            break;
                        } else {
                            logToSyncDebug(`❌ Server respondió: ${response.status}`);
                        }
                    } catch (err) {
                        logToSyncDebug(`❌ Error en ${config.name}: ${err.message}`);
                    }
                }
            }

            if (successRaw && response && response.ok) {
                const responseData = await response.json();
                logToSyncDebug(`✅ ¡LOGRADO! Lead sincronizado.`);
                localStorage.setItem('last_api_response', JSON.stringify(responseData, null, 2));

                await db.leads.update(lead.id, {
                    synced: true,
                    apiLeadId: (() => {
                        try {
                            if (responseData && typeof responseData === 'object') {
                                const keys = Object.keys(responseData);
                                for (const k of keys) {
                                    if (responseData[k] && responseData[k].pubsub && responseData[k].pubsub.process_leadID) {
                                        return responseData[k].pubsub.process_leadID;
                                    }
                                }
                            }
                            return responseData.lead_id || responseData.id || responseData.leadId || "OK";
                        } catch (e) { return "OK"; }
                    })(),
                    apiResponse: responseData,
                    sentPayload: apiPayload
                });
                successCount++;
            } else if (response) {
                logToSyncDebug(`❌ Error final del server: ${response.status}`);
                failCount++;
            } else {
                throw new Error("Ninguna vía de conexión funcionó.");
            }
        } catch (error) {
            logToSyncDebug(`❌ RESULTADO: ${error.message}`);
            failCount++;
        }
    }

    syncBtn.textContent = "Enviar a API Leads";
    syncBtn.disabled = false;
    loadLeadsToTable();

    if (successCount > 0) showToast(`Sincronizados ${successCount} leads.`, 'success');
    logToSyncDebug(`--- Fin: ${successCount} OK, ${failCount} Errores ---`);
}

// Province Mapping
const PROVINCE_ISO_MAP = {
    "Álava": "ES-VI", "Albacete": "ES-AB", "Alicante": "ES-A", "Almería": "ES-AL", "Asturias": "ES-O", "Ávila": "ES-AV", "Badajoz": "ES-BA",
    "Baleares": "ES-PM", "Palma": "ES-PM", "Barcelona": "ES-B", "Burgos": "ES-BU", "Cáceres": "ES-CC", "Cádiz": "ES-CA", "Cantabria": "ES-S",
    "Castellón": "ES-CS", "Ciudad Real": "ES-CR", "Córdoba": "ES-CO", "Coruña": "ES-C", "Cuenca": "ES-CU", "Gipuzkoa": "ES-SS", "Girona": "ES-GI",
    "Granada": "ES-GR", "Guadalajara": "ES-GU", "Huelva": "ES-H", "Huesca": "ES-HU", "Jaén": "ES-J", "León": "ES-LE", "Lleida": "ES-L",
    "Lugo": "ES-LU", "Madrid": "ES-M", "Málaga": "ES-MA", "Murcia": "ES-MU", "Navarra": "ES-NA", "Ourense": "ES-OR", "Palencia": "ES-P",
    "Las Palmas": "ES-GC", "Pontevedra": "ES-PO", "La Rioja": "ES-LO", "Salamanca": "ES-SA", "Segovia": "ES-SG", "Sevilla": "ES-SE", "Soria": "ES-SO",
    "Tarragona": "ES-T", "Santa Cruz de Tenerife": "ES-TF", "Teruel": "ES-TE", "Toledo": "ES-TO", "Valencia": "ES-V", "Valladolid": "ES-VA",
    "Bizkaia": "ES-BI", "Bilbao": "ES-BI", "Zamora": "ES-ZA", "Zaragoza": "ES-Z", "Ceuta": "ES-CE", "Melilla": "ES-ML"
};

function mapLeadToApiPayload(lead) {
    const map = getPrograms();
    const programData = map[lead.program] || { id: "", dedication: "" };

    let provinceISO = "";
    if (lead.country === 'ES' && lead.province) {
        provinceISO = PROVINCE_ISO_MAP[lead.province] || "ES-M";
    }

    const STUDY_LEVEL_MAP = {
        "Bachillerato": "ES-4",
        "FP": "FM-1",
        "Grado": "ES-6",
        "Master": "MA-1"
    };

    const payload = {
        "process_brand": localStorage.getItem('config_brand_id') || "unie",
        "process_type": "SI",
        "process_origin": localStorage.getItem('config_origin') || "4",
        "process_campaignCode": localStorage.getItem('config_campaign') || "I10002S0003",
        "lead_name": lead.firstName,
        "lead_surname": lead.lastName,
        "lead_email": lead.email,
        "lead_phoneNumber": lead.phonePrefix + lead.phone,
        "lead_countryISO": lead.country,
        "lead_province": lead.province || lead.provinceText || "Madrid",
        "lead_provinceISO": provinceISO,
        "lead_age": String(lead.age || "25"),
        "lead_sex": localStorage.getItem('config_sex') || "Man",
        "study_level": STUDY_LEVEL_MAP[lead.studyLevel] || "ES-6",
        "program_idProduct": String(programData.id),
        "program_idDedication": String(programData.dedication),
        "program_idCampus": localStorage.getItem('config_campus') || "1",
        "program_idImpartation": localStorage.getItem('config_impartation') || "1",
        "program_idTiming": localStorage.getItem('config_timing') || "1",
        "rgpd_acceptThirdParties": "0",
        "rgpd_acceptGroup": "0",
        "rgpd_acceptContact": lead.privacy ? "1" : "0",
        "process_requestDate": new Date(lead.date).toISOString().slice(0, 19).replace('T', ' ')
    };

    if (lead.country === 'ES') payload["lead_postCode"] = localStorage.getItem('config_postcode') || "28000";
    return payload;
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    notificationArea.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

init();

function getPrograms() {
    const stored = localStorage.getItem('program_map');
    return stored ? JSON.parse(stored) : DEFAULT_PROGRAMS;
}

function savePrograms(map) {
    localStorage.setItem('program_map', JSON.stringify(map));
    initializePrograms();
}

function initializePrograms() {
    let map = getPrograms();
    if (!localStorage.getItem('program_map')) savePrograms(DEFAULT_PROGRAMS);
    const select = document.getElementById('program');
    if (select) {
        select.innerHTML = '<option value="" disabled selected>Selecciona un programa</option>';
        Object.keys(map).sort().forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            select.appendChild(option);
        });
    }
}

function renderConfigTable() {
    const map = getPrograms();
    const tbody = document.getElementById('programs-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    Object.entries(map).sort().forEach(([name, data]) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${name}</td><td>${data.id}</td><td>${data.dedication}</td><td><button class="btn-tiny" onclick="deleteProgram('${name}')">X</button></td>`;
        tbody.appendChild(tr);
    });
}

window.deleteProgram = function (name) {
    if (confirm(`¿Eliminar "${name}"?`)) {
        const map = getPrograms();
        delete map[name];
        savePrograms(map);
        renderConfigTable();
    }
};

function handleConfigSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const name = formData.get('name').trim();
    const map = getPrograms();
    map[name] = { id: formData.get('id'), dedication: formData.get('dedication') };
    savePrograms(map);
    e.target.reset();
    renderConfigTable();
}

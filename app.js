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
    PROXY_PHP: 'proxy.php' // Para servidores tradicionales
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

    // Initialize Defaults
    if (!localStorage.getItem('api_key')) localStorage.setItem('api_key', '');
    if (!localStorage.getItem('config_institution')) localStorage.setItem('config_institution', 'UNIE');
    if (!localStorage.getItem('config_campus')) localStorage.setItem('config_campus', '1');
    if (!localStorage.getItem('config_brand_id')) localStorage.setItem('config_brand_id', 'UNIE');
    if (!localStorage.getItem('config_campaign')) localStorage.setItem('config_campaign', 'I10002S0003');
    if (!localStorage.getItem('config_env')) localStorage.setItem('config_env', 'pre');
    if (!localStorage.getItem('config_origin')) localStorage.setItem('config_origin', '4');
    if (!localStorage.getItem('config_impartation')) localStorage.setItem('config_impartation', '1');
    if (!localStorage.getItem('config_timing')) localStorage.setItem('config_timing', '1');
    if (!localStorage.getItem('config_sex')) localStorage.setItem('config_sex', '1');
    if (!localStorage.getItem('config_postcode')) localStorage.setItem('config_postcode', '28000');
    if (!localStorage.getItem('config_rgpd_id')) localStorage.setItem('config_rgpd_id', '1');

    document.getElementById('clear-log-btn')?.addEventListener('click', () => {
        const logArea = document.getElementById('sync-debug-log');
        if (logArea) logArea.value = '';
    });



    // Cerrar Modal de Debug
    const closeDebugModalBtn = document.getElementById('close-debug-modal');
    if (closeDebugModalBtn) {
        closeDebugModalBtn.addEventListener('click', () => {
            document.getElementById('debug-modal').classList.add('hidden');
        });
    }

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
            if (prefixInput) prefixInput.readOnly = true;
            if (provinceSelect) {
                const group = document.getElementById('province-group');
                if (group) group.style.display = 'block';
                provinceSelect.setAttribute('required', 'required');
            }
            if (provinceText) {
                provinceText.style.display = 'none';
                provinceText.removeAttribute('required');
                provinceText.value = '';
            }
        } else {
            if (prefixInput) {
                prefixInput.readOnly = (countrySelect.value !== 'Other');
                if (countrySelect.value === 'Other') prefixInput.placeholder = '+';
            }
            if (provinceSelect) {
                const group = document.getElementById('province-group');
                if (group) group.style.display = 'none';
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

    document.getElementById('admin-access-btn')?.addEventListener('click', async () => {
        const password = await requestPassword('Acceso Administrador', 'Introduce la clave de acceso al panel:');
        if (password === 'unie321') {
            switchView('admin-view');
            loadLeadsToTable();
        } else if (password !== null) {
            showToast('❌ Contraseña incorrecta.', 'error');
        }
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

    // Botón Estándar (Respetando límites)
    syncBtn?.addEventListener('click', () => syncLeads(false, false));

    // Nuevo Botón de Envío Masivo
    document.getElementById('mass-sync-btn')?.addEventListener('click', async () => {
        const password = await requestPassword('Envío Masivo', 'Introduce la clave de operativa para envíos sin límites:');
        if (password === 'admi321@#') {
            if (confirm('¿Deseas enviar TODOS los leads pendientes sin restricciones?')) {
                syncLeads(false, true); // Masivo
            }
        } else if (password !== null) {
            showToast('❌ Contraseña incorrecta.', 'error');
        }
    });

    document.getElementById('delete-all-btn')?.addEventListener('click', async () => {
        const password = await requestPassword('Borrado Masivo', 'Introduce la clave de operativa para borrar la base de datos:');
        if (password === 'admi321@#') {
            if (confirm('¿ESTÁS SEGURO? Se borrarán TODOS los leads guardados. Esta acción no se puede deshacer.')) {
                await db.leads.clear();
                loadLeadsToTable();
                updateLeadsCount();
                showToast('Base de datos vaciada', 'success');
            }
        } else if (password !== null) {
            showToast('❌ Contraseña incorrecta.', 'error');
        }
    });

    // --- BOTONES DE CONFIGURACIÓN SEPARADOS ---

    // 1. AJUSTES STAND (Campaña + Programas)
    document.getElementById('stand-config-btn')?.addEventListener('click', () => {
        switchView('stand-config-view');
        renderConfigTable();
        document.getElementById('config-stand-campaign').value = localStorage.getItem('config_campaign') || '';
    });

    document.getElementById('save-stand-campaign-btn')?.addEventListener('click', () => {
        const campaign = document.getElementById('config-stand-campaign').value.trim();
        localStorage.setItem('config_campaign', campaign);
        showToast('Campaña actualizada', 'success');
    });

    // 2. SISTEMA (API + Tech IDs) - Protegido por clave IT
    document.getElementById('system-config-btn')?.addEventListener('click', async () => {
        const password = await requestPassword('Acceso Sistema (IT)', 'Introduce la clave de administración técnica:');
        if (password === 'admi321@#') {
            switchView('system-config-view');
        } else if (password !== null) {
            showToast('❌ Clave incorrecta. Acceso denegado.', 'error');
            return;
        } else {
            return; // Cancelado
        }

        // Cargar datos en los campos SYS
        document.getElementById('config-sys-api-key').value = localStorage.getItem('api_key') || '';
        document.getElementById('config-sys-institution').value = localStorage.getItem('config_institution') || 'UNIE';
        document.getElementById('config-sys-campus').value = localStorage.getItem('config_campus') || '1';
        document.getElementById('config-sys-env').value = localStorage.getItem('config_env') || 'pre';
        document.getElementById('config-sys-brand-id').value = localStorage.getItem('config_brand_id') || 'UNIE';
        document.getElementById('config-sys-origin').value = localStorage.getItem('config_origin') || '4';
        document.getElementById('config-sys-impartation').value = localStorage.getItem('config_impartation') || '1';
        document.getElementById('config-sys-timing').value = localStorage.getItem('config_timing') || '1';
        if (document.getElementById('config-sys-sex')) document.getElementById('config-sys-sex').value = localStorage.getItem('config_sex') || "1";
        if (document.getElementById('config-sys-postcode')) document.getElementById('config-sys-postcode').value = localStorage.getItem('config_postcode') || "28000";
        if (document.getElementById('config-sys-rgpd-id')) document.getElementById('config-sys-rgpd-id').value = localStorage.getItem('config_rgpd_id') || "1";
    });

    document.getElementById('save-system-config-btn')?.addEventListener('click', () => {
        localStorage.setItem('api_key', document.getElementById('config-sys-api-key').value.trim());
        localStorage.setItem('config_institution', document.getElementById('config-sys-institution').value.trim());
        localStorage.setItem('config_campus', document.getElementById('config-sys-campus').value.trim());
        localStorage.setItem('config_env', document.getElementById('config-sys-env').value);
        localStorage.setItem('config_brand_id', document.getElementById('config-sys-brand-id').value.trim());
        localStorage.setItem('config_origin', document.getElementById('config-sys-origin').value.trim());
        localStorage.setItem('config_impartation', document.getElementById('config-sys-impartation').value.trim());
        localStorage.setItem('config_timing', document.getElementById('config-sys-timing').value.trim());
        localStorage.setItem('config_sex', document.getElementById('config-sys-sex').value);
        localStorage.setItem('config_postcode', document.getElementById('config-sys-postcode').value.trim());
        localStorage.setItem('config_rgpd_id', document.getElementById('config-sys-rgpd-id').value.trim());
        showToast('Configuración del Sistema guardada', 'success');
    });

    // Botones de vuelta (comunes)
    document.querySelectorAll('.back-admin-btn').forEach(btn => {
        btn.addEventListener('click', () => switchView('admin-view'));
    });

    document.getElementById('close-debug-modal')?.addEventListener('click', () => {
        document.getElementById('debug-modal').classList.add('hidden');
    });

    window.addEventListener('click', (e) => {
        const debugModal = document.getElementById('debug-modal');
        const pwdModal = document.getElementById('password-modal');
        if (e.target === debugModal) debugModal.classList.add('hidden');
        if (e.target === pwdModal) pwdModal.classList.add('hidden');
    });

    document.getElementById('config-form')?.addEventListener('submit', handleConfigSubmit);

    // Initialize Premium Custom Dropdowns
    initCustomSelects();
}

// --- Premium Custom Select Logic ---
function initCustomSelects() {
    const selects = document.querySelectorAll('select.custom-input');

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-select-wrapper')) {
            document.querySelectorAll('.custom-select-popup').forEach(p => p.classList.remove('active'));
        }
    });

    selects.forEach(select => {
        if (select.dataset.customized) return;
        select.dataset.customized = 'true';

        // Hide native select but keep it functional for form submission
        select.classList.add('hidden');

        const wrapper = select.parentElement;
        wrapper.classList.add('custom-select-wrapper');

        const display = document.createElement('div');
        display.className = 'custom-select-display custom-input';
        display.textContent = select.options[select.selectedIndex]?.text || select.getAttribute('placeholder') || 'Seleccionar';

        const popup = document.createElement('div');
        popup.className = 'custom-select-popup';

        const updateDisplay = () => {
            display.textContent = select.options[select.selectedIndex]?.text || '';
        };

        const updatePopupItems = () => {
            popup.innerHTML = '';
            Array.from(select.options).forEach((opt, idx) => {
                // Skip the hidden/placeholder option in the popup list
                if (opt.value === "" && idx === 0) return;

                const item = document.createElement('div');
                item.className = 'custom-select-option' + (opt.selected ? ' selected' : '');
                item.textContent = opt.text;
                item.onclick = (e) => {
                    e.stopPropagation();
                    select.value = opt.value;
                    select.dispatchEvent(new Event('change'));
                    updateDisplay();
                    popup.classList.remove('active');
                };
                popup.appendChild(item);
            });
        };

        display.onclick = (e) => {
            e.stopPropagation();
            const isActive = popup.classList.contains('active');
            // Close others
            document.querySelectorAll('.custom-select-popup').forEach(p => p.classList.remove('active'));
            if (!isActive) {
                updatePopupItems();
                popup.classList.add('active');
            }
        };

        select.addEventListener('change', updateDisplay);

        // Observer to detect when the native select options are updated (e.g. Programs)
        const observer = new MutationObserver(() => {
            updateDisplay();
        });
        observer.observe(select, { childList: true });

        wrapper.appendChild(display);
        wrapper.appendChild(popup);
    });
}

// --- Logic ---

function setOnline(status) {
    isOnline = status;
    updateConnectionStatus();
    if (isOnline) {
        showToast('Conexión restaurada', 'success');
        // --- AUTO-SYNC AL VOLVER A ESTAR ONLINE ---
        console.log("Detectada vuelta de conexión. Sincronizando pendientes...");
        syncLeads(true); // Sincronización silenciosa de todos los pendientes
    } else {
        showToast('Modo sin conexión', 'warning');
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

    const legalLabel = document.querySelector('label[for="privacy"]');
    const acceptedText = legalLabel ? legalLabel.innerText.trim() : "UNIE UNIVERSIDAD S.L, tratará sus datos personales...";

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
        legalTextAccepted: acceptedText,
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
        localStorage.removeItem('lead_form_draft');
        window.formLoadTime = new Date().getTime();

        // --- MENSAJE INTELIGENTE ---
        if (isOnline) {
            showToast('Lead guardado y enviado correctamente', 'success');
            console.log("Auto-syncing lead...");
            syncLeads(true); // Sincronización silenciosa
        } else {
            showToast('Lead guardado en el iPad (Sin conexión)', 'warning');
        }

        updateLeadsCount();
    } catch (error) {
        console.error('Failed to save lead:', error);
        showToast('Error al guardar el lead', 'error');
    }
}

async function loadLeadsToTable() {
    const leads = await db.leads.toArray();
    leads.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalCount = leads.length;
    const syncedCount = leads.filter(l => l.synced).length;
    const versionStr = 'v18.1.45';

    // Update Admin Stats Badges (keeping IDs compatible)
    const totalBadge = document.getElementById('admin-total-leads');
    const syncedBadge = document.getElementById('admin-synced-leads');
    const versionBadges = document.querySelectorAll('.version-badge');

    if (totalBadge) totalBadge.textContent = `GUARDADOS: ${totalCount}`;
    if (syncedBadge) syncedBadge.textContent = `ENVIADOS: ${syncedCount}`;
    versionBadges.forEach(b => b.textContent = versionStr);

    // Update main hidden badge
    if (leadsCountBadge) leadsCountBadge.textContent = `${totalCount} Leads Guardados`;

    if (tableBody) {
        tableBody.innerHTML = leads.map(lead => `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-4 font-medium text-slate-700">${lead.id}</td>
                <td class="px-4 py-4 text-slate-900">${safeHtml(lead.firstName)} ${safeHtml(lead.lastName)}</td>
                <td class="px-4 py-4 text-slate-600">${safeHtml(lead.email)}</td>
                <td class="px-4 py-4 text-slate-700">${safeHtml(lead.program)}</td>
                <td class="px-4 py-4 text-slate-600 whitespace-nowrap">${new Date(lead.date).toLocaleString()}</td>
                <td class="px-4 py-4 text-slate-600 font-mono text-xs">
                    ${lead.apiLeadId && lead.apiLeadId !== '-' && lead.apiLeadId !== 'OK' ?
                `<a href="https://atenea.crm4.dynamics.com/main.aspx?appid=a2f315b2-dbe1-ec11-bb3d-000d3abbc718&pagetype=search&searchText=${lead.apiLeadId}"
                           target="_blank" class="text-blue-600 hover:underline">
                           ${safeHtml(lead.apiLeadId)}
                         </a>` :
                `<span>${safeHtml(lead.apiLeadId || '-')}</span>`
            }
                </td>
                <td class="px-4 py-4">
                    ${lead.synced ?
                `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-badge-green-bg text-badge-green-text uppercase tracking-wide">
                            SINCRONIZADO
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd"></path>
                            </svg>
                        </span>` :
                `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 uppercase tracking-wide">
                            PENDIENTE
                        </span>`
            }
                </td>
                <td class="px-4 py-4 text-right">
                    ${lead.apiResponse ?
                `<button class="text-white text-xs font-bold py-2 px-3 rounded uppercase transition-colors shadow-sm bg-dark-navy hover:bg-blue-800 whitespace-nowrap" 
                             onclick="viewLeadResponse(${lead.id})">
                            Ver Respuesta
                        </button>` : ''
            }
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
    const leadId = parseInt(id);
    const lead = await db.leads.get(leadId);
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

// --- Custom Password Prompt System ---
function requestPassword(title, message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('password-modal');
        const titleEl = document.getElementById('password-modal-title');
        const messageEl = document.getElementById('password-modal-message');
        const input = document.getElementById('password-input');
        const submitBtn = document.getElementById('password-submit-btn');
        const cancelBtn = document.getElementById('password-cancel-btn');
        const closeBtn = document.getElementById('close-password-modal');

        titleEl.textContent = title;
        messageEl.textContent = message;
        input.value = '';
        modal.classList.remove('hidden');
        input.focus();

        const cleanup = () => {
            modal.classList.add('hidden');
            submitBtn.removeEventListener('click', handleSubmit);
            cancelBtn.removeEventListener('click', handleCancel);
            closeBtn.removeEventListener('click', handleCancel);
            input.removeEventListener('keypress', handleKeyPress);
        };

        const handleSubmit = () => {
            const val = input.value;
            cleanup();
            resolve(val);
        };

        const handleCancel = () => {
            cleanup();
            resolve(null);
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') handleSubmit();
        };

        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', handleCancel);
        closeBtn.addEventListener('click', handleCancel);
        input.addEventListener('keypress', handleKeyPress);
    });
}

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

async function syncLeads(isSilent = false, isMass = false) {
    if (!isSilent) logToSyncDebug("--- Sincronización (Modo Local) ---");

    if (!isOnline && !isSilent) {
        alert("⚠️ No hay conexión a internet.");
        return;
    }

    const allLeads = await db.leads.toArray();
    let pendingLeads = allLeads.filter(l => l.synced === false);

    if (pendingLeads.length === 0) {
        if (!isSilent) alert("ℹ️ NO HAY LEADS PENDIENTES.");
        return;
    }

    // --- LÓGICA DE CONTROL DE FLUJO (Rate Limiting) ---
    if (!isMass) {
        const now = Date.now();
        let stats = JSON.parse(localStorage.getItem('sync_stats') || '{"windowStart":0,"count":0}');

        // Si han pasado más de 30 minutos, reiniciamos la ventana
        if (now - stats.windowStart > 30 * 60 * 1000) {
            stats = { windowStart: now, count: 0 };
        }

        if (stats.count >= 100) {
            const minutesLeft = Math.ceil((30 * 60 * 1000 - (now - stats.windowStart)) / 60000);
            if (!isSilent) alert(`⚠️ Límite alcanzado: Has enviado 100 leads en los últimos 30 min. Espera ${minutesLeft} min o usa Envío Masivo.`);
            logToSyncDebug(`⛔ Límite alcanzado. Esperando ventana de tiempo (${minutesLeft} min).`);
            return;
        }

        const remainingInWindow = 100 - stats.count;
        if (pendingLeads.length > remainingInWindow) {
            if (!isSilent) console.log(`Limitando envío a ${remainingInWindow} leads para esta ventana.`);
            pendingLeads = pendingLeads.slice(0, remainingInWindow);
        }
    }

    const apiKey = localStorage.getItem('api_key');
    const apiEnv = localStorage.getItem('config_env') || 'pre';

    if (!apiKey) {
        if (!isSilent) alert("⚠️ Falta API Key en Configuración.");
        logToSyncDebug("❌ Error: Falta API Key.");
        return;
    }

    syncBtn.disabled = true;
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pendingLeads.length; i++) {
        const lead = pendingLeads[i];
        if (!isSilent) syncBtn.textContent = `Enviando ${i + 1}/${pendingLeads.length}...`;
        logToSyncDebug(`Enviando Lead #${lead.id} (${lead.firstName})...`);

        try {
            const apiPayload = await mapLeadToApiPayload(lead);
            const proxyHeaders = {
                'Content-Type': 'application/json',
                'api-key': apiKey.trim(),
                'env': apiEnv
            };

            // SECUENCIA DE PROXIES EXTERNOS (Para Local/GitHub Pages)
            const proxies = [
                { name: 'CORSProxy', url: `https://corsproxy.io/?url=${encodeURIComponent(API_CONFIG.URL)}` },
                { name: 'ThingProxy', url: `https://thingproxy.freeboard.io/fetch/${API_CONFIG.URL}` }
            ];

            let responseData = {};
            let isOk = false;

            for (const proxy of proxies) {
                logToSyncDebug(`🔄 Probando vía: ${proxy.name}...`);
                try {
                    const response = await fetch(proxy.url, {
                        method: 'POST',
                        headers: proxyHeaders,
                        body: JSON.stringify(apiPayload)
                    }).catch(() => null);

                    if (response && response.ok) {
                        responseData = await response.json().catch(() => ({}));
                        isOk = true;
                        logToSyncDebug(`✅ Sincronizado OK (${proxy.name}).`);
                        break;
                    } else if (response) {
                        const errTxt = await response.text().catch(() => "");
                        logToSyncDebug(`⚠️ ${proxy.name} falló (Status ${response.status}). ${errTxt.slice(0, 50)}`);
                    }
                } catch (e) {
                    logToSyncDebug(`⚠️ Error ${proxy.name}: ${e.message}`);
                }
            }

            if (isOk) {
                await db.leads.update(lead.id, {
                    synced: true,
                    apiLeadId: (() => {
                        try {
                            if (responseData && typeof responseData === 'object') {
                                const keys = Object.keys(responseData);
                                for (const k of keys) {
                                    if (responseData[k]?.pubsub?.process_leadID) return responseData[k].pubsub.process_leadID;
                                }
                            }
                            return responseData.lead_id || responseData.id || responseData.leadId || "OK";
                        } catch (e) { return "OK"; }
                    })(),
                    apiResponse: responseData,
                    sentPayload: apiPayload
                });
                successCount++;
            } else {
                failCount++;
                logToSyncDebug(`❌ Todos los túneles fallaron para el Lead #${lead.id}.`);
            }
        } catch (e) {
            logToSyncDebug(`❌ Error Crítico: ${e.message}`);
            failCount++;
        }
    }

    if (!isSilent) {
        syncBtn.textContent = "Enviar a API Leads";
        syncBtn.disabled = false;
        if (successCount > 0) showToast(`Sincronizados ${successCount} leads.`, 'success');
    }

    // Actualizar estadísticas de Rate Limiting si no fue masivo
    if (!isMass && successCount > 0) {
        let stats = JSON.parse(localStorage.getItem('sync_stats') || '{"windowStart":0,"count":0}');
        if (Date.now() - stats.windowStart > 30 * 60 * 1000) {
            stats = { windowStart: Date.now(), count: successCount };
        } else {
            stats.count += successCount;
        }
        localStorage.setItem('sync_stats', JSON.stringify(stats));
    }

    loadLeadsToTable();
    logToSyncDebug(`--- Fin: ${successCount} OK, ${failCount} Errores ---`);
}

// Province Mapping (BIRT Annex D - Official ISO Codes)
const PROVINCE_ISO_MAP = {
    "Álava": "ES-VI", "Albacete": "ES-AB", "Alicante": "ES-A", "Almería": "ES-AL", "Asturias": "ES-O", "Ávila": "ES-AV", "Badajoz": "ES-BA",
    "Baleares": "ES-PM", "Palma": "ES-PM", "Barcelona": "ES-B", "Burgos": "ES-BU", "Cáceres": "ES-CC", "Cádiz": "ES-CA", "Cantabria": "ES-S",
    "Castellón": "ES-CS", "Ciudad Real": "ES-CR", "Córdoba": "ES-CO", "La Coruña": "ES-C", "Coruña": "ES-C", "Cuenca": "ES-CU", "Gerona": "ES-GI", "Girona": "ES-GI",
    "Granada": "ES-GR", "Guadalajara": "ES-GU", "Guipúzcoa": "ES-SS", "Gipuzkoa": "ES-SS", "Huelva": "ES-H", "Huesca": "ES-HU", "Jaén": "ES-J", "León": "ES-LE",
    "Lérida": "ES-L", "Lleida": "ES-L", "Lugo": "ES-LU", "Madrid": "ES-M", "Málaga": "ES-MA", "Murcia": "ES-MU", "Navarra": "ES-NA", "Orense": "ES-OR",
    "Ourense": "ES-OR", "Palencia": "ES-P", "Las Palmas": "ES-GC", "Pontevedra": "ES-PO", "La Rioja": "ES-LO", "Salamanca": "ES-SA", "Segovia": "ES-SG",
    "Sevilla": "ES-SE", "Soria": "ES-SO", "Tarragona": "ES-T", "Santa Cruz de Tenerife": "ES-TF", "Teruel": "ES-TE", "Toledo": "ES-TO", "Valencia": "ES-V",
    "Valladolid": "ES-VA", "Vizcaya": "ES-BI", "Bizkaia": "ES-BI", "Zamora": "ES-ZA", "Zaragoza": "ES-Z", "Ceuta": "ES-CE", "Melilla": "ES-ML"
};

async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (e) { return "127.0.0.1"; }
}

async function mapLeadToApiPayload(lead) {
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

    const phoneNoPlus = (lead.phonePrefix || "").replace('+', '').trim() + (lead.phone || "").replace(/\s/g, '');

    const provinceValue = lead.province || lead.provinceText || "Madrid";

    return {
        "process_brand": (localStorage.getItem('config_brand_id') || "unie").toLowerCase(),
        "process_type": "SI",
        "process_origin": String(localStorage.getItem('config_origin') || "4"),
        "process_campaignCode": localStorage.getItem('config_campaign') || "I10002S0003",
        "process_requestDate": new Date(lead.date).toISOString().slice(0, 19).replace('T', ' '),
        "lead_name": String(lead.firstName || ""),
        "lead_surname": String(lead.lastName || ""),
        "lead_email": String(lead.email || ""),
        "lead_phoneNumber": phoneNoPlus,
        "lead_countryISO": String(lead.country || "ES"),
        "lead_province": String(provinceValue),
        "lead_provinceISO": String(provinceISO || "ES-M"),
        "lead_city": String(provinceValue), // Mapped to province for consistency
        "lead_postCode": String(localStorage.getItem('config_postcode') || "28000"),
        "lead_age": String(lead.age || "25"),
        "lead_sex": String(localStorage.getItem('config_sex') || "1"),
        "lead_treatment": "1", // Default to "Sr."
        "study_level": STUDY_LEVEL_MAP[lead.studyLevel] || "ES-6",
        "program_idProduct": String(programData.id || "0"),
        "program_idDedication": String(programData.dedication || "1"),
        "program_idCampus": String(localStorage.getItem('config_campus') || "1"),
        "program_idImpartation": String(localStorage.getItem('config_impartation') || "1"),
        "program_idTiming": String(localStorage.getItem('config_timing') || "1"),
        "rgpd_acceptContact": lead.privacy ? "1" : "0",
        "rgpd_id": String(localStorage.getItem('config_rgpd_id') || "1"),
        "url_source": window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
            ? "LOCAL_STAND_" + window.location.origin
            : window.location.origin
    };
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
        const row = document.createElement('div');
        row.className = "bg-white grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors";
        row.innerHTML = `
            <div class="col-span-6 sm:col-span-5 text-sm text-gray-900 font-medium">${name}</div>
            <div class="col-span-3 sm:col-span-3 text-sm text-gray-800 text-center font-mono uppercase text-xs">${data.id}</div>
            <div class="col-span-2 sm:col-span-3 text-sm text-gray-800 text-center font-mono uppercase text-xs">${data.dedication}</div>
            <div class="col-span-1 sm:col-span-1 text-center">
                <button onclick="deleteProgram('${name}')" class="text-custom-blue hover:text-red-600 transition-colors" title="Eliminar">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>`;
        tbody.appendChild(row);
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

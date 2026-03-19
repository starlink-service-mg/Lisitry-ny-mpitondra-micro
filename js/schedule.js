// ============================================
// 📅 Schedule Logic — Jeudi & Samedi, 2 personnes
// ============================================

let scheduleProfile = null;
let isAdminView = false;
let currentWeekOffset = 0;
let allUsers = [];
let pendingUsers = [];

// Malagasy names
const DAYS_MG = ['Alahady', 'Alatsinainy', 'Talata', 'Alarobia', 'Alakamisy', 'Zoma', 'Sabotsy'];
const MONTHS_MG = ['Janoary', 'Febroary', 'Martsa', 'Aprily', 'Mey', 'Jona', 'Jolay', 'Aogositra', 'Septambra', 'Oktobra', 'Novambra', 'Desambra'];

// ============================================
// 📅 DATE HELPERS
// ============================================

// Get the Monday of a given week (offset from current week)
function getWeekStart(offset) {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    monday.setDate(monday.getDate() + (offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
}

// Get Thursday of the week
function getThursday(offset) {
    const monday = getWeekStart(offset);
    const thursday = new Date(monday);
    thursday.setDate(monday.getDate() + 3); // Mon + 3 = Thu
    return thursday;
}

// Get Saturday of the week
function getSaturday(offset) {
    const monday = getWeekStart(offset);
    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5); // Mon + 5 = Sat
    return saturday;
}

// Format: "Alakamisy 27 Febroary 2026"
function formatDateFull(date) {
    const dayName = DAYS_MG[date.getDay()];
    const dayNum = date.getDate();
    const month = MONTHS_MG[date.getMonth()];
    const year = date.getFullYear();
    return `${dayName} ${dayNum} ${month} ${year}`;
}

// Format for DB: YYYY-MM-DD
function formatDateDB(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Week label for navigator
function getWeekLabel(offset) {
    const thursday = getThursday(offset);
    const saturday = getSaturday(offset);
    const month = MONTHS_MG[thursday.getMonth()];
    const year = thursday.getFullYear();
    return `Herinandro ${thursday.getDate()} - ${saturday.getDate()} ${month} ${year}`;
}

// ---- Change week ----
function changeWeek(direction) {
    currentWeekOffset += direction;
    updateWeekDisplay();
    loadAllSchedules();
}

function updateWeekDisplay() {
    const label = document.getElementById('week-label');
    if (label) label.textContent = getWeekLabel(currentWeekOffset);
}

// ============================================
// 🚀 INITIALIZATION
// ============================================

async function initSchedule() {
    showLoading(true);

    isAdminView = !!document.getElementById('admin-toolbar');

    if (isAdminView) {
        scheduleProfile = await requireAuth(ROLES.ADMIN);
    } else {
        scheduleProfile = await requireAuth();
        if (scheduleProfile && scheduleProfile.role === ROLES.ADMIN) {
            window.location.href = 'admin.html';
            return;
        }
    }
    if (!scheduleProfile) return;

    setupUserInfo(scheduleProfile);
    updateWeekDisplay();

    if (isAdminView) {
        await loadAllUsers();
        await loadPendingUsers();
    }

    // Load personal assignments for users
    if (!isAdminView) await loadMyAssignments();

    await loadAllSchedules();
    showLoading(false);
}

function setupUserInfo(profile) {
    const firstName = profile.full_name ? profile.full_name.split(' ')[0] : 'Mpampiasa';
    const greetingName = document.getElementById('greeting-name');
    if (greetingName) greetingName.textContent = `Salama ${firstName} 👋`;

    const navUserName = document.getElementById('nav-user-name');
    const navUserAvatar = document.getElementById('nav-user-avatar');
    if (navUserName) navUserName.textContent = profile.full_name || 'Mpampiasa';
    if (navUserAvatar) navUserAvatar.textContent = firstName.charAt(0).toUpperCase();
}

async function loadAllUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email')
            .order('full_name', { ascending: true });
        if (error) throw error;
        allUsers = data || [];
    } catch (err) {
        console.error('Error loading users:', err);
        allUsers = [];
    }
}

async function loadPendingUsers() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('id, full_name, email')
            .or('is_approved.eq.false,is_approved.is.null')
            .order('full_name', { ascending: true });
        
        if (error) throw error;
        pendingUsers = data || [];
        
        const badge = document.getElementById('pending-badge');
        if (badge) {
            if (pendingUsers.length > 0) {
                badge.textContent = pendingUsers.length;
                badge.style.display = 'flex';
            } else {
                badge.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Error loading pending users:', err);
        pendingUsers = [];
    }
}

// ============================================
// 🧑 MY PERSONAL ASSIGNMENTS
// ============================================

async function loadMyAssignments() {
    const container = document.getElementById('my-assignments-container');
    if (!container || !scheduleProfile) return;

    try {
        // Start from beginning of this week
        const weekStart = getWeekStart(0);
        const fourWeeksLater = new Date(weekStart);
        fourWeeksLater.setDate(weekStart.getDate() + 28);

        // Fetch activities separately to avoid join issues
        const { data: activities, error: actError } = await supabaseClient
            .from('activities')
            .select('id, name');

        if (actError) throw actError;

        const activityMap = {};
        if (activities) {
            activities.forEach(a => { activityMap[a.id] = a.name; });
        }

        // Fetch user's assignments
        const { data: myAssignments, error } = await supabaseClient
            .from('assignments')
            .select('*')
            .eq('assigned_user_id', scheduleProfile.id)
            .gte('schedule_date', formatDateDB(weekStart))
            .lte('schedule_date', formatDateDB(fourWeeksLater))
            .order('schedule_date', { ascending: true });

        if (error) {
            console.error('My assignments query error:', error);
            throw error;
        }

        if (!myAssignments || myAssignments.length === 0) {
            container.innerHTML = `
                <div class="my-assignments-card">
                    <div class="my-assignments-header">
                        <i data-lucide="clipboard-list" style="width:20px;height:20px;"></i>
                        <h3>Ny anjara asako</h3>
                    </div>
                    <div class="my-assignments-empty">
                        <i data-lucide="calendar-x" style="width:32px;height:32px;"></i>
                        <p>Tsy misy anjara asa mbola (Aucune affectation à venir)</p>
                    </div>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Group by date
        const grouped = {};
        myAssignments.forEach(a => {
            if (!grouped[a.schedule_date]) grouped[a.schedule_date] = [];
            grouped[a.schedule_date].push(a);
        });

        let itemsHtml = '';
        Object.keys(grouped).forEach(dateStr => {
            const date = new Date(dateStr + 'T00:00:00');
            const dayName = DAYS_MG[date.getDay()];
            const dayNum = date.getDate();
            const month = MONTHS_MG[date.getMonth()];
            const isThursday = date.getDay() === 4;
            const badgeClass = isThursday ? 'my-badge-thursday' : 'my-badge-saturday';

            itemsHtml += `<div class="my-date-group">`;
            itemsHtml += `<div class="my-date-badge ${badgeClass}">${dayName} ${dayNum} ${month}</div>`;

            grouped[dateStr].forEach(a => {
                const actName = activityMap[a.activity_id] || 'Asa';
                itemsHtml += `
                    <div class="my-assignment-item">
                        <i data-lucide="book-open" style="width:16px;height:16px;color:var(--color-primary);"></i>
                        <span>${escapeHtml(actName)}</span>
                        <span class="my-slot-badge">Olona ${a.slot_number}</span>
                    </div>
                `;
            });

            itemsHtml += `</div>`;
        });

        container.innerHTML = `
            <div class="my-assignments-card">
                <div class="my-assignments-header">
                    <i data-lucide="clipboard-list" style="width:20px;height:20px;"></i>
                    <h3>Ny anjara asako (${myAssignments.length})</h3>
                </div>
                <div class="my-assignments-body">
                    ${itemsHtml}
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (err) {
        console.error('Error loading my assignments:', err);
    }
}

// ============================================
// 📊 LOAD & RENDER BOTH TABLES
// ============================================

async function loadAllSchedules() {
    const container = document.getElementById('schedules-container');
    if (!container) return;

    const thursdayDate = getThursday(currentWeekOffset);
    const saturdayDate = getSaturday(currentWeekOffset);
    const thursdayStr = formatDateDB(thursdayDate);
    const saturdayStr = formatDateDB(saturdayDate);

    try {
        // Fetch activities
        const { data: activities, error: actErr } = await supabaseClient
            .from('activities')
            .select('*')
            .order('display_order', { ascending: true });
        if (actErr) throw actErr;

        // Fetch assignments for both dates
        const { data: assignments, error: assErr } = await supabaseClient
            .from('assignments')
            .select('*')
            .in('schedule_date', [thursdayStr, saturdayStr]);
        if (assErr) throw assErr;

        const thursdayAssignments = assignments ? assignments.filter(a => a.schedule_date === thursdayStr) : [];
        const saturdayAssignments = assignments ? assignments.filter(a => a.schedule_date === saturdayStr) : [];

        const thursdayActs = activities ? activities.filter(a => !a.day_type || a.day_type === 'roa' || a.day_type === 'alakamisy') : [];
        const saturdayActs = activities ? activities.filter(a => !a.day_type || a.day_type === 'roa' || a.day_type === 'sabotsy') : [];

        // Render both tables
        container.innerHTML = `
            <div class="schedule-section">
                <div class="schedule-section-header">
                    <div class="section-day-badge thursday-badge">
                        <i data-lucide="calendar-days" style="width:18px;height:18px;"></i>
                        ${formatDateFull(thursdayDate)}
                    </div>
                </div>
                <div class="schedule-card">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th class="th-activity"><i data-lucide="book-open" style="width:16px;height:16px;"></i> Asa</th>
                                <th class="th-person"><i data-lucide="user" style="width:16px;height:16px;"></i> Olona 1</th>
                                <th class="th-person"><i data-lucide="user" style="width:16px;height:16px;"></i> Olona 2</th>
                                ${isAdminView ? '<th class="th-actions"></th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTableBody(thursdayActs, thursdayAssignments, thursdayStr)}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="schedule-section">
                <div class="schedule-section-header">
                    <div class="section-day-badge saturday-badge">
                        <i data-lucide="calendar-days" style="width:18px;height:18px;"></i>
                        ${formatDateFull(saturdayDate)}
                    </div>
                </div>
                <div class="schedule-card">
                    <table class="schedule-table">
                        <thead>
                            <tr>
                                <th class="th-activity"><i data-lucide="book-open" style="width:16px;height:16px;"></i> Asa</th>
                                <th class="th-person"><i data-lucide="user" style="width:16px;height:16px;"></i> Olona 1</th>
                                <th class="th-person"><i data-lucide="user" style="width:16px;height:16px;"></i> Olona 2</th>
                                ${isAdminView ? '<th class="th-actions"></th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${renderTableBody(saturdayActs, saturdayAssignments, saturdayStr)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        if (typeof lucide !== 'undefined') lucide.createIcons();

    } catch (error) {
        console.error('Error loading schedules:', error);
        container.innerHTML = `
            <div class="schedule-error">
                <i data-lucide="alert-triangle" style="width:40px;height:40px;"></i>
                <p>Nisy olana tamin'ny fampidirana (Erreur de chargement)</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ---- Render table body rows ----
function renderTableBody(activities, assignments, dateStr) {
    if (!activities || activities.length === 0) {
        return `<tr><td colspan="${isAdminView ? 4 : 3}" class="empty-cell">Tsy misy asa (Aucune activité)</td></tr>`;
    }

    return activities.map(activity => {
        const slot1 = assignments.find(a => a.activity_id === activity.id && a.slot_number === 1);
        const slot2 = assignments.find(a => a.activity_id === activity.id && a.slot_number === 2);

        const person1 = renderPersonCell(slot1);
        const person2 = renderPersonCell(slot2);

        const actions = isAdminView ? `
            <td class="actions-cell">
                <div class="action-buttons">
                    <button class="btn-icon" onclick="openAssignModal(${activity.id}, '${escapeHtml(activity.name)}', '${dateStr}', 1)" title="Afidio Olona 1">
                        <i data-lucide="user-plus" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="btn-icon" onclick="openAssignModal(${activity.id}, '${escapeHtml(activity.name)}', '${dateStr}', 2)" title="Afidio Olona 2">
                        <i data-lucide="user-plus" style="width:16px;height:16px;"></i>
                    </button>
                    <button class="btn-icon btn-danger-icon" onclick="deleteActivity(${activity.id}, '${escapeHtml(activity.name)}')" title="Hamafa (Supprimer)">
                        <i data-lucide="trash-2" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            </td>
        ` : '';

        return `
            <tr>
                <td class="activity-cell">
                    <i data-lucide="book-open" style="width:18px;height:18px;color:var(--color-primary);"></i>
                    <span>${escapeHtml(activity.name)}</span>
                </td>
                <td class="user-cell">${person1}</td>
                <td class="user-cell">${person2}</td>
                ${actions}
            </tr>
        `;
    }).join('');
}

// ---- Render person cell ----
function renderPersonCell(assignment) {
    if (!assignment || !assignment.assigned_user_name) {
        return '<span class="unassigned">—</span>';
    }
    const name = assignment.assigned_user_name;
    return `
        <div class="assigned-user">
            <div class="assigned-avatar">${name.charAt(0).toUpperCase()}</div>
            <span>${escapeHtml(name)}</span>
        </div>
    `;
}

// ============================================
// 🔧 ADMIN: ASSIGN USER
// ============================================

function openAssignModal(activityId, activityName, dateStr, slotNumber) {
    const modal = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');

    const usersOptions = allUsers.map(u =>
        `<option value="${u.id}" data-name="${escapeHtml(u.full_name || u.email)}">${escapeHtml(u.full_name || u.email)}</option>`
    ).join('');

    modalTitle.textContent = `Afidio — Olona ${slotNumber}`;
    modalBody.innerHTML = `
        <p style="margin-bottom:12px;color:var(--color-text-secondary);">
            Asa: <strong style="color:var(--color-primary);">${escapeHtml(activityName)}</strong>
        </p>
        <p style="margin-bottom:4px;font-size:13px;color:var(--color-text-muted);">
            Daty: <strong>${dateStr}</strong> · Olona: <strong>${slotNumber}</strong>
        </p>
        <div class="form-group" style="margin-top:16px;">
            <label for="assign-user">Mpampiasa</label>
            <select id="assign-user" style="width:100%;padding:12px 16px;border:2px solid var(--color-border);border-radius:var(--radius-md);font-size:15px;font-family:var(--font-family);background:var(--color-card);color:var(--color-text-primary);">
                <option value="">-- Safidio --</option>
                ${usersOptions}
                <option value="__none__">❌ Esory (Retirer)</option>
            </select>
        </div>
    `;
    modalFooter.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Akatona</button>
        <button class="btn btn-primary btn-sm" onclick="saveAssignment(${activityId}, '${dateStr}', ${slotNumber})">
            <i data-lucide="check" style="width:16px;height:16px;"></i> Tehirizina
        </button>
    `;

    modal.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function saveAssignment(activityId, dateStr, slotNumber) {
    const select = document.getElementById('assign-user');
    const userId = select.value;

    if (!userId) {
        showToast('Safidio mpampiasa azafady', 'error');
        return;
    }

    try {
        if (userId === '__none__') {
            await supabaseClient
                .from('assignments')
                .delete()
                .eq('activity_id', activityId)
                .eq('schedule_date', dateStr)
                .eq('slot_number', slotNumber);

            closeModal();
            showToast('Voaesotra', 'success');
        } else {
            const selectedOption = select.options[select.selectedIndex];
            const userName = selectedOption.getAttribute('data-name');

            const { error } = await supabaseClient
                .from('assignments')
                .upsert({
                    activity_id: activityId,
                    assigned_user_id: userId,
                    assigned_user_name: userName,
                    schedule_date: dateStr,
                    slot_number: slotNumber,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'activity_id,schedule_date,slot_number'
                });

            if (error) throw error;

            closeModal();
            showToast(`${userName} voatendry!`, 'success');
        }

        await loadAllSchedules();

    } catch (error) {
        showToast('Nisy olana: ' + error.message, 'error');
    }
}

// ============================================
// 🔧 ADMIN: MANAGE APPROVALS
// ============================================

function openPendingModal() {
    const modal = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');

    modalTitle.textContent = 'Fankatoavana Mpampiasa (Approbations)';
    
    if (pendingUsers.length === 0) {
        modalBody.innerHTML = '<p style="color:var(--color-text-muted); text-align:center;">Tsy misy mpampiasa miandry (Aucun utilisateur en attente)</p>';
    } else {
        const usersList = pendingUsers.map(u => `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--color-border);">
                <div>
                    <strong>${escapeHtml(u.full_name || u.email)}</strong><br>
                    <small style="color:var(--color-text-muted);">${escapeHtml(u.email)}</small>
                </div>
                <button class="btn btn-primary btn-sm" onclick="approveUser('${u.id}', '${escapeHtml(u.full_name || u.email)}')">
                    <i data-lucide="check" style="width:14px;height:14px;"></i> Ankasitrahana
                </button>
            </div>
        `).join('');
        modalBody.innerHTML = `<div style="max-height: 300px; overflow-y: auto;">${usersList}</div>`;
    }

    modalFooter.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Akatona (Fermer)</button>
    `;

    modal.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function approveUser(userId, userName) {
    if (!confirm(`Hanaiky an'i "${userName}" marina ve?\n(Approuver cet utilisateur ?)`)) return;
    
    showLoading(true);
    try {
        const { error } = await supabaseClient
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', userId);
            
        if (error) throw error;
        
        showToast(`"${userName}" nankatoavina! (Approuvé)`, 'success');
        await loadPendingUsers(); 
        await loadAllUsers(); 
        
        openPendingModal();
    } catch (error) {
        showToast('Nisy olana: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ============================================
// 🔧 ADMIN: ADD ACTIVITY
// ============================================

function openAddActivityModal() {
    const modal = document.getElementById('modal-overlay');
    document.getElementById('modal-title').textContent = 'Asa vaovao';
    document.getElementById('modal-body').innerHTML = `
        <div class="form-group">
            <label for="activity-name">Anaran'ny asa</label>
            <input type="text" id="activity-name" placeholder="Ex: Vatosoa ara panahy" />
        </div>
        <div class="form-group">
            <label for="activity-day">Andro (Jour)</label>
            <select id="activity-day" style="width:100%;padding:10px;border:2px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:15px;background:var(--color-card);color:var(--color-text-primary);">
                <option value="roa">Roa (Alakamisy & Sabotsy)</option>
                <option value="alakamisy">Alakamisy (Jeudi uniq.)</option>
                <option value="sabotsy">Sabotsy (Samedi uniq.)</option>
            </select>
        </div>
        <div class="form-group">
            <label for="activity-order">Laharana</label>
            <input type="number" id="activity-order" value="1" min="1" />
        </div>
    `;
    document.getElementById('modal-footer').innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Akatona</button>
        <button class="btn btn-primary btn-sm" onclick="saveNewActivity()">
            <i data-lucide="save" style="width:16px;height:16px;"></i> Tehirizina
        </button>
    `;
    modal.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();
    document.getElementById('activity-name').focus();
}

async function saveNewActivity() {
    const name = document.getElementById('activity-name').value.trim();
    const order = parseInt(document.getElementById('activity-order').value) || 1;
    const dayType = document.getElementById('activity-day').value;
    if (!name) { showToast('Fenoy ny anarana azafady', 'error'); return; }

    try {
        const { error } = await supabaseClient.from('activities').insert({ name, display_order: order, day_type: dayType });
        if (error) throw error;
        closeModal();
        showToast('Asa vaovao nampidirina!', 'success');
        await loadAllSchedules();
    } catch (error) {
        showToast('Nisy olana: ' + error.message, 'error');
    }
}

// ============================================
// 🗑️ ADMIN: DELETE ACTIVITY
// ============================================

async function deleteActivity(activityId, activityName) {
    if (!confirm(`Hamafa ny asa "${activityName}" marina ve?\n(Supprimer cette activité ?)`)) return;

    try {
        // Delete all assignments for this activity first
        await supabaseClient.from('assignments').delete().eq('activity_id', activityId);

        // Delete the activity
        const { error } = await supabaseClient.from('activities').delete().eq('id', activityId);
        if (error) throw error;

        showToast(`"${activityName}" voafafa!`, 'success');
        await loadAllSchedules();
    } catch (error) {
        showToast('Nisy olana: ' + error.message, 'error');
    }
}

// ============================================
// 🖨️ PRINT — 2 semaines sur A4
// ============================================

async function printSchedule() {
    showLoading(true);

    try {
        const week1Thu = getThursday(currentWeekOffset);
        const week1Sat = getSaturday(currentWeekOffset);
        const week2Thu = getThursday(currentWeekOffset + 1);
        const week2Sat = getSaturday(currentWeekOffset + 1);

        const allDates = [
            formatDateDB(week1Thu), formatDateDB(week1Sat),
            formatDateDB(week2Thu), formatDateDB(week2Sat)
        ];

        const { data: activities, error: actErr } = await supabaseClient
            .from('activities').select('*').order('display_order', { ascending: true });
        if (actErr) throw actErr;

        const { data: assignments, error: assErr } = await supabaseClient
            .from('assignments').select('*').in('schedule_date', allDates);
        if (assErr) throw assErr;

        const tables = [
            { label: formatDateFull(week1Thu), dateStr: allDates[0], type: 'thursday', week: 1 },
            { label: formatDateFull(week1Sat), dateStr: allDates[1], type: 'saturday', week: 1 },
            { label: formatDateFull(week2Thu), dateStr: allDates[2], type: 'thursday', week: 2 },
            { label: formatDateFull(week2Sat), dateStr: allDates[3], type: 'saturday', week: 2 },
        ];

        let printHtml = `
            <div class="print-header">
                <h1>📋 Fandaharam-potoana</h1>
                <p>Natonta: ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
        `;

        tables.forEach(t => {
            const dayAss = assignments ? assignments.filter(a => a.schedule_date === t.dateStr) : [];
            let rows = '';
            if (activities && activities.length > 0) {
                const filteredActs = t.type === 'thursday' 
                    ? activities.filter(a => !a.day_type || a.day_type === 'roa' || a.day_type === 'alakamisy')
                    : activities.filter(a => !a.day_type || a.day_type === 'roa' || a.day_type === 'sabotsy');

                filteredActs.forEach(act => {
                    const s1 = dayAss.find(a => a.activity_id === act.id && a.slot_number === 1);
                    const s2 = dayAss.find(a => a.activity_id === act.id && a.slot_number === 2);
                    const p1 = s1 ? `<span class="print-avatar">${s1.assigned_user_name.charAt(0).toUpperCase()}</span>${s1.assigned_user_name}` : '<span class="print-empty">— tsy voatendry —</span>';
                    const p2 = s2 ? `<span class="print-avatar">${s2.assigned_user_name.charAt(0).toUpperCase()}</span>${s2.assigned_user_name}` : '<span class="print-empty">— tsy voatendry —</span>';
                    rows += `<tr>
                        <td class="print-activity">📖 ${act.name}</td>
                        <td class="print-person">${p1}</td>
                        <td class="print-person">${p2}</td>
                    </tr>`;
                });
            }
            printHtml += `
                <div class="print-table-section">
                    <h2 class="print-day-label print-${t.type}">📅 Herinandro ${t.week} — ${t.label}</h2>
                    <table class="print-table">
                        <thead><tr>
                            <th style="width:40%">Asa (Activité)</th>
                            <th style="width:30%">Olona 1</th>
                            <th style="width:30%">Olona 2</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        });

        let pc = document.getElementById('print-container');
        if (!pc) { pc = document.createElement('div'); pc.id = 'print-container'; document.body.appendChild(pc); }
        pc.innerHTML = printHtml;

        showLoading(false);
        setTimeout(() => window.print(), 300);

    } catch (error) {
        showLoading(false);
        showToast('Nisy olana: ' + error.message, 'error');
    }
}

// ============================================
// 🛠️ UTILITIES
// ============================================

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('active');
}
document.addEventListener('click', (e) => { if (e.target.id === 'modal-overlay') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoading(show) {
    const loader = document.getElementById('loading-overlay');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}" style="width:20px;height:20px;"></i> ${message}`;
    container.appendChild(toast);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => { initSchedule(); });

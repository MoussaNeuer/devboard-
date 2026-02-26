// ===== VARIABLES GLOBALES =====
let tasks = []
let activityLogs = []
let currentFilter = 'all'
let currentLogFilter = 'all'
let editingTaskId = null


// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard chargé')
    
    // Vérifier session
    const session = JSON.parse(localStorage.getItem('devboard-session'))
    if (!session) {
        window.location.href = 'index.html'
        return
    }
    
    // Charger utilisateur
    const users = JSON.parse(localStorage.getItem('devboard-users')) || []
    currentUser = users.find(u => u.id === session.userId)
    
    if (!currentUser) {
        window.location.href = 'index.html'
        return
    }
    
    // Initialiser
    initUI()
    loadTasks()
    loadLogs()
    loadUsers()
    initTheme()
    setupEvents()
})

function initUI() {
    document.getElementById('userInfo').textContent = `${currentUser.firstName} ${currentUser.lastName}`
    document.getElementById('userRole').textContent = `(${currentUser.role})`
    
    // Permission badge
    const badge = document.getElementById('permissionBadge')
    if (badge) {
        badge.innerHTML = `<i class="fas fa-key"></i> ${currentUser.permissions.join(' · ')}`
    }
    
    // Cacher add task si pas permission
    if (!hasPermission('create')) {
        document.getElementById('addTaskSection').style.display = 'none'
    }
}

function hasPermission(action) {
    return currentUser.permissions.includes('all') || currentUser.permissions.includes(action)
}

function setupEvents() {
    // Déconnexion
    document.querySelector('.logout-btn').addEventListener('click', logout)
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme)
    
    // Ajout tâche
    document.getElementById('addTaskBtn').addEventListener('click', addTask)
    document.getElementById('taskInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTask()
    })
    
    // Filtres
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentFilter = e.target.dataset.filter
            renderTasks()
        })
    })
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
            
            e.target.classList.add('active')
            document.getElementById(e.target.dataset.tab + '-tab').classList.add('active')
            
            if (e.target.dataset.tab === 'users') renderUsers()
            if (e.target.dataset.tab === 'logs') renderLogs()
        })
    })
    
    // Log filters
    document.querySelectorAll('[data-log-type]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-log-type]').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentLogFilter = e.target.dataset.logType
            renderLogs()
        })
    })
    
    // Settings
    document.getElementById('darkModeSetting').addEventListener('change', (e) => {
        if (e.target.checked) {
            document.body.classList.add('dark-mode')
            localStorage.setItem('devboard-theme', 'dark')
        } else {
            document.body.classList.remove('dark-mode')
            localStorage.setItem('devboard-theme', 'light')
        }
    })
    
    // Export/Import
    document.querySelector('[onclick="exportData()"]')?.addEventListener('click', exportData)
    document.querySelector('[onclick="importData()"]')?.addEventListener('click', importData)
    document.querySelector('[onclick="clearAllData()"]')?.addEventListener('click', clearAllData)
    document.querySelector('[onclick="clearLogs()"]')?.addEventListener('click', clearLogs)
}

// ===== TÂCHES =====
function addTask() {
    if (!hasPermission('create')) {
        showNotification('⛔ Permission refusée', 'error')
        return
    }
    
    const input = document.getElementById('taskInput')
    const name = input.value.trim()
    if (!name) return showNotification('Entre un nom de tâche', 'warning')
    
    const newTask = {
        id: Date.now(),
        name: name,
        status: 'inProgress',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.username,
        createdByName: `${currentUser.firstName} ${currentUser.lastName}`,
        comments: []
    }
    
    tasks.push(newTask)
    saveTasks()
    logActivity(`Tâche créée: "${name}"`, 'info')
    
    input.value = ''
    renderTasks()
    showNotification('✅ Tâche ajoutée', 'success')
}

function toggleTaskStatus(id) {
    if (!hasPermission('edit')) {
        showNotification('⛔ Permission refusée', 'error')
        return
    }
    
    const task = tasks.find(t => t.id == id)
    if (task) {
        task.status = task.status === 'inProgress' ? 'completed' : 'inProgress'
        task.updatedAt = new Date().toISOString()
        saveTasks()
        logActivity(`Tâche "${task.name}" ${task.status === 'completed' ? 'terminée' : 'reprise'}`, 'info')
        renderTasks()
    }
}

function editTask(id) {
    if (!hasPermission('edit')) {
        showNotification('⛔ Permission refusée', 'error')
        return
    }
    
    const task = tasks.find(t => t.id == id)
    const newName = prompt('Modifier la tâche:', task.name)
    if (newName && newName.trim()) {
        task.name = newName.trim()
        task.updatedAt = new Date().toISOString()
        saveTasks()
        logActivity(`Tâche modifiée`, 'info')
        renderTasks()
        showNotification('✅ Tâche modifiée', 'success')
    }
}

function deleteTask(id) {
    if (!hasPermission('delete')) {
        showNotification('⛔ Permission refusée', 'error')
        return
    }
    
    const task = tasks.find(t => t.id == id)
    if (confirm(`Supprimer "${task.name}" ?`)) {
        tasks = tasks.filter(t => t.id != id)
        saveTasks()
        logActivity(`Tâche supprimée: "${task.name}"`, 'warning')
        renderTasks()
        showNotification('🗑️ Tâche supprimée', 'warning')
    }
}

function addComment(taskId) {
    const comment = prompt('Ajouter un commentaire:')
    if (comment) {
        const task = tasks.find(t => t.id == taskId)
        if (!task.comments) task.comments = []
        task.comments.push({
            text: comment,
            user: currentUser.username,
            date: new Date().toISOString()
        })
        saveTasks()
        renderTasks()
    }
}

function renderTasks() {
    const container = document.getElementById('tasksContainer')
    if (!container) return
    
    let filtered = [...tasks]
    
    if (currentFilter === 'inProgress') filtered = filtered.filter(t => t.status === 'inProgress')
    if (currentFilter === 'completed') filtered = filtered.filter(t => t.status === 'completed')
    if (currentFilter === 'myTasks') filtered = filtered.filter(t => t.createdBy === currentUser.username)
    
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-tasks empty-icon"></i>
                <p>Aucune tâche</p>
                ${hasPermission('create') ? '<small>Clique sur <i class="fas fa-plus"></i> pour commencer</small>' : ''}
            </div>
        `
        return
    }
    
    let html = ''
    filtered.forEach(task => {
        const date = new Date(task.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
        })
        
        const comments = task.comments?.length || 0
        
        html += `
            <div class="task-item ${task.status}" data-id="${task.id}">
                <div class="task-checkbox">
                    <input type="checkbox" 
                           ${task.status === 'completed' ? 'checked' : ''} 
                           onchange="toggleTaskStatus(${task.id})"
                           ${!hasPermission('edit') ? 'disabled' : ''}>
                </div>
                
                <div class="task-content">
                    <div class="task-name ${task.status === 'completed' ? 'completed' : ''}">
                        ${escapeHtml(task.name)}
                    </div>
                    <div class="task-meta">
                        <span><i class="far fa-calendar"></i> ${date}</span>
                        <span><i class="far fa-user"></i> ${task.createdByName}</span>
                        ${comments > 0 ? `<span><i class="far fa-comment"></i> ${comments}</span>` : ''}
                    </div>
                </div>
                
                <div class="task-actions">
                    <button class="icon-btn comment-btn" onclick="addComment(${task.id})" title="Commenter">
                        <i class="far fa-comment"></i>
                    </button>
                    
                    ${hasPermission('edit') ? `
                        <button class="icon-btn edit-btn" onclick="editTask(${task.id})" title="Modifier">
                            <i class="fas fa-pencil-alt"></i>
                        </button>
                    ` : ''}
                    
                    ${hasPermission('delete') ? `
                        <button class="icon-btn delete-btn" onclick="deleteTask(${task.id})" title="Supprimer">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `
    })
    
    container.innerHTML = html
    updateStats()
}

function updateStats() {
    const total = tasks.length
    const inProgress = tasks.filter(t => t.status === 'inProgress').length
    const completed = tasks.filter(t => t.status === 'completed').length
    const rate = total ? Math.round((completed / total) * 100) : 0
    
    document.getElementById('totalTasks').textContent = total
    document.getElementById('inProgress').textContent = inProgress
    document.getElementById('completed').textContent = completed
    document.getElementById('completionRate').textContent = rate + '%'
}

// ===== UTILISATEURS =====
function loadUsers() {
    renderUsers()
}

function renderUsers() {
    const list = document.getElementById('usersList')
    if (!list) return
    
    const users = JSON.parse(localStorage.getItem('devboard-users')) || []
    
    let html = ''
    users.forEach(user => {
        const isCurrent = user.id === currentUser.id
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'
        
        html += `
            <div class="user-card ${isCurrent ? 'current' : ''}">
                <div class="user-avatar" style="background: ${user.color}">
                    ${user.firstName.charAt(0)}${user.lastName.charAt(0)}
                </div>
                <div class="user-info">
                    <h4>${user.firstName} ${user.lastName} ${isCurrent ? '<span class="badge">Vous</span>' : ''}</h4>
                    <p><i class="fas fa-tag"></i> @${user.username}</p>
                    <div class="user-meta">
                        <span class="role-badge ${user.role}">
                            ${user.role === 'admin' ? '👑' : user.role === 'dev' ? '💻' : '👁️'} ${user.role}
                        </span>
                        <span><i class="far fa-envelope"></i> ${user.email}</span>
                    </div>
                    <div class="user-footer">
                        <small><i class="far fa-calendar-alt"></i> ${new Date(user.createdAt).toLocaleDateString()}</small>
                        <small><i class="fas fa-history"></i> ${lastLogin}</small>
                    </div>
                </div>
            </div>
        `
    })
    
    list.innerHTML = html
    
    // Sessions
    const sessionsList = document.getElementById('sessionsList')
    if (sessionsList) {
        const active = users.filter(u => u.lastLogin).slice(0, 3)
        sessionsList.innerHTML = active.map(u => `
            <div class="session-item">
                <i class="fas fa-circle" style="color: #06d6a0; font-size: 0.5rem;"></i>
                <span>${u.firstName} ${u.lastName}</span>
                <small>${new Date(u.lastLogin).toLocaleTimeString()}</small>
            </div>
        `).join('') || '<p>Aucune session</p>'
    }
}

// ===== LOGS =====
function loadLogs() {
    activityLogs = JSON.parse(localStorage.getItem('devboard-activity-logs')) || []
    renderLogs()
}

function logActivity(action, type = 'info') {
    activityLogs.unshift({
        id: Date.now(),
        action,
        user: currentUser.username,
        timestamp: new Date().toISOString(),
        type
    })
    if (activityLogs.length > 100) activityLogs.pop()
    localStorage.setItem('devboard-activity-logs', JSON.stringify(activityLogs))
    renderLogs()
}

function renderLogs() {
    const container = document.getElementById('activityLogs')
    if (!container) return
    
    let filtered = [...activityLogs]
    if (currentLogFilter !== 'all') {
        filtered = filtered.filter(l => l.type === currentLogFilter)
    }
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-logs"><i class="fas fa-scroll"></i> Aucun log</div>'
        return
    }
    
    let html = ''
    filtered.slice(0, 30).forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString()
        html += `
            <div class="log-entry ${log.type}">
                <span class="log-time">${time}</span>
                <span class="log-user"><i class="fas fa-user"></i> ${log.user}</span>
                <span class="log-action">${log.action}</span>
                <span class="log-badge ${log.type}">${log.type}</span>
            </div>
        `
    })
    
    container.innerHTML = html
}

function clearLogs() {
    if (!hasPermission('admin')) return showNotification('Permission refusée', 'error')
    if (confirm('Effacer tous les logs ?')) {
        activityLogs = []
        localStorage.removeItem('devboard-activity-logs')
        renderLogs()
        showNotification('Logs effacés', 'success')
    }
}

// ===== SAUVEGARDE =====
function loadTasks() {
    tasks = JSON.parse(localStorage.getItem('devboard-tasks')) || [
        {
            id: 1,
            name: 'Bienvenue sur DevBoard Pro !',
            status: 'inProgress',
            createdAt: new Date().toISOString(),
            createdBy: 'admin',
            createdByName: 'Admin System'
        }
    ]
    renderTasks()
}

function saveTasks() {
    localStorage.setItem('devboard-tasks', JSON.stringify(tasks))
    updateStats()
}

// ===== EXPORT/IMPORT =====
function exportData() {
    const data = { tasks, logs: activityLogs }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `devboard-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    showNotification('Données exportées', 'success')
}

function importData() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = e => {
        const file = e.target.files[0]
        const reader = new FileReader()
        reader.onload = e => {
            try {
                const data = JSON.parse(e.target.result)
                if (data.tasks) tasks = data.tasks
                if (data.logs) activityLogs = data.logs
                saveTasks()
                localStorage.setItem('devboard-activity-logs', JSON.stringify(activityLogs))
                renderTasks()
                renderLogs()
                showNotification('Import réussi', 'success')
            } catch {
                showNotification('Fichier invalide', 'error')
            }
        }
        reader.readAsText(file)
    }
    input.click()
}

function clearAllData() {
    if (!hasPermission('admin')) return showNotification('Permission refusée', 'error')
    if (confirm('⚠️ Réinitialiser TOUT ?')) {
        tasks = []
        activityLogs = []
        localStorage.removeItem('devboard-tasks')
        localStorage.removeItem('devboard-activity-logs')
        renderTasks()
        renderLogs()
        showNotification('Données réinitialisées', 'warning')
    }
}

// ===== THÈME =====
function initTheme() {
    const saved = localStorage.getItem('devboard-theme')
    if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.body.classList.add('dark-mode')
        document.getElementById('themeToggle').innerHTML = '<i class="fas fa-sun"></i>'
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode')
    const isDark = document.body.classList.contains('dark-mode')
    localStorage.setItem('devboard-theme', isDark ? 'dark' : 'light')
    document.getElementById('themeToggle').innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'
}

// ===== UTILS =====
function logout() {
    localStorage.removeItem('devboard-session')
    window.location.href = 'index.html'
}

function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

function showNotification(message, type = 'info') {
    const icons = {
        success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️'
    }
    
    const notif = document.createElement('div')
    notif.className = `notification ${type}`
    notif.innerHTML = `
        <span class="icon">${icons[type]}</span>
        <span>${message}</span>
    `
    document.body.appendChild(notif)
    
    setTimeout(() => notif.classList.add('show'), 10)
    setTimeout(() => {
        notif.classList.remove('show')
        setTimeout(() => notif.remove(), 300)
    }, 3000)
}
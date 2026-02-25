// ===== VARIABLES GLOBALES =====
let currentUser = null
let tasks = []
let activityLogs = []
let currentFilter = 'all'
let currentLogFilter = 'all'
let editingTaskId = null
let pendingAction = null

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initialisation du dashboard...')
    
    // Vérifier la session
    const session = checkSession()
    if (!session) {
        window.location.href = 'index.html'
        return
    }
    
    // Charger l'utilisateur courant
    loadCurrentUser(session)
    
    // Initialiser l'interface
    initializeDashboard()
    
    // Charger les données
    loadTasks()
    loadActivityLogs()
    loadUsers()
    
    // Configurer les événements
    setupEventListeners()
    
    // Initialiser le thème
    initTheme()
    
    console.log('✅ Dashboard initialisé avec succès')
})

function checkSession() {
    const session = JSON.parse(localStorage.getItem('devboard-session'))
    
    if (!session) return null
    
    // Vérifier expiration
    if (new Date(session.expiresAt) < new Date()) {
        logout()
        return null
    }
    
    return session
}

function loadCurrentUser(session) {
    const users = JSON.parse(localStorage.getItem('devboard-users')) || []
    currentUser = users.find(u => u.id === session.userId)
    
    if (!currentUser) {
        logout()
        return
    }
}

// ===== INITIALISATION DE L'INTERFACE =====
function initializeDashboard() {
    // Afficher les infos utilisateur
    document.getElementById('userInfo').textContent = `${currentUser.firstName} ${currentUser.lastName}`
    document.getElementById('userRole').textContent = `(${currentUser.role})`
    
    // Afficher les permissions
    updatePermissionUI()
    
    // Adapter l'interface selon les permissions
    adaptUIToPermissions()
    
    // Afficher le compteur en ligne
    updateOnlineCount()
}

function updatePermissionUI() {
    const badge = document.getElementById('permissionBadge')
    if (badge) {
        badge.textContent = `🔑 ${currentUser.permissions.join(' · ')}`
    }
}

function adaptUIToPermissions() {
    // Cacher le formulaire d'ajout si pas la permission
    if (!hasPermission('create')) {
        const addSection = document.getElementById('addTaskSection')
        if (addSection) addSection.style.display = 'none'
    }
    
    // Désactiver les actions si pas les permissions
    if (!hasPermission('edit') && !hasPermission('delete')) {
        document.querySelectorAll('.task-actions button').forEach(btn => {
            btn.disabled = true
            btn.style.opacity = '0.5'
            btn.title = 'Permission requise'
        })
    }
}

// ===== GESTION DES PERMISSIONS =====
function hasPermission(action) {
    return currentUser.permissions.includes('all') || 
           currentUser.permissions.includes(action)
}

// ===== CONFIGURATION DES ÉVÉNEMENTS =====
function setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle')
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme)
    }
    
    // Add task
    const addBtn = document.getElementById('addTaskBtn')
    if (addBtn) {
        addBtn.addEventListener('click', addTask)
    }
    
    // Task input enter key
    const taskInput = document.getElementById('taskInput')
    if (taskInput) {
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTask()
        })
    }
    
    // Filtres de tâches
    document.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentFilter = e.target.dataset.filter
            renderTasks()
        })
    })
    
    // Tabs principaux
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'))
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'))
            
            e.target.classList.add('active')
            const tabId = e.target.dataset.tab + '-tab'
            document.getElementById(tabId).classList.add('active')
            
            // Rafraîchir le contenu si nécessaire
            if (e.target.dataset.tab === 'users') {
                renderUsers()
                renderSessions()
            } else if (e.target.dataset.tab === 'logs') {
                renderLogs()
            }
        })
    })
    
    // Filtres de logs
    document.querySelectorAll('[data-log-type]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('[data-log-type]').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentLogFilter = e.target.dataset.logType
            renderLogs()
        })
    })
    
    // Paramètres
    const darkModeSetting = document.getElementById('darkModeSetting')
    if (darkModeSetting) {
        darkModeSetting.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('dark-mode')
                localStorage.setItem('devboard-theme', 'dark')
            } else {
                document.body.classList.remove('dark-mode')
                localStorage.setItem('devboard-theme', 'light')
            }
        })
    }
    
    const autoSaveSetting = document.getElementById('autoSaveSetting')
    if (autoSaveSetting) {
        autoSaveSetting.addEventListener('change', (e) => {
            localStorage.setItem('devboard-autosave', e.target.checked)
        })
    }
}

// ===== GESTION DES TÂCHES =====
function addTask() {
    if (!hasPermission('create')) {
        showNotification('⛔ Tu n\'as pas la permission de créer des tâches', 'error')
        logActivity('Tentative de création non autorisée', 'warning')
        return
    }
    
    const input = document.getElementById('taskInput')
    const taskName = input.value.trim()
    
    if (!taskName) {
        showNotification('Veuillez entrer un nom de tâche', 'warning')
        return
    }
    
    const newTask = {
        id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        name: taskName,
        status: 'inProgress',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.username,
        createdById: currentUser.id,
        createdByName: `${currentUser.firstName} ${currentUser.lastName}`,
        order: tasks.length
    }
    
    tasks.push(newTask)
    saveTasks()
    logActivity(`Tâche créée: "${taskName}"`, 'info')
    
    input.value = ''
    renderTasks()
    showNotification('✅ Tâche ajoutée avec succès', 'success')
}

function toggleTaskStatus(taskId) {
    if (!hasPermission('edit')) {
        showNotification('⛔ Permission refusée', 'error')
        return
    }
    
    const task = tasks.find(t => t.id === taskId)
    if (task) {
        task.status = task.status === 'inProgress' ? 'completed' : 'inProgress'
        task.updatedAt = new Date().toISOString()
        task.updatedBy = currentUser.username
        
        saveTasks()
        logActivity(`Tâche "${task.name}" marquée comme ${task.status === 'completed' ? 'terminée' : 'en cours'}`, 'info')
        renderTasks()
        showNotification(`Tâche ${task.status === 'completed' ? 'terminée' : 'reprise'}`, 'success')
    }
}

function openEditModal(taskId) {
    if (!hasPermission('edit')) {
        showNotification('⛔ Permission refusée', 'error')
        return
    }
    
    const task = tasks.find(t => t.id === taskId)
    if (task) {
        editingTaskId = taskId
        document.getElementById('editTaskInput').value = task.name
        document.getElementById('editModal').classList.add('active')
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active')
    editingTaskId = null
}

function confirmEdit() {
    const newName = document.getElementById('editTaskInput').value.trim()
    
    if (!newName) {
        showNotification('Le nom ne peut pas être vide', 'warning')
        return
    }
    
    const task = tasks.find(t => t.id === editingTaskId)
    if (task) {
        const oldName = task.name
        task.name = newName
        task.updatedAt = new Date().toISOString()
        task.updatedBy = currentUser.username
        
        saveTasks()
        logActivity(`Tâche modifiée: "${oldName}" → "${newName}"`, 'info')
        renderTasks()
        showNotification('✅ Tâche modifiée avec succès', 'success')
    }
    
    closeEditModal()
}

function confirmDelete(taskId) {
    if (!hasPermission('delete')) {
        showNotification('⛔ Permission refusée', 'error')
        return
    }
    
    const task = tasks.find(t => t.id === taskId)
    if (task) {
        pendingAction = () => {
            tasks = tasks.filter(t => t.id !== taskId)
            saveTasks()
            logActivity(`Tâche supprimée: "${task.name}"`, 'warning')
            renderTasks()
            showNotification('🗑️ Tâche supprimée', 'warning')
        }
        
        document.getElementById('confirmMessage').textContent = `Supprimer la tâche "${task.name}" ?`
        document.getElementById('confirmModal').classList.add('active')
    }
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active')
    pendingAction = null
}

function executeConfirmedAction() {
    if (pendingAction) {
        pendingAction()
        pendingAction = null
    }
    closeConfirmModal()
}

function renderTasks() {
    const container = document.getElementById('tasksContainer')
    if (!container) return
    
    console.log('Rendu des tâches...')
    
    let filteredTasks = [...tasks]
    
    // Appliquer les filtres
    switch(currentFilter) {
        case 'inProgress':
            filteredTasks = filteredTasks.filter(t => t.status === 'inProgress')
            break
        case 'completed':
            filteredTasks = filteredTasks.filter(t => t.status === 'completed')
            break
        case 'myTasks':
            filteredTasks = filteredTasks.filter(t => t.createdBy === currentUser.username)
            break
        default: // 'all'
            break
    }
    
    // Trier par ordre et date
    filteredTasks.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order
        }
        return new Date(b.createdAt) - new Date(a.createdAt)
    })
    
    if (filteredTasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <p>Aucune tâche à afficher</p>
                ${hasPermission('create') ? 
                    '<small>Clique sur "Ajouter" pour créer ta première tâche</small>' : 
                    '<small>Aucune tâche disponible</small>'}
            </div>
        `
        return
    }
    
    let html = ''
    filteredTasks.forEach(task => {
        const createdDate = new Date(task.createdAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        
        const isCreator = task.createdBy === currentUser.username
        
        html += `
            <div class="task-item ${task.status}" data-id="${task.id}">
                <div class="task-checkbox-wrapper">
                    <input type="checkbox" 
                           class="task-checkbox" 
                           ${task.status === 'completed' ? 'checked' : ''}
                           onchange="toggleTaskStatus('${task.id}')"
                           ${!hasPermission('edit') ? 'disabled' : ''}>
                </div>
                
                <div class="task-content">
                    <div class="task-name ${task.status === 'completed' ? 'task-completed' : ''}">
                        ${escapeHtml(task.name)}
                    </div>
                    <div class="task-meta">
                        <span class="meta-item">
                            <span class="meta-icon">📅</span>
                            ${createdDate}
                        </span>
                        <span class="meta-item">
                            <span class="meta-icon">👤</span>
                            ${task.createdByName || task.createdBy}
                        </span>
                        ${task.updatedBy ? `
                            <span class="meta-item">
                                <span class="meta-icon">✏️</span>
                                Modifiée
                            </span>
                        ` : ''}
                        ${isCreator ? `
                            <span class="badge creator-badge">Créateur</span>
                        ` : ''}
                    </div>
                </div>
                
                <div class="task-actions">
                    ${hasPermission('edit') ? `
                        <button class="action-btn edit-btn" onclick="openEditModal('${task.id}')" title="Modifier">
                            ✏️
                        </button>
                    ` : ''}
                    
                    ${hasPermission('delete') ? `
                        <button class="action-btn delete-btn" onclick="confirmDelete('${task.id}')" title="Supprimer">
                            🗑️
                        </button>
                    ` : ''}
                </div>
            </div>
        `
    })
    
    container.innerHTML = html
    updateStats()
}

// ===== STATISTIQUES =====
function updateStats() {
    const total = tasks.length
    const inProgress = tasks.filter(t => t.status === 'inProgress').length
    const completed = tasks.filter(t => t.status === 'completed').length
    const myTasks = tasks.filter(t => t.createdBy === currentUser.username).length
    const rate = total ? Math.round((completed / total) * 100) : 0
    
    document.getElementById('totalTasks').textContent = total
    document.getElementById('inProgress').textContent = inProgress
    document.getElementById('completed').textContent = completed
    document.getElementById('completionRate').textContent = rate + '%'
    
    // Mettre à jour les stats dans l'onglet si présent
    const myTasksStat = document.getElementById('myTasks')
    if (myTasksStat) myTasksStat.textContent = myTasks
}

// ===== GESTION DES UTILISATEURS =====
function loadUsers() {
    renderUsers()
    renderSessions()
}

function renderUsers() {
    const usersList = document.getElementById('usersList')
    if (!usersList) return
    
    const users = JSON.parse(localStorage.getItem('devboard-users')) || []
    
    let html = ''
    users.forEach(user => {
        const isCurrentUser = user.id === currentUser.id
        const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('fr-FR') : 'Jamais'
        
        html += `
            <div class="user-card ${isCurrentUser ? 'current-user' : ''}">
                <div class="user-avatar" style="background: ${user.color}">
                    ${user.firstName.charAt(0)}${user.lastName.charAt(0)}
                </div>
                <div class="user-details">
                    <div class="user-name-header">
                        <h4>${user.firstName} ${user.lastName}</h4>
                        ${isCurrentUser ? '<span class="badge current-badge">Vous</span>' : ''}
                    </div>
                    <p class="user-username">@${user.username}</p>
                    <div class="user-meta">
                        <span class="user-role-badge role-${user.role}">
                            ${user.role === 'admin' ? '👑' : user.role === 'dev' ? '💻' : '👁️'} ${user.role}
                        </span>
                        <span class="user-email">📧 ${user.email}</span>
                    </div>
                    <div class="user-footer">
                        <span class="user-date">📅 Inscrit le ${new Date(user.createdAt).toLocaleDateString('fr-FR')}</span>
                        <span class="user-last">Dernière connexion: ${lastLogin}</span>
                    </div>
                </div>
                ${hasPermission('admin') && !isCurrentUser ? `
                    <div class="user-actions">
                        <button class="action-btn" onclick="impersonateUser('${user.id}')" title="Impersonner">
                            🔀
                        </button>
                        <button class="action-btn" onclick="toggleUserStatus('${user.id}')" title="${user.isActive ? 'Désactiver' : 'Activer'}">
                            ${user.isActive ? '🔒' : '🔓'}
                        </button>
                    </div>
                ` : ''}
            </div>
        `
    })
    
    usersList.innerHTML = html
}

function renderSessions() {
    const sessionsList = document.getElementById('sessionsList')
    if (!sessionsList) return
    
    // Simuler des sessions actives (à remplacer par de vraies données)
    const users = JSON.parse(localStorage.getItem('devboard-users')) || []
    const activeSessions = users.filter(u => u.lastLogin).slice(0, 5)
    
    if (activeSessions.length === 0) {
        sessionsList.innerHTML = '<p class="empty-message">Aucune session active</p>'
        return
    }
    
    let html = ''
    activeSessions.forEach(user => {
        const lastSeen = user.lastLogin ? new Date(user.lastLogin).toLocaleString('fr-FR') : 'Inconnu'
        
        html += `
            <div class="session-item">
                <div class="session-user">
                    <span class="session-avatar" style="background: ${user.color}">
                        ${user.firstName.charAt(0)}${user.lastName.charAt(0)}
                    </span>
                    <span class="session-name">${user.firstName} ${user.lastName}</span>
                </div>
                <span class="session-role role-${user.role}">${user.role}</span>
                <span class="session-time">🕐 ${lastSeen}</span>
            </div>
        `
    })
    
    sessionsList.innerHTML = html
}

function updateOnlineCount() {
    const onlineCount = document.getElementById('onlineCount')
    if (onlineCount) {
        const users = JSON.parse(localStorage.getItem('devboard-users')) || []
        const activeToday = users.filter(u => {
            if (!u.lastLogin) return false
            const lastLogin = new Date(u.lastLogin)
            const today = new Date()
            return lastLogin.toDateString() === today.toDateString()
        }).length
        
        onlineCount.textContent = `👥 ${activeToday} en ligne aujourd'hui`
    }
}

// ===== GESTION DES LOGS =====
function loadActivityLogs() {
    const saved = localStorage.getItem('devboard-activity-logs')
    activityLogs = saved ? JSON.parse(saved) : []
    renderLogs()
}

function logActivity(action, type = 'info') {
    const log = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        action: action,
        user: currentUser.username,
        userName: `${currentUser.firstName} ${currentUser.lastName}`,
        timestamp: new Date().toISOString(),
        type: type
    }
    
    activityLogs.unshift(log)
    
    // Garder 100 logs max
    if (activityLogs.length > 100) activityLogs.pop()
    
    localStorage.setItem('devboard-activity-logs', JSON.stringify(activityLogs))
    renderLogs()
}

function renderLogs() {
    const container = document.getElementById('activityLogs')
    if (!container) return
    
    let filteredLogs = [...activityLogs]
    
    if (currentLogFilter !== 'all') {
        filteredLogs = filteredLogs.filter(log => log.type === currentLogFilter)
    }
    
    if (filteredLogs.length === 0) {
        container.innerHTML = '<p class="empty-logs">📝 Aucun log à afficher</p>'
        return
    }
    
    let html = ''
    filteredLogs.forEach(log => {
        const time = new Date(log.timestamp).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
        
        html += `
            <div class="log-entry ${log.type}">
                <span class="log-time">${time}</span>
                <span class="log-user">${log.userName || log.user}</span>
                <span class="log-action">${escapeHtml(log.action)}</span>
                <span class="log-type-badge ${log.type}">${log.type}</span>
            </div>
        `
    })
    
    container.innerHTML = html
}

function clearLogs() {
    if (!hasPermission('admin')) {
        showNotification('Seul l\'admin peut effacer les logs', 'error')
        return
    }
    
    pendingAction = () => {
        activityLogs = []
        localStorage.removeItem('devboard-activity-logs')
        logActivity('Logs effacés', 'warning')
        renderLogs()
        showNotification('Logs effacés', 'success')
    }
    
    document.getElementById('confirmMessage').textContent = 'Effacer tous les logs ?'
    document.getElementById('confirmModal').classList.add('active')
}

// ===== SAUVEGARDE =====
function loadTasks() {
    const saved = localStorage.getItem('devboard-tasks')
    if (saved) {
        try {
            tasks = JSON.parse(saved)
        } catch (e) {
            tasks = []
        }
    } else {
        // Tâches par défaut
        tasks = [
            {
                id: 'task_default_1',
                name: 'Bienvenue sur DevBoard Pro !',
                status: 'inProgress',
                createdAt: new Date().toISOString(),
                createdBy: 'admin',
                createdByName: 'Admin System',
                order: 0
            },
            {
                id: 'task_default_2',
                name: 'Clique pour marquer comme terminée',
                status: 'inProgress',
                createdAt: new Date().toISOString(),
                createdBy: 'admin',
                createdByName: 'Admin System',
                order: 1
            }
        ]
    }
    renderTasks()
}

function saveTasks() {
    localStorage.setItem('devboard-tasks', JSON.stringify(tasks))
    updateStats()
}

// ===== ACTIONS ADMIN =====
function impersonateUser(userId) {
    if (!hasPermission('admin')) {
        showNotification('Seul l\'admin peut impersonner', 'error')
        return
    }
    
    const users = JSON.parse(localStorage.getItem('devboard-users')) || []
    const user = users.find(u => u.id === userId)
    
    if (user) {
        logActivity(`Impersonnation de ${user.username}`, 'warning')
        
        // Créer nouvelle session
        const session = {
            id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            userId: user.id,
            username: user.username,
            role: user.role,
            permissions: user.permissions,
            token: 'fake-token',
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }
        
        localStorage.setItem('devboard-session', JSON.stringify(session))
        
        showNotification(`Vous êtes maintenant ${user.firstName} ${user.lastName}`, 'success')
        setTimeout(() => window.location.reload(), 1500)
    }
}

function toggleUserStatus(userId) {
    if (!hasPermission('admin')) {
        showNotification('Permission refusée', 'error')
        return
    }
    
    const users = JSON.parse(localStorage.getItem('devboard-users')) || []
    const userIndex = users.findIndex(u => u.id === userId)
    
    if (userIndex !== -1) {
        users[userIndex].isActive = !users[userIndex].isActive
        localStorage.setItem('devboard-users', JSON.stringify(users))
        
        logActivity(`Utilisateur ${users[userIndex].username} ${users[userIndex].isActive ? 'activé' : 'désactivé'}`, 'warning')
        showNotification(`Utilisateur ${users[userIndex].isActive ? 'activé' : 'désactivé'}`, 'success')
        renderUsers()
    }
}

// ===== EXPORT/IMPORT =====
function exportData() {
    const data = {
        tasks: tasks,
        logs: activityLogs,
        exportDate: new Date().toISOString(),
        exportedBy: currentUser.username,
        version: '2.0.0'
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `devboard-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    
    logActivity('Données exportées', 'info')
    showNotification('✅ Données exportées avec succès', 'success')
}

function importData() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    
    input.onchange = (e) => {
        const file = e.target.files[0]
        const reader = new FileReader()
        
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result)
                
                if (data.tasks) {
                    tasks = data.tasks
                    saveTasks()
                    
                    if (data.logs) {
                        activityLogs = data.logs
                        localStorage.setItem('devboard-activity-logs', JSON.stringify(activityLogs))
                    }
                    
                    logActivity('Données importées', 'info')
                    renderTasks()
                    renderLogs()
                    showNotification('✅ Données importées avec succès', 'success')
                } else {
                    showNotification('Fichier invalide', 'error')
                }
            } catch (error) {
                showNotification('Erreur lors de l\'import', 'error')
            }
        }
        
        reader.readAsText(file)
    }
    
    input.click()
}

// ===== RÉINITIALISATION =====
function clearAllData() {
    if (!hasPermission('admin')) {
        showNotification('Seul l\'admin peut réinitialiser les données', 'error')
        return
    }
    
    pendingAction = () => {
        tasks = []
        activityLogs = []
        localStorage.removeItem('devboard-tasks')
        localStorage.removeItem('devboard-activity-logs')
        
        logActivity('Base de données réinitialisée', 'danger')
        renderTasks()
        renderLogs()
        showNotification('🔥 Toutes les données ont été réinitialisées', 'warning')
    }
    
    document.getElementById('confirmMessage').textContent = 
        '⚠️ Réinitialiser TOUTES les données ? Cette action est irréversible !'
    document.getElementById('confirmModal').classList.add('active')
}

// ===== UTILITAIRES =====
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

function showNotification(message, type = 'info') {
    // Vérifier si la fonction existe (définie dans auth.js)
    if (typeof window.showNotification === 'function') {
        window.showNotification(message, type)
        return
    }
    
    // Fallback
    alert(message)
}

// ===== FERMETURE DES MODALS =====
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeEditModal()
        closeConfirmModal()
    }
})

// ===== RACCOURCIS CLAVIER =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeEditModal()
        closeConfirmModal()
    }
    
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        if (hasPermission('create')) {
            document.getElementById('taskInput')?.focus()
        }
    }
})

// ===== AJOUT DE STYLES MANQUANTS =====
const additionalStyles = `
    .empty-state {
        text-align: center;
        padding: 3rem;
        background: var(--bg-light);
        border-radius: var(--radius-md);
    }
    
    .empty-icon {
        font-size: 3rem;
        margin-bottom: 1rem;
        opacity: 0.5;
    }
    
    .task-completed {
        text-decoration: line-through;
        opacity: 0.7;
    }
    
    .badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 600;
    }
    
    .creator-badge {
        background: var(--primary);
        color: white;
    }
    
    .current-badge {
        background: var(--success);
        color: white;
        margin-left: 0.5rem;
    }
    
    .current-user {
        border: 2px solid var(--primary);
    }
    
    .user-name-header {
        display: flex;
        align-items: center;
        margin-bottom: 0.25rem;
    }
    
    .user-username {
        color: var(--text-muted);
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
    }
    
    .user-meta {
        display: flex;
        gap: 1rem;
        align-items: center;
        margin-bottom: 0.5rem;
        flex-wrap: wrap;
    }
    
    .user-footer {
        display: flex;
        gap: 1rem;
        font-size: 0.8rem;
        color: var(--text-muted);
        flex-wrap: wrap;
    }
    
    .user-role-badge {
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    
    .role-admin {
        background: #ef476f20;
        color: #ef476f;
    }
    
    .role-dev {
        background: #06d6a020;
        color: #06d6a0;
    }
    
    .role-viewer {
        background: #4cc9f020;
        color: #4cc9f0;
    }
    
    .session-item {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 0.75rem;
        background: var(--bg-white);
        border-radius: var(--radius-sm);
        margin-bottom: 0.5rem;
    }
    
    .session-user {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex: 1;
    }
    
    .session-avatar {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 0.8rem;
    }
    
    .session-time {
        color: var(--text-muted);
        font-size: 0.8rem;
    }
    
    .log-type-badge {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.7rem;
        text-transform: uppercase;
    }
    
    .log-type-badge.info {
        background: #4cc9f020;
        color: #4cc9f0;
    }
    
    .log-type-badge.warning {
        background: #ffb70320;
        color: #ffb703;
    }
    
    .log-type-badge.danger {
        background: #ef476f20;
        color: #ef476f;
    }
`

// Ajouter les styles
const styleSheet = document.createElement('style')
styleSheet.textContent = additionalStyles
document.head.appendChild(styleSheet)
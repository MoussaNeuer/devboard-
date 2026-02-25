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
    // Vérifier auth
    const session = checkAuth()
    if (!session) return
    
    currentUser = session.user
    
    // Initialiser UI
    initializeDashboard()
    
    // Charger données
    loadTasks()
    loadActivityLogs()
    
    // Setup des listeners
    setupEventListeners()
    
    // Initialiser thème
    initTheme()
})

function initializeDashboard() {
    // Afficher infos user
    document.getElementById('userInfo').textContent = currentUser.username
    document.getElementById('userRole').textContent = `(${currentUser.role})`
    
    // Afficher permissions
    updatePermissionUI()
    
    // Initialiser UI selon permissions
    initUIByPermissions()
    
    // Afficher compteur en ligne
    updateOnlineCount()
}

function updatePermissionUI() {
    const badge = document.getElementById('permissionBadge')
    if (badge) {
        const permissions = currentUser.permissions.join(', ')
        badge.textContent = `🔑 Permissions: ${permissions}`
    }
}

function initUIByPermissions() {
    // Cacher formulaire si pas de permission create
    if (!hasPermission('create')) {
        const addSection = document.getElementById('addTaskSection')
        if (addSection) addSection.style.display = 'none'
    }
    
    // Désactiver certaines actions si read-only
    if (!hasPermission('edit') && !hasPermission('delete')) {
        document.querySelectorAll('.task-actions button').forEach(btn => {
            btn.disabled = true
            btn.style.opacity = '0.5'
        })
    }
}

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
    
    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
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
            const tabId = e.target.dataset.tab + '-tab'
            document.getElementById(tabId).classList.add('active')
        })
    })
    
    // Log filters
    document.querySelectorAll('.log-filter').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.log-filter').forEach(b => b.classList.remove('active'))
            e.target.classList.add('active')
            currentLogFilter = e.target.dataset.logType
            renderLogs()
        })
    })
    
    // Settings
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
        autoSaveSetting.checked = localStorage.getItem('devboard-autosave') !== 'false'
        autoSaveSetting.addEventListener('change', (e) => {
            localStorage.setItem('devboard-autosave', e.target.checked)
        })
    }
}

// ===== GESTION DES PERMISSIONS =====
function hasPermission(action) {
    return currentUser.permissions.includes('all') || 
           currentUser.permissions.includes(action)
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
        order: tasks.length
    }
    
    tasks.push(newTask)
    saveTasks()
    logActivity(`Tâche créée: "${taskName}"`, 'info')
    
    input.value = ''
    renderTasks()
    showNotification('Tâche ajoutée avec succès', 'success')
}

function toggleTaskStatus(taskId) {
    if (!hasPermission('edit')) {
        showNotification('⛔ Permission refusée', 'error')
        logActivity(`Tentative de modification de tâche ${taskId}`, 'warning')
        return
    }
    
    const task = tasks.find(t => t.id === taskId)
    if (task) {
        const oldStatus = task.status
        task.status = task.status === 'inProgress' ? 'completed' : 'inProgress'
        task.updatedAt = new Date().toISOString()
        task.updatedBy = currentUser.username
        
        saveTasks()
        logActivity(`Tâche "${task.name}" marquée comme ${task.status === 'completed' ? 'terminée' : 'en cours'}`, 'info')
        renderTasks()
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
        showNotification('Tâche modifiée avec succès', 'success')
    }
    
    closeEditModal()
}

function confirmDelete(taskId) {
    if (!hasPermission('delete')) {
        showNotification('⛔ Permission refusée', 'error')
        logActivity(`Tentative de suppression de tâche ${taskId}`, 'warning')
        return
    }
    
    const task = tasks.find(t => t.id === taskId)
    if (task) {
        pendingAction = () => {
            tasks = tasks.filter(t => t.id !== taskId)
            saveTasks()
            logActivity(`Tâche supprimée: "${task.name}"`, 'warning')
            renderTasks()
            showNotification('Tâche supprimée', 'warning')
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
    
    let filteredTasks = [...tasks]
    
    // Appliquer filtre
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
                <p>✨ Aucune tâche à afficher</p>
                ${hasPermission('create') ? '<small>Commence par en ajouter une !</small>' : ''}
            </div>
        `
        return
    }
    
    let html = ''
    filteredTasks.forEach(task => {
        const createdDate = new Date(task.createdAt).toLocaleDateString('fr-FR')
        const isCreator = task.createdBy === currentUser.username
        
        html += `
            <div class="task-item ${task.status}" draggable="${hasPermission('edit')}" data-id="${task.id}">
                <input type="checkbox" 
                       class="task-checkbox" 
                       ${task.status === 'completed' ? 'checked' : ''}
                       onchange="toggleTaskStatus('${task.id}')"
                       ${!hasPermission('edit') ? 'disabled' : ''}>
                
                <div class="task-content">
                    <div class="task-name">${escapeHtml(task.name)}</div>
                    <div class="task-meta">
                        <span>📅 ${createdDate}</span>
                        <span>👤 ${task.createdBy}</span>
                        ${task.updatedBy ? `<span>✏️ ${task.updatedBy}</span>` : ''}
                        ${isCreator ? '<span class="creator-badge">👑</span>' : ''}
                    </div>
                </div>
                
                <div class="task-actions">
                    ${hasPermission('edit') ? `
                        <button class="edit-btn" onclick="openEditModal('${task.id}')">✏️</button>
                    ` : ''}
                    
                    ${hasPermission('delete') ? `
                        <button class="delete-btn" onclick="confirmDelete('${task.id}')">🗑️</button>
                    ` : ''}
                </div>
            </div>
        `
    })
    
    container.innerHTML = html
    
    // Setup drag & drop si permission
    if (hasPermission('edit')) {
        setupDragAndDrop()
    }
    
    updateAdvancedStats()
}

// ===== DRAG & DROP =====
function setupDragAndDrop() {
    const items = document.querySelectorAll('.task-item')
    const container = document.getElementById('tasksContainer')
    
    items.forEach(item => {
        item.addEventListener('dragstart', handleDragStart)
        item.addEventListener('dragend', handleDragEnd)
        item.addEventListener('dragover', handleDragOver)
        item.addEventListener('drop', handleDrop)
    })
}

function handleDragStart(e) {
    e.target.classList.add('dragging')
    e.dataTransfer.setData('text/plain', e.target.dataset.id)
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging')
    document.querySelectorAll('.task-item').forEach(item => {
        item.classList.remove('drag-over')
    })
}

function handleDragOver(e) {
    e.preventDefault()
    e.target.closest('.task-item')?.classList.add('drag-over')
}

function handleDrop(e) {
    e.preventDefault()
    const targetItem = e.target.closest('.task-item')
    if (!targetItem) return
    
    targetItem.classList.remove('drag-over')
    
    const draggedId = e.dataTransfer.getData('text/plain')
    const draggedItem = document.querySelector(`[data-id="${draggedId}"]`)
    
    if (draggedItem === targetItem) return
    
    // Réordonner dans le tableau
    const allTasks = [...document.querySelectorAll('.task-item')]
    const draggedIndex = allTasks.indexOf(draggedItem)
    const targetIndex = allTasks.indexOf(targetItem)
    
    // Mettre à jour l'ordre dans les données
    const taskIds = allTasks.map(item => item.dataset.id)
    const [movedId] = taskIds.splice(draggedIndex, 1)
    taskIds.splice(targetIndex, 0, movedId)
    
    // Réorganiser le tableau tasks
    tasks.sort((a, b) => {
        return taskIds.indexOf(a.id) - taskIds.indexOf(b.id)
    })
    
    // Mettre à jour les index
    tasks.forEach((task, index) => {
        task.order = index
    })
    
    saveTasks()
    logActivity('Réorganisation des tâches par drag & drop', 'info')
    renderTasks()
}

// ===== STATISTIQUES =====
function updateAdvancedStats() {
    const total = tasks.length
    const inProgress = tasks.filter(t => t.status === 'inProgress').length
    const completed = tasks.filter(t => t.status === 'completed').length
    const rate = total ? Math.round((completed / total) * 100) : 0
    
    document.getElementById('totalTasks').textContent = total
    document.getElementById('inProgress').textContent = inProgress
    document.getElementById('completed').textContent = completed
    document.getElementById('completionRate').textContent = rate + '%'
}

// ===== GESTION DES UTILISATEURS =====
function renderUsers() {
    const usersList = document.getElementById('usersList')
    if (!usersList) return
    
    let html = ''
    
    USERS.forEach(user => {
        const isCurrentUser = user.id === currentUser.id
        html += `
            <div class="user-card">
                <div class="user-avatar" style="background: ${user.color}">
                    ${user.avatar}
                </div>
                <div class="user-details">
                    <h4>${user.username} ${isCurrentUser ? '(vous)' : ''}</h4>
                    <p>${user.role}</p>
                    <span class="user-badge" style="background: ${user.color}20; color: ${user.color}">
                        ${user.permissions.join(' · ')}
                    </span>
                </div>
                ${hasPermission('admin') && !isCurrentUser ? `
                    <button class="impersonate-btn" onclick="impersonateUser('${user.username}')">
                        🔀 Impersonner
                    </button>
                ` : ''}
            </div>
        `
    })
    
    usersList.innerHTML = html
    renderSessions()
}

function renderSessions() {
    const sessionsList = document.getElementById('sessionsList')
    if (!sessionsList) return
    
    // Simuler des sessions actives
    const sessions = [
        { user: 'admin', ip: '192.168.1.1', lastActive: 'à l\'instant' },
        { user: 'dev', ip: '192.168.1.2', lastActive: 'il y a 5 min' },
        { user: 'viewer', ip: '192.168.1.3', lastActive: 'il y a 15 min' }
    ]
    
    let html = ''
    sessions.forEach(session => {
        html += `
            <div class="session-item">
                <span>👤 ${session.user}</span>
                <span>🌐 ${session.ip}</span>
                <span>⏱️ ${session.lastActive}</span>
            </div>
        `
    })
    
    sessionsList.innerHTML = html
}

function updateOnlineCount() {
    const onlineCount = document.getElementById('onlineCount')
    if (onlineCount) {
        onlineCount.textContent = `👥 3 en ligne`
    }
}

function impersonateUser(username) {
    if (!hasPermission('admin')) {
        showNotification('Seul l\'admin peut impersonner', 'error')
        return
    }
    
    const user = USERS.find(u => u.username === username)
    if (user) {
        logActivity(`Impersonnation de ${username}`, 'warning')
        currentUser = user
        initializeDashboard()
        renderTasks()
        renderUsers()
        showNotification(`Vous êtes maintenant ${username}`, 'success')
    }
}

// ===== GESTION DES LOGS =====
function logActivity(action, type = 'info') {
    const log = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        action: action,
        user: currentUser.username,
        timestamp: new Date().toISOString(),
        type: type
    }
    
    activityLogs.unshift(log)
    
    // Garder 100 logs max
    if (activityLogs.length > 100) activityLogs.pop()
    
    localStorage.setItem('devboard-logs', JSON.stringify(activityLogs))
    renderLogs()
}

function loadActivityLogs() {
    const saved = localStorage.getItem('devboard-logs')
    activityLogs = saved ? JSON.parse(saved) : []
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
        const time = new Date(log.timestamp).toLocaleTimeString('fr-FR')
        html += `
            <div class="log-entry ${log.type}">
                <span class="log-time">${time}</span>
                <span class="log-user">${log.user}</span>
                <span class="log-action">${escapeHtml(log.action)}</span>
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
    
    activityLogs = []
    localStorage.removeItem('devboard-logs')
    logActivity('Logs effacés', 'warning')
    renderLogs()
    showNotification('Logs effacés', 'success')
}

// ===== SAUVEGARDE =====
function saveTasks() {
    const tasksWithMeta = {
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.username,
        tasks: tasks
    }
    localStorage.setItem('devboard-tasks', JSON.stringify(tasksWithMeta))
    updateAdvancedStats()
}

function loadTasks() {
    const saved = localStorage.getItem('devboard-tasks')
    if (saved) {
        try {
            const data = JSON.parse(saved)
            tasks = data.tasks || []
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
                order: 0
            },
            {
                id: 'task_default_2',
                name: 'Essaie d\'ajouter une tâche',
                status: 'inProgress',
                createdAt: new Date().toISOString(),
                createdBy: 'admin',
                order: 1
            }
        ]
    }
    renderTasks()
}

// ===== EXPORT/IMPORT =====
function exportData() {
    const data = {
        tasks: tasks,
        logs: activityLogs,
        exportDate: new Date().toISOString(),
        exportedBy: currentUser.username
    }
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `devboard-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    
    logActivity('Données exportées', 'info')
    showNotification('Données exportées avec succès', 'success')
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
                    logActivity('Données importées', 'info')
                    renderTasks()
                    showNotification('Données importées avec succès', 'success')
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
        localStorage.removeItem('devboard-logs')
        logActivity('Base de données réinitialisée', 'danger')
        renderTasks()
        renderLogs()
        showNotification('Toutes les données ont été réinitialisées', 'warning')
    }
    
    document.getElementById('confirmMessage').textContent = 
        '🔥 Réinitialiser TOUTES les données ? Cette action est irréversible !'
    document.getElementById('confirmModal').classList.add('active')
}

// ===== UTILITAIRES =====
function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

// ===== FERMETURE DES MODALS AU CLIC EXTERIEUR =====
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeEditModal()
        closeConfirmModal()
    }
})

// ===== RACCOURCIS CLAVIER =====
document.addEventListener('keydown', (e) => {
    // Échap pour fermer les modals
    if (e.key === 'Escape') {
        closeEditModal()
        closeConfirmModal()
    }
    
    // Ctrl+N pour nouvelle tâche
    if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        if (hasPermission('create')) {
            document.getElementById('taskInput')?.focus()
        }
    }
})
// ===== CONFIGURATION =====
const APP_CONFIG = {
    name: 'DevBoard Pro',
    version: '2.0.0',
    minUsernameLength: 3,
    maxUsernameLength: 20,
    minPasswordLength: 8,
    sessionDuration: 24 * 60 * 60 * 1000, // 24 heures
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000 // 15 minutes
}

// ===== BASE DE DONNÉES UTILISATEURS =====
let USERS = []

// Charger les utilisateurs existants
function loadUsers() {
    const savedUsers = localStorage.getItem('devboard-users')
    if (savedUsers) {
        USERS = JSON.parse(savedUsers)
    } else {
        // Utilisateurs par défaut
        USERS = [
            {
                id: 'user_' + Date.now() + '_1',
                firstName: 'Admin',
                lastName: 'System',
                username: 'admin',
                email: 'admin@devboard.pro',
                password: hashPassword('admin123'),
                role: 'admin',
                permissions: ['all'],
                avatar: 'A',
                color: '#ef476f',
                createdAt: new Date().toISOString(),
                lastLogin: null,
                isActive: true,
                loginAttempts: 0,
                lockUntil: null
            },
            {
                id: 'user_' + Date.now() + '_2',
                firstName: 'Dev',
                lastName: 'User',
                username: 'dev',
                email: 'dev@devboard.pro',
                password: hashPassword('dev123'),
                role: 'developer',
                permissions: ['create', 'edit', 'delete'],
                avatar: 'D',
                color: '#06d6a0',
                createdAt: new Date().toISOString(),
                lastLogin: null,
                isActive: true,
                loginAttempts: 0,
                lockUntil: null
            },
            {
                id: 'user_' + Date.now() + '_3',
                firstName: 'Viewer',
                lastName: 'User',
                username: 'viewer',
                email: 'viewer@devboard.pro',
                password: hashPassword('viewer123'),
                role: 'viewer',
                permissions: ['read'],
                avatar: 'V',
                color: '#4cc9f0',
                createdAt: new Date().toISOString(),
                lastLogin: null,
                isActive: true,
                loginAttempts: 0,
                lockUntil: null
            }
        ]
        saveUsers()
    }
}

function saveUsers() {
    localStorage.setItem('devboard-users', JSON.stringify(USERS))
}

// ===== HASHAGE SIMULÉ (pour la démo) =====
function hashPassword(password) {
    // Simuler un hash (en production, utiliser bcrypt)
    return btoa(password + '_salt_' + APP_CONFIG.version)
}

function verifyPassword(password, hash) {
    return hashPassword(password) === hash
}

// ===== GESTION DES SESSIONS =====
let currentUser = null
let loginAttempts = {}

function createSession(user) {
    const session = {
        id: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        userId: user.id,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        token: generateJWT(user),
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + APP_CONFIG.sessionDuration).toISOString(),
        userAgent: navigator.userAgent,
        ip: '127.0.0.1' // Simulé
    }
    
    localStorage.setItem('devboard-session', JSON.stringify(session))
    
    // Mettre à jour dernière connexion
    user.lastLogin = new Date().toISOString()
    user.loginAttempts = 0
    saveUsers()
    
    // Log de connexion
    addToAuditLog('login', `Connexion de ${user.username} (${user.role})`, 'info', user.id)
    
    return session
}

function generateJWT(user) {
    const header = btoa(JSON.stringify({ 
        alg: 'HS256', 
        typ: 'JWT',
        kid: 'devboard-pro-v2'
    }))
    
    const payload = btoa(JSON.stringify({ 
        sub: user.id,
        name: `${user.firstName} ${user.lastName}`,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor((Date.now() + APP_CONFIG.sessionDuration) / 1000),
        iss: 'devboard.pro',
        aud: 'devboard-client'
    }))
    
    const signature = btoa('signature_' + Date.now() + '_' + Math.random().toString(36))
    
    return `${header}.${payload}.${signature}`
}

function checkSession() {
    const session = JSON.parse(localStorage.getItem('devboard-session'))
    
    if (!session) return null
    
    // Vérifier expiration
    if (new Date(session.expiresAt) < new Date()) {
        logout()
        return null
    }
    
    // Vérifier que l'utilisateur existe toujours
    const user = USERS.find(u => u.id === session.userId)
    if (!user || !user.isActive) {
        logout()
        return null
    }
    
    currentUser = user
    return session
}

function logout() {
    if (currentUser) {
        addToAuditLog('logout', `Déconnexion de ${currentUser.username}`, 'info', currentUser.id)
    }
    localStorage.removeItem('devboard-session')
    currentUser = null
    window.location.href = 'index.html'
}

// ===== VALIDATION DES COMPTES =====
function validateUsername(username) {
    const errors = []
    
    if (!username) errors.push("Le nom d'utilisateur est requis")
    if (username.length < APP_CONFIG.minUsernameLength) 
        errors.push(`Minimum ${APP_CONFIG.minUsernameLength} caractères`)
    if (username.length > APP_CONFIG.maxUsernameLength) 
        errors.push(`Maximum ${APP_CONFIG.maxUsernameLength} caractères`)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) 
        errors.push("Lettres, chiffres et underscore uniquement")
    if (USERS.some(u => u.username === username)) 
        errors.push("Ce nom d'utilisateur est déjà pris")
    
    return { isValid: errors.length === 0, errors }
}

function validateEmail(email) {
    const errors = []
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (!email) errors.push("L'email est requis")
    if (!emailRegex.test(email)) errors.push("Format d'email invalide")
    if (USERS.some(u => u.email === email)) 
        errors.push("Cet email est déjà utilisé")
    
    return { isValid: errors.length === 0, errors }
}

function validatePassword(password) {
    const errors = []
    
    if (!password) errors.push("Le mot de passe est requis")
    if (password.length < APP_CONFIG.minPasswordLength) 
        errors.push(`Minimum ${APP_CONFIG.minPasswordLength} caractères`)
    if (!/[A-Z]/.test(password)) 
        errors.push("Au moins une majuscule")
    if (!/[a-z]/.test(password)) 
        errors.push("Au moins une minuscule")
    if (!/[0-9]/.test(password)) 
        errors.push("Au moins un chiffre")
    if (!/[!@#$%^&*]/.test(password)) 
        errors.push("Au moins un caractère spécial (!@#$%^&*)")
    
    return { isValid: errors.length === 0, errors }
}

// ===== CRÉATION DE COMPTE =====
function registerUser(userData) {
    // Validation
    const usernameValidation = validateUsername(userData.username)
    if (!usernameValidation.isValid) {
        showNotification(usernameValidation.errors[0], 'error')
        return false
    }
    
    const emailValidation = validateEmail(userData.email)
    if (!emailValidation.isValid) {
        showNotification(emailValidation.errors[0], 'error')
        return false
    }
    
    const passwordValidation = validatePassword(userData.password)
    if (!passwordValidation.isValid) {
        showNotification(passwordValidation.errors[0], 'error')
        return false
    }
    
    if (userData.password !== userData.confirmPassword) {
        showNotification("Les mots de passe ne correspondent pas", 'error')
        return false
    }
    
    // Créer l'utilisateur
    const newUser = {
        id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        firstName: userData.firstName,
        lastName: userData.lastName,
        username: userData.username.toLowerCase(),
        email: userData.email.toLowerCase(),
        password: hashPassword(userData.password),
        role: userData.role,
        permissions: getPermissionsForRole(userData.role),
        avatar: userData.firstName.charAt(0).toUpperCase(),
        color: getRandomColor(),
        createdAt: new Date().toISOString(),
        lastLogin: null,
        isActive: true,
        loginAttempts: 0,
        lockUntil: null,
        preferences: {
            theme: 'light',
            notifications: true,
            compactMode: false
        }
    }
    
    USERS.push(newUser)
    saveUsers()
    
    // Audit log
    addToAuditLog('register', `Nouvel utilisateur: ${newUser.username} (${newUser.role})`, 'info', newUser.id)
    
    // Créer session automatiquement
    createSession(newUser)
    
    return true
}

function getPermissionsForRole(role) {
    switch(role) {
        case 'admin':
            return ['all']
        case 'dev':
            return ['create', 'edit', 'delete', 'read']
        case 'viewer':
            return ['read']
        default:
            return ['read']
    }
}

function getRandomColor() {
    const colors = ['#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', '#06d6a0', '#ffb703', '#fb8500']
    return colors[Math.floor(Math.random() * colors.length)]
}

// ===== CONNEXION =====
function login(username, password, rememberMe = false) {
    // Vérifier tentative de connexion
    const attemptsKey = `login_attempts_${username}`
    const attempts = loginAttempts[attemptsKey] || { count: 0, lockUntil: null }
    
    if (attempts.lockUntil && new Date(attempts.lockUntil) > new Date()) {
        const minutesLeft = Math.ceil((new Date(attempts.lockUntil) - new Date()) / 60000)
        showNotification(`Trop de tentatives. Réessaie dans ${minutesLeft} minutes`, 'error')
        return false
    }
    
    const user = USERS.find(u => u.username === username.toLowerCase())
    
    if (!user) {
        handleFailedAttempt(username)
        showNotification("Utilisateur ou mot de passe incorrect", 'error')
        return false
    }
    
    if (!user.isActive) {
        showNotification("Ce compte est désactivé. Contacte l'administrateur.", 'error')
        return false
    }
    
    if (!verifyPassword(password, user.password)) {
        handleFailedAttempt(username)
        showNotification("Utilisateur ou mot de passe incorrect", 'error')
        return false
    }
    
    // Réinitialiser les tentatives
    delete loginAttempts[attemptsKey]
    
    // Créer session
    const session = createSession(user)
    
    // Adapter la durée de session selon rememberMe
    if (rememberMe) {
        session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
        localStorage.setItem('devboard-session', JSON.stringify(session))
    }
    
    return true
}

function handleFailedAttempt(username) {
    const attemptsKey = `login_attempts_${username}`
    if (!loginAttempts[attemptsKey]) {
        loginAttempts[attemptsKey] = { count: 1, lockUntil: null }
    } else {
        loginAttempts[attemptsKey].count++
        
        if (loginAttempts[attemptsKey].count >= APP_CONFIG.maxLoginAttempts) {
            loginAttempts[attemptsKey].lockUntil = new Date(Date.now() + APP_CONFIG.lockoutDuration)
            showNotification(`Compte verrouillé pour ${APP_CONFIG.lockoutDuration/60000} minutes`, 'warning')
        }
    }
}

// ===== AUDIT LOG =====
function addToAuditLog(action, details, type = 'info', userId = null) {
    let auditLogs = JSON.parse(localStorage.getItem('devboard-audit-logs')) || []
    
    auditLogs.unshift({
        id: 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        action: action,
        details: details,
        type: type,
        userId: userId,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString()
    })
    
    // Garder 1000 logs max
    if (auditLogs.length > 1000) auditLogs.pop()
    
    localStorage.setItem('devboard-audit-logs', JSON.stringify(auditLogs))
}

// ===== INTERFACE UTILISATEUR =====
function initTheme() {
    const savedTheme = localStorage.getItem('devboard-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode')
        updateThemeButton('🌞', 'Mode clair')
    } else {
        updateThemeButton('🌙', 'Mode sombre')
    }
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode')
    const isDark = document.body.classList.contains('dark-mode')
    localStorage.setItem('devboard-theme', isDark ? 'dark' : 'light')
    updateThemeButton(isDark ? '🌞' : '🌙', isDark ? 'Mode clair' : 'Mode sombre')
}

function updateThemeButton(icon, text) {
    const btn = document.getElementById('themeToggle')
    if (btn) {
        btn.innerHTML = `<span class="theme-icon">${icon}</span><span class="theme-text">${text}</span>`
    }
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div')
    notification.className = `notification notification-${type}`
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    }
    
    notification.innerHTML = `
        <span class="notification-icon">${icons[type]}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `
    
    document.body.appendChild(notification)
    
    // Animation d'entrée
    setTimeout(() => notification.classList.add('show'), 10)
    
    // Auto-suppression
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.remove('show')
            setTimeout(() => notification.remove(), 300)
        }, duration)
    }
}

// ===== GESTION DES TABS =====
function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active')
    })
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active')
    })
    
    document.getElementById(tabName + 'Tab').classList.add('active')
    document.getElementById(tabName + 'Form').classList.add('active')
}

// ===== VALIDATION EN TEMPS RÉEL =====
function setupRealTimeValidation() {
    const usernameInput = document.getElementById('registerUsername')
    const emailInput = document.getElementById('registerEmail')
    const passwordInput = document.getElementById('registerPassword')
    const confirmInput = document.getElementById('registerConfirmPassword')
    const roleSelect = document.getElementById('registerRole')
    
    if (usernameInput) {
        usernameInput.addEventListener('input', debounce(function() {
            validateField('username', this.value)
        }, 500))
    }
    
    if (emailInput) {
        emailInput.addEventListener('input', debounce(function() {
            validateField('email', this.value)
        }, 500))
    }
    
    if (passwordInput) {
        passwordInput.addEventListener('input', function() {
            checkPasswordStrength(this.value)
            if (confirmInput.value) {
                validatePasswordMatch()
            }
        })
    }
    
    if (confirmInput) {
        confirmInput.addEventListener('input', validatePasswordMatch)
    }
    
    if (roleSelect) {
        roleSelect.addEventListener('change', function() {
            showRoleInfo(this.value)
        })
    }
}

function validateField(field, value) {
    const input = document.getElementById(`register${field.charAt(0).toUpperCase() + field.slice(1)}`)
    const feedback = document.createElement('div')
    feedback.className = 'field-feedback'
    
    let isValid = false
    let message = ''
    
    switch(field) {
        case 'username':
            const validation = validateUsername(value)
            isValid = validation.isValid
            message = isValid ? '✓ Nom d\'utilisateur disponible' : validation.errors[0]
            break
        case 'email':
            const emailValidation = validateEmail(value)
            isValid = emailValidation.isValid
            message = isValid ? '✓ Email valide' : emailValidation.errors[0]
            break
    }
    
    // Supprimer l'ancien feedback
    const oldFeedback = input.parentElement.querySelector('.field-feedback')
    if (oldFeedback) oldFeedback.remove()
    
    // Ajouter le nouveau
    feedback.className = `field-feedback ${isValid ? 'valid' : 'invalid'}`
    feedback.textContent = message
    input.parentElement.appendChild(feedback)
}

function checkPasswordStrength(password) {
    const strengthBar = document.getElementById('passwordStrength')
    if (!strengthBar) return
    
    let strength = 0
    
    if (password.length >= 8) strength++
    if (password.length >= 12) strength++
    if (/[A-Z]/.test(password)) strength++
    if (/[0-9]/.test(password)) strength++
    if (/[!@#$%^&*]/.test(password)) strength++
    
    const percentage = (strength / 5) * 100
    
    strengthBar.innerHTML = `<div class="strength-bar" style="width: ${percentage}%"></div>`
    
    let message = ''
    if (percentage < 40) message = 'Faible'
    else if (percentage < 70) message = 'Moyen'
    else message = 'Fort'
    
    strengthBar.setAttribute('data-strength', message)
}

function validatePasswordMatch() {
    const password = document.getElementById('registerPassword').value
    const confirm = document.getElementById('registerConfirmPassword').value
    const feedback = document.createElement('div')
    
    const existing = document.getElementById('registerConfirmPassword').parentElement.querySelector('.field-feedback')
    if (existing) existing.remove()
    
    if (confirm && password !== confirm) {
        feedback.className = 'field-feedback invalid'
        feedback.textContent = '❌ Les mots de passe ne correspondent pas'
        document.getElementById('registerConfirmPassword').parentElement.appendChild(feedback)
    }
}

function showRoleInfo(role) {
    const roleInfo = document.getElementById('roleInfo')
    const infos = {
        admin: {
            title: '👑 Administrateur',
            desc: 'Accès complet à toutes les fonctionnalités',
            permissions: ['Gestion des utilisateurs', 'Configuration système', 'Toutes les actions', 'Audit logs']
        },
        dev: {
            title: '💻 Développeur',
            desc: 'Gestion complète des projets et tâches',
            permissions: ['Créer des tâches', 'Modifier des tâches', 'Supprimer des tâches', 'Voir toutes les tâches']
        },
        viewer: {
            title: '👁️ Viewer',
            desc: 'Consultation uniquement',
            permissions: ['Voir les tâches', 'Voir les tableaux', 'Lecture seule']
        }
    }
    
    const info = infos[role]
    if (info) {
        roleInfo.innerHTML = `
            <div class="role-info-card">
                <h4>${info.title}</h4>
                <p>${info.desc}</p>
                <ul class="permission-list">
                    ${info.permissions.map(p => `<li>✓ ${p}</li>`).join('')}
                </ul>
            </div>
        `
    }
}

function debounce(func, wait) {
    let timeout
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout)
            func.apply(this, args)
        }
        clearTimeout(timeout)
        timeout = setTimeout(later, wait)
    }
}

// ===== GESTION DES MOTS DE PASSE =====
function togglePassword(inputId) {
    const input = document.getElementById(inputId)
    const type = input.type === 'password' ? 'text' : 'password'
    input.type = type
}

// ===== MODAL DE BIENVENUE =====
function showWelcomeModal(user) {
    const modal = document.getElementById('welcomeModal')
    const message = document.getElementById('welcomeMessage')
    const roleCard = document.getElementById('welcomeRoleCard')
    
    message.textContent = `Bienvenue ${user.firstName} ! Ton compte ${user.role} a été créé avec succès.`
    
    const roleInfos = {
        admin: '👑 Accès administrateur complet',
        dev: '💻 Accès développeur (CRUD complet)',
        viewer: '👁️ Accès viewer (lecture seule)'
    }
    
    roleCard.innerHTML = `
        <div class="role-welcome-card role-${user.role}">
            <span class="role-icon">${roleInfos[user.role].split(' ')[0]}</span>
            <div>
                <strong>${roleInfos[user.role]}</strong>
                <p>${getPermissionsForRole(user.role).join(' · ')}</p>
            </div>
        </div>
    `
    
    modal.classList.add('active')
}

function closeWelcomeModal() {
    document.getElementById('welcomeModal').classList.remove('active')
    window.location.href = 'dashboard.html'
}

// ===== INITIALISATION =====
document.addEventListener('DOMContentLoaded', () => {
    loadUsers()
    initTheme()
    setupRealTimeValidation()
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle')
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme)
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm')
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault()
            
            const username = document.getElementById('loginUsername').value
            const password = document.getElementById('loginPassword').value
            const rememberMe = document.getElementById('rememberMe').checked
            
            if (login(username, password, rememberMe)) {
                showNotification('Connexion réussie ! Redirection...', 'success')
                setTimeout(() => {
                    window.location.href = 'dashboard.html'
                }, 1500)
            }
        })
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm')
    if (registerForm) {
        registerForm.addEventListener('submit', (e) => {
            e.preventDefault()
            
            const userData = {
                firstName: document.getElementById('registerFirstName').value,
                lastName: document.getElementById('registerLastName').value,
                username: document.getElementById('registerUsername').value,
                email: document.getElementById('registerEmail').value,
                password: document.getElementById('registerPassword').value,
                confirmPassword: document.getElementById('registerConfirmPassword').value,
                role: document.getElementById('registerRole').value
            }
            
            if (registerUser(userData)) {
                showNotification('Compte créé avec succès !', 'success')
                showWelcomeModal(userData)
            }
        })
    }
})
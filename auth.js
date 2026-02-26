// ===== CONFIGURATION =====
const APP_CONFIG = {
    name: 'DevBoard Pro',
    version: '2.0.0',
    minUsernameLength: 3,
    maxUsernameLength: 20,
    minPasswordLength: 8,
    sessionDuration: 24 * 60 * 60 * 1000,
    maxLoginAttempts: 5,
    lockoutDuration: 15 * 60 * 1000
}

// ===== BASE DE DONNÉES UTILISATEURS =====
let USERS = []

function loadUsers() {
    const savedUsers = localStorage.getItem('devboard-users')
    if (savedUsers) {
        USERS = JSON.parse(savedUsers)
    } else {
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

function hashPassword(password) {
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
        ip: '127.0.0.1'
    }
    
    localStorage.setItem('devboard-session', JSON.stringify(session))
    
    user.lastLogin = new Date().toISOString()
    user.loginAttempts = 0
    saveUsers()
    
    return session
}

function generateJWT(user) {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    const payload = btoa(JSON.stringify({ 
        sub: user.id,
        name: `${user.firstName} ${user.lastName}`,
        username: user.username,
        role: user.role,
        permissions: user.permissions,
        exp: Math.floor((Date.now() + APP_CONFIG.sessionDuration) / 1000)
    }))
    const signature = btoa('signature_' + Date.now())
    return `${header}.${payload}.${signature}`
}

function checkSession() {
    const session = JSON.parse(localStorage.getItem('devboard-session'))
    if (!session) return null
    
    if (new Date(session.expiresAt) < new Date()) {
        logout()
        return null
    }
    
    const user = USERS.find(u => u.id === session.userId)
    if (!user || !user.isActive) {
        logout()
        return null
    }
    
    currentUser = user
    return session
}

function logout() {
    localStorage.removeItem('devboard-session')
    currentUser = null
    window.location.href = 'index.html'
}

// ===== VALIDATION =====
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
        errors.push("Au moins un caractère spécial")
    
    return { isValid: errors.length === 0, errors }
}

function registerUser(userData) {
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
    createSession(newUser)
    
    return true
}

function getPermissionsForRole(role) {
    switch(role) {
        case 'admin': return ['all']
        case 'dev': return ['create', 'edit', 'delete', 'read']
        case 'viewer': return ['read']
        default: return ['read']
    }
}

function getRandomColor() {
    const colors = ['#4361ee', '#3a0ca3', '#7209b7', '#f72585', '#4cc9f0', '#06d6a0', '#ffb703', '#fb8500']
    return colors[Math.floor(Math.random() * colors.length)]
}

function login(username, password, rememberMe = false) {
    const user = USERS.find(u => u.username === username.toLowerCase())
    
    if (!user) {
        showNotification("Utilisateur ou mot de passe incorrect", 'error')
        return false
    }
    
    if (!user.isActive) {
        showNotification("Ce compte est désactivé", 'error')
        return false
    }
    
    if (!verifyPassword(password, user.password)) {
        showNotification("Utilisateur ou mot de passe incorrect", 'error')
        return false
    }
    
    const session = createSession(user)
    
    if (rememberMe) {
        session.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        localStorage.setItem('devboard-session', JSON.stringify(session))
    }
    
    return true
}

// ===== INTERFACE =====
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
    setTimeout(() => notification.classList.add('show'), 10)
    
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.remove('show')
            setTimeout(() => notification.remove(), 300)
        }, duration)
    }
}

function switchAuthTab(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => tab.classList.remove('active'))
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'))
    
    document.getElementById(tabName + 'Tab').classList.add('active')
    document.getElementById(tabName + 'Form').classList.add('active')
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId)
    input.type = input.type === 'password' ? 'text' : 'password'
}

function showWelcomeModal(user) {
    const modal = document.getElementById('welcomeModal')
    const message = document.getElementById('welcomeMessage')
    const roleCard = document.getElementById('welcomeRoleCard')
    
    message.textContent = `Bienvenue ${user.firstName} ! Ton compte ${user.role} a été créé avec succès.`
    
    const roleInfos = {
        admin: '👑 Administrateur',
        dev: '💻 Développeur',
        viewer: '👁️ Viewer'
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

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
    loadUsers()
    initTheme()
    
    const themeToggle = document.getElementById('themeToggle')
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme)
    }
    
    const loginForm = document.getElementById('loginForm')
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault()
            
            const username = document.getElementById('loginUsername').value
            const password = document.getElementById('loginPassword').value
            const rememberMe = document.getElementById('rememberMe').checked
            
            if (login(username, password, rememberMe)) {
                showNotification('Connexion réussie !', 'success')
                setTimeout(() => window.location.href = 'dashboard.html', 1500)
            }
        })
    }
    
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
                showNotification('Compte créé !', 'success')
                showWelcomeModal(userData)
            }
        })
    }
})
// ============================================
// 🔐 Authentication Logic
// ============================================

// DOM Elements
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const errorBox = document.getElementById('form-error');
const successBox = document.getElementById('form-success');

// ---- Toggle between Login and Signup ----
function showLogin() {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('signup-section').classList.add('hidden');
    clearMessages();
}

function showSignup() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('signup-section').classList.remove('hidden');
    clearMessages();
}

function clearMessages() {
    if (errorBox) {
        errorBox.classList.remove('visible');
        errorBox.textContent = '';
    }
    if (successBox) {
        successBox.classList.remove('visible');
        successBox.textContent = '';
    }
}

function showError(message) {
    if (errorBox) {
        errorBox.innerHTML = `<i data-lucide="alert-circle"></i> ${message}`;
        errorBox.classList.add('visible');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function showSuccess(message) {
    if (successBox) {
        successBox.innerHTML = `<i data-lucide="check-circle"></i> ${message}`;
        successBox.classList.add('visible');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ---- Login Handler ----
async function handleLogin(e) {
    e.preventDefault();
    clearMessages();

    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Ferme le clavier virtuel et libère le champ pour éviter que le navigateur de la PWA panique avec sa barre de mot de passe
    emailInput.blur();
    passwordInput.blur();

    if (!email || !password) {
        showError('Fenoy ny saha rehetra azafady (Veuillez remplir tous les champs)');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Miandry...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        // Fetch user profile to check role
        const { data: profiles, error: profileError } = await supabaseClient
            .from('profiles')
            .select('role, full_name, is_approved')
            .eq('id', data.user.id)
            .limit(1);

        if (profileError) throw profileError;
        
        const profile = (profiles && profiles.length > 0) ? profiles[0] : null;

        if (!profile) {
            await supabaseClient.auth.signOut();
            showError("Azafady, tsy hita ny profil-nao (Votre profil est introuvable).");
            btn.disabled = false;
            btn.innerHTML = '<i data-lucide="log-in"></i> Hiditra (Se connecter)';
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        // Check if user is approved
        if (profile.role !== ROLES.ADMIN && !profile.is_approved) {
             await supabaseClient.auth.signOut();
             showError('Miandry fankatoavana ny kaontinao (Votre compte est en attente d\'approbation par un admin.)');
             btn.disabled = false;
             btn.innerHTML = '<i data-lucide="log-in"></i> Hiditra (Se connecter)';
             if (typeof lucide !== 'undefined') lucide.createIcons();
             return;
        }

        // Redirection différée pour laisser le temps à Chrome PWA de supprimer correctement sa pop-up
        setTimeout(() => {
            if (profile.role === ROLES.ADMIN) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'dashboard.html';
            }
        }, 500);

    } catch (error) {
        showError(error.message || 'Nisy olana tamin\'ny fidirana (Erreur de connexion)');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="log-in"></i> Hiditra (Se connecter)';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ---- Signup Handler ----
async function handleSignup(e) {
    e.preventDefault();
    clearMessages();

    const fullName = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm').value;

    if (!fullName || !email || !password || !confirmPassword) {
        showError('Fenoy ny saha rehetra azafady (Veuillez remplir tous les champs)');
        return;
    }

    if (password !== confirmPassword) {
        showError('Tsy mitovy ny tenimiafina (Les mots de passe ne correspondent pas)');
        return;
    }

    if (password.length < 6) {
        showError('6 litera farafahakeliny ny tenimiafina (6 caractères minimum pour le mot de passe)');
        return;
    }

    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Miandry...';

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: fullName
                }
            }
        });

        if (error) throw error;

        // L'utilisateur doit être approuvé, on déconnecte de suite la session créée automatiquement
        await supabaseClient.auth.signOut();

        // Profile is created automatically by a database trigger
        showSuccess('Vita ny fisoratana anarana! Miandry fankatoavana. (Inscription réussie ! Attente d\'approbation.)');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="user-plus"></i> Hisoratra anarana (S\'inscrire)';
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Auto-switch to login after 3 seconds
        setTimeout(() => showLogin(), 3000);

    } catch (error) {
        showError(error.message || 'Nisy olana tamin\'ny fisoratana anarana (Erreur d\'inscription)');
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="user-plus"></i> Hisoratra anarana (S\'inscrire)';
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

// ---- Logout Handler ----
async function handleLogout() {
    try {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        window.location.href = 'index.html';
    }
}

// ---- Check Auth State ----
async function checkAuth() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

// ---- Get Current User Profile ----
async function getCurrentProfile() {
    const session = await checkAuth();
    if (!session) return null;

    const { data: profiles, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .limit(1);

    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }

    return (profiles && profiles.length > 0) ? profiles[0] : null;
}

// ---- Protect Routes ----
async function requireAuth(requiredRole = null) {
    const session = await checkAuth();

    if (!session) {
        window.location.href = 'index.html';
        return null;
    }

    const profile = await getCurrentProfile();

    if (!profile) {
        window.location.href = 'index.html';
        return null;
    }

    // Check approval
    if (profile.role !== ROLES.ADMIN && !profile.is_approved) {
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
        return null;
    }

    if (requiredRole && profile.role !== requiredRole) {
        // If user tries to access admin, redirect to user dashboard
        if (requiredRole === ROLES.ADMIN) {
            window.location.href = 'dashboard.html';
            return null;
        }
    }

    return profile;
}

// ---- Initialize Auth Page ----
function initAuthPage() {
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }

    // Check if already logged in
    checkAuth().then(session => {
        if (session) {
            getCurrentProfile().then(profile => {
                if (profile) {
                    if (profile.role !== ROLES.ADMIN && !profile.is_approved) {
                        return; // L'utilisateur n'est pas approuvé, on reste sur index.html
                    }

                    if (profile.role === ROLES.ADMIN) {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'dashboard.html';
                    }
                }
            });
        }
    });
}

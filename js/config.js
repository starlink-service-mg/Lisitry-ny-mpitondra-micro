// ============================================
// 🔧 Configuration Supabase
// ============================================
// Remplace ces valeurs par celles de ton projet Supabase
// Tu les trouveras dans : Settings > API sur https://supabase.com

const SUPABASE_URL = 'https://yulfniikyobtsxpugmrg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1bGZuaWlreW9idHN4cHVnbXJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjc0OTksImV4cCI6MjA4Nzg0MzQ5OX0.V4nuFnIl6RtTFO_CRoThLjkju_pf_DSd1tcWfVdvL_U';

// Initialisation du client Supabase
// Note: window.supabase est la librairie (CDN), on crée le client sous un autre nom
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Rôles utilisateur
const ROLES = {
    ADMIN: 'admin',
    USER: 'user'
};

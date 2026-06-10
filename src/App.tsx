import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import {
  Calculator,
  History,
  Settings,
  Printer,
  Menu,
  X,
  Building2,
  Users,
  LogOut,
  ChevronDown,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import { NewSale } from './components/NewSale';
import { SalesHistory } from './components/SalesHistory';
import { PriceManagement } from './components/PriceManagement';
import { CompanySettings } from './components/CompanySettings';
import { UserManagement } from './components/UserManagement';
import { AuthPage } from './components/AuthPage';
import { Comptabilite } from './components/Comptabilite';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { CompanyProfile, UserProfile, UserRole } from './types';

type Tab = 'sale' | 'history' | 'prices' | 'company' | 'users' | 'accounting';

const ROLE_TABS: Record<UserRole, Tab[]> = {
  admin: ['sale', 'history', 'prices', 'company', 'users', 'accounting'],
  manager: ['sale', 'history', 'prices', 'company', 'accounting'],
  vendeur: ['sale'],
};

const ROLE_ICON: Record<UserRole, typeof Shield> = {
  admin: ShieldAlert,
  manager: ShieldCheck,
  vendeur: Shield,
};

const ROLE_COLOR: Record<UserRole, string> = {
  admin: 'text-red-400',
  manager: 'text-yellow-400',
  vendeur: 'text-blue-400',
};

export default function App() {
  // All hooks must come before any conditional return
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('sale');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [profiles, setProfiles] = useState<CompanyProfile[]>([]);
  const [defaultProfile, setDefaultProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
      if (!session) setUserProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();
      setUserProfile(data);
      if (data) {
        const allowed = ROLE_TABS[data.role];
        setActiveTab((prev) => (allowed.includes(prev) ? prev : allowed[0]));
      }
    })();
  }, [session]);

  useEffect(() => {
    if (!session) return;
    fetchCompanyProfiles();
  }, [session]);

  async function fetchCompanyProfiles() {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .order('created_at');
      if (error) throw error;
      const list = data || [];
      setProfiles(list);
      setDefaultProfile(list.find((p) => p.is_default) || list[0] || null);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setShowUserMenu(false);
  }

  // Missing secrets (GitHub Pages without secrets configured)
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="bg-amber-900/20 border border-amber-500/40 rounded-2xl p-8 max-w-lg w-full">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-7 h-7 text-amber-400 shrink-0" />
            <h1 className="text-lg font-bold text-amber-400">Configuration manquante</h1>
          </div>
          <p className="text-slate-300 text-sm mb-4">
            Les variables d'environnement Supabase ne sont pas configurees. Si vous hebergez sur GitHub Pages, ajoutez les secrets suivants dans votre depot GitHub :
          </p>
          <ul className="space-y-1 text-sm font-mono text-slate-400 bg-slate-800 rounded-lg p-4">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="text-slate-500 text-xs mt-4">
            Depot GitHub → Settings → Secrets and variables → Actions → New repository secret
          </p>
        </div>
      </div>
    );
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!session) {
    return <AuthPage />;
  }

  if (!userProfile) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const allowedTabs = ROLE_TABS[userProfile.role];
  const displayName = defaultProfile?.company_name || 'Imprimerie Pro';
  const displaySlogan = defaultProfile?.slogan || 'Systeme de gestion';
  const displayColor = defaultProfile?.primary_color || '#2563eb';
  const RoleIcon = ROLE_ICON[userProfile.role];

  const navItems: { id: Tab; label: string; icon: typeof Calculator }[] = [
    { id: 'sale', label: 'Nouvelle Vente', icon: Calculator },
    { id: 'history', label: 'Historique', icon: History },
    { id: 'prices', label: 'Tarifs', icon: Settings },
    { id: 'company', label: 'Entreprises', icon: Building2 },
    { id: 'users', label: 'Utilisateurs', icon: Users },
    { id: 'accounting', label: 'Comptabilite', icon: BookOpen },
  ].filter((item) => allowedTabs.includes(item.id as Tab)) as { id: Tab; label: string; icon: typeof Calculator }[];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              {defaultProfile?.logo_url ? (
                <img
                  src={defaultProfile.logo_url}
                  alt={displayName}
                  className="w-10 h-10 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${displayColor}, ${displayColor}99)` }}
                >
                  <Printer className="w-6 h-6 text-white" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-white">{displayName}</h1>
                <p className="text-xs text-slate-400">{displaySlogan}</p>
              </div>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <div className="relative hidden md:block">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-bold text-xs">
                    {(userProfile.full_name || userProfile.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white leading-none">
                      {userProfile.full_name || 'Utilisateur'}
                    </p>
                    <div className={`flex items-center gap-1 text-xs ${ROLE_COLOR[userProfile.role]}`}>
                      <RoleIcon className="w-3 h-3" />
                      {userProfile.role === 'admin' ? 'Administrateur' : userProfile.role === 'manager' ? 'Manager' : 'Vendeur'}
                    </div>
                  </div>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-700">
                        <p className="text-sm font-medium text-white truncate">
                          {userProfile.full_name || '—'}
                        </p>
                        <p className="text-xs text-slate-400 truncate">{userProfile.email}</p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-600/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Se deconnecter
                      </button>
                    </div>
                  </>
                )}
              </div>

              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-700 text-slate-300"
              >
                {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {isMenuOpen && (
          <nav className="md:hidden bg-slate-800 border-t border-slate-700 p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setIsMenuOpen(false); }}
                className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg font-medium transition-all ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </button>
            ))}
            <div className="border-t border-slate-700 pt-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-red-400 hover:bg-red-600/10 transition-all"
              >
                <LogOut className="w-5 h-5" />
                Se deconnecter
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'sale' && (
          <NewSale profiles={profiles} defaultProfile={defaultProfile} />
        )}
        {activeTab === 'history' && (
          <SalesHistory profiles={profiles} defaultProfile={defaultProfile} />
        )}
        {activeTab === 'prices' && <PriceManagement />}
        {activeTab === 'company' && <CompanySettings onUpdate={fetchCompanyProfiles} />}
        {activeTab === 'users' && userProfile.role === 'admin' && (
          <UserManagement currentUserId={userProfile.id} />
        )}
        {activeTab === 'accounting' && <Comptabilite />}
      </main>
    </div>
  );
}

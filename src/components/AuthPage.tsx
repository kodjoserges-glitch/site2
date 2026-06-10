import { useState } from 'react';
import { Printer, LogIn, UserPlus, Loader2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'register';

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        setError('Email ou mot de passe incorrect.');
      } else if (msg.includes('User already registered')) {
        setError('Cet email est deja utilise.');
      } else if (msg.includes('Password should be')) {
        setError('Le mot de passe doit contenir au moins 6 caracteres.');
      } else {
        setError(msg || 'Une erreur est survenue.');
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setError('');
    setFullName('');
    setEmail('');
    setPassword('');
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl shadow-lg shadow-blue-600/40 mb-4">
            <Printer className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Imprimerie Pro</h1>
          <p className="text-slate-400 text-sm mt-1">Systeme de gestion</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-xl">
          {/* Tabs */}
          <div className="flex border-b border-slate-700">
            <button
              onClick={() => switchMode('login')}
              className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                mode === 'login'
                  ? 'text-white bg-slate-700/50 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Connexion
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`flex-1 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                mode === 'register'
                  ? 'text-white bg-slate-700/50 border-b-2 border-blue-500'
                  : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Inscription
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nom complet
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Votre nom"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="vous@exemple.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Mot de passe
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder={mode === 'register' ? 'Min. 6 caracteres' : '••••••••'}
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : mode === 'login' ? (
                <>
                  <LogIn className="w-5 h-5" />
                  Se connecter
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Creer mon compte
                </>
              )}
            </button>

            {mode === 'register' && (
              <p className="text-center text-xs text-slate-500">
                Le premier compte cree devient Administrateur.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

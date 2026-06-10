import { useState, useEffect } from 'react';
import {
  Users,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserProfile, UserRole, ROLE_LABELS } from '../types';

interface Props {
  currentUserId: string;
}

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; icon: typeof Shield; description: string }> = {
  admin: {
    label: 'Administrateur',
    color: 'text-red-400 bg-red-600/10 border-red-600/30',
    icon: ShieldAlert,
    description: 'Acces complet : ventes, historique, tarifs, entreprises, utilisateurs',
  },
  manager: {
    label: 'Manager',
    color: 'text-yellow-400 bg-yellow-600/10 border-yellow-600/30',
    icon: ShieldCheck,
    description: 'Acces a : ventes, historique, tarifs, entreprises',
  },
  vendeur: {
    label: 'Vendeur',
    color: 'text-blue-400 bg-blue-600/10 border-blue-600/30',
    icon: Shield,
    description: 'Acces uniquement a : nouvelle vente',
  },
};

export function UserManagement({ currentUserId }: Props) {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRoles, setPendingRoles] = useState<Record<string, UserRole>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchProfiles();
  }, []);

  async function fetchProfiles() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at');
      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function setPendingRole(userId: string, role: UserRole) {
    setPendingRoles((prev) => ({ ...prev, [userId]: role }));
  }

  async function saveRole(userId: string) {
    const newRole = pendingRoles[userId];
    if (!newRole) return;
    setSaving(userId);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      setProfiles((prev) =>
        prev.map((p) => (p.id === userId ? { ...p, role: newRole } : p))
      );
      setPendingRoles((prev) => {
        const next = { ...prev };
        delete next[userId];
        return next;
      });
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la mise a jour du role');
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center">
            <Users className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Gestion des utilisateurs</h2>
            <p className="text-sm text-slate-400">{profiles.length} utilisateur(s) inscrit(s)</p>
          </div>
        </div>
      </div>

      {/* Role Legend */}
      <div className="grid sm:grid-cols-3 gap-4">
        {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={role} className="bg-slate-800 rounded-xl border border-slate-700 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${role === 'admin' ? 'text-red-400' : role === 'manager' ? 'text-yellow-400' : 'text-blue-400'}`} />
                <span className="font-semibold text-white text-sm">{cfg.label}</span>
              </div>
              <p className="text-xs text-slate-400">{cfg.description}</p>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        {profiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400">
            <Users className="w-12 h-12 mb-3 opacity-50" />
            <p>Aucun utilisateur inscrit</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700">
            {profiles.map((profile) => {
              const isSelf = profile.id === currentUserId;
              const currentRole = pendingRoles[profile.id] ?? profile.role;
              const hasChange = pendingRoles[profile.id] && pendingRoles[profile.id] !== profile.role;
              const cfg = ROLE_CONFIG[profile.role];
              const Icon = cfg.icon;

              return (
                <div key={profile.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Avatar + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {profile.full_name || '—'}
                        </span>
                        {isSelf && (
                          <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">
                            Vous
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-slate-400 truncate block">{profile.email}</span>
                    </div>
                  </div>

                  {/* Current role badge */}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium ${cfg.color} shrink-0`}>
                    <Icon className="w-4 h-4" />
                    {cfg.label}
                  </div>

                  {/* Role selector */}
                  <div className="flex items-center gap-2">
                    {isSelf ? (
                      <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                        <Info className="w-4 h-4" />
                        Non modifiable
                      </div>
                    ) : (
                      <>
                        <select
                          value={currentRole}
                          onChange={(e) => setPendingRole(profile.id, e.target.value as UserRole)}
                          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                          {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(([r, label]) => (
                            <option key={r} value={r}>{label}</option>
                          ))}
                        </select>
                        {hasChange && (
                          <button
                            onClick={() => saveRole(profile.id)}
                            disabled={saving === profile.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            {saving === profile.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Save className="w-4 h-4" />
                            )}
                            Sauvegarder
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

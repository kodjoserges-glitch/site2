import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Cloud, CloudOff, RefreshCw, CheckCircle2, AlertCircle,
  ExternalLink, Loader2, WifiOff, Info,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  initGoogleAuth, requestToken, getToken,
  syncToGoogleSheets, clearAuth, getStoredSheetId,
} from '../lib/googleDrive';

const CLIENT_ID = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type Status = 'idle' | 'connecting' | 'syncing' | 'synced' | 'error';

export function DriveSync() {
  const [connected, setConnected] = useState(() => !!getToken());
  const [status, setStatus] = useState<Status>('idle');
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [sheetId, setSheetId] = useState<string | null>(getStoredSheetId);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncingRef = useRef(false);

  // Initialize Google OAuth client
  useEffect(() => {
    if (!CLIENT_ID) return;
    initGoogleAuth(CLIENT_ID).catch(console.error);
  }, []);

  // Listen to realtime DB changes → trigger auto-sync
  useEffect(() => {
    if (!connected) return;
    const channel = supabase
      .channel('drive-sync-watch')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services' }, scheduleSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, scheduleSync)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [connected]);

  const scheduleSync = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runSync, 2500);
  }, []);

  const runSync = useCallback(async () => {
    if (syncingRef.current) return;
    const token = getToken();
    if (!token) { setConnected(false); return; }

    syncingRef.current = true;
    setStatus('syncing');
    setErrorMsg('');

    try {
      const [salesRes, servicesRes, expensesRes, companyRes] = await Promise.all([
        supabase.from('sales').select('*').order('created_at'),
        supabase.from('services').select('*').order('service_date'),
        supabase.from('expenses').select('*').order('expense_date'),
        supabase.from('company_settings').select('company_name').eq('is_default', true).maybeSingle(),
      ]);

      const newId = await syncToGoogleSheets(token, {
        sales: salesRes.data || [],
        services: servicesRes.data || [],
        expenses: expensesRes.data || [],
        companyName: companyRes.data?.company_name || 'Entreprise',
      });

      setSheetId(newId);
      setStatus('synced');
      setLastSync(new Date());
    } catch (err) {
      const msg = (err as Error).message;
      console.error('Drive sync:', msg);
      setStatus('error');
      setErrorMsg(msg.length > 150 ? msg.slice(0, 150) + '…' : msg);
    } finally {
      syncingRef.current = false;
    }
  }, []);

  async function handleConnect() {
    if (!CLIENT_ID) {
      alert(
        'VITE_GOOGLE_CLIENT_ID non configuré.\n\n' +
        '1. Créez un projet sur console.cloud.google.com\n' +
        '2. Activez les APIs "Google Drive" et "Google Sheets"\n' +
        '3. Créez des identifiants OAuth 2.0 (type: Application Web)\n' +
        '4. Ajoutez VITE_GOOGLE_CLIENT_ID=votre_client_id dans le fichier .env'
      );
      return;
    }
    setStatus('connecting');
    setErrorMsg('');
    try {
      await requestToken(true);
      setConnected(true);
      runSync();
    } catch (err) {
      setStatus('error');
      setErrorMsg((err as Error).message);
    }
  }

  function handleDisconnect() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    clearAuth();
    setConnected(false);
    setStatus('idle');
    setSheetId(null);
    setLastSync(null);
    setErrorMsg('');
  }

  const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}` : null;

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${connected ? 'bg-green-600/20' : 'bg-slate-700'}`}>
          {connected ? <Cloud className="w-5 h-5 text-green-400" /> : <CloudOff className="w-5 h-5 text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white">Synchronisation Google Drive</h3>
          <p className="text-xs text-slate-400">Export automatique vers Google Sheets</p>
        </div>
        {connected && (
          <div className="shrink-0">
            {status === 'syncing' && <Loader2 className="w-4 h-4 animate-spin text-blue-400" />}
            {status === 'synced' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
            {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
          </div>
        )}
      </div>

      {!connected ? (
        /* ── Disconnected state ── */
        <div className="space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">
            Connectez votre compte Google pour exporter automatiquement toutes les ventes,
            prestations et dépenses vers un fichier Google Sheets. La synchronisation se
            déclenche en temps réel à chaque modification.
          </p>

          {!CLIENT_ID && (
            <div className="flex items-start gap-2.5 bg-amber-600/10 border border-amber-600/20 rounded-xl p-3.5 text-xs text-amber-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">Configuration requise</p>
                <ol className="space-y-0.5 text-amber-400/80 list-decimal list-inside">
                  <li>Créez un projet sur console.cloud.google.com</li>
                  <li>Activez les APIs Drive et Google Sheets</li>
                  <li>Créez des identifiants OAuth 2.0 (Application Web)</li>
                  <li>Ajoutez <code className="bg-amber-900/40 px-1 rounded">VITE_GOOGLE_CLIENT_ID=...</code> dans .env</li>
                </ol>
              </div>
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={status === 'connecting'}
            className="flex items-center gap-2.5 px-4 py-2.5 bg-white hover:bg-gray-50 disabled:opacity-60 text-gray-800 rounded-xl text-sm font-medium transition-colors shadow-sm"
          >
            {status === 'connecting' ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {status === 'connecting' ? 'Connexion…' : 'Connecter Google Drive'}
          </button>

          {status === 'error' && errorMsg && (
            <div className="flex items-start gap-2 text-red-400 text-xs bg-red-600/10 border border-red-600/20 rounded-xl p-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}
        </div>
      ) : (
        /* ── Connected state ── */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1.5">Statut</p>
              <div className="flex items-center gap-1.5">
                {status === 'syncing' && (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /><span className="text-blue-400 text-sm font-medium">Sync…</span></>
                )}
                {status === 'synced' && (
                  <><CheckCircle2 className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400 text-sm font-medium">Synchronisé</span></>
                )}
                {status === 'error' && (
                  <><AlertCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-red-400 text-sm font-medium">Erreur</span></>
                )}
                {(status === 'idle' || status === 'connecting') && (
                  <span className="text-slate-300 text-sm">Connecté</span>
                )}
              </div>
            </div>
            <div className="bg-slate-700/50 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1.5">Dernière sync</p>
              <p className="text-white text-sm font-medium">
                {lastSync
                  ? lastSync.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : '—'}
              </p>
            </div>
          </div>

          {status === 'error' && errorMsg && (
            <div className="flex items-start gap-2 text-red-400 text-xs bg-red-600/10 border border-red-600/20 rounded-xl p-3">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-3 h-3 text-green-600/60" />
            Synchronisation automatique activée — toute modification est exportée en temps réel
          </div>

          <div className="flex flex-wrap gap-2">
            {sheetUrl && (
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600/15 hover:bg-green-600/25 text-green-400 rounded-lg text-xs font-medium transition-colors border border-green-600/20"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ouvrir dans Google Sheets
              </a>
            )}
            <button
              onClick={runSync}
              disabled={status === 'syncing'}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
              Sync manuelle
            </button>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg text-xs font-medium transition-colors border border-red-600/20"
            >
              <WifiOff className="w-3.5 h-3.5" /> Déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

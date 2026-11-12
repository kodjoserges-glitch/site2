import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, X, CheckCheck, Trash2, ShoppingCart, Printer, RotateCcw, CheckCircle, Package, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Notification, NotificationType, UserRole } from '../types';

interface Props {
  userRole: UserRole;
  userName: string;
  userId: string;
}

const NOTIF_ICON: Record<NotificationType, typeof Bell> = {
  new_sale: ShoppingCart,
  reprint_request: RotateCcw,
  reprint_validated: CheckCircle,
  print_done: Printer,
  office_sale: Package,
  low_stock: AlertTriangle,
};

const NOTIF_COLOR: Record<NotificationType, string> = {
  new_sale: 'text-blue-400 bg-blue-600/20',
  reprint_request: 'text-orange-400 bg-orange-600/20',
  reprint_validated: 'text-green-400 bg-green-600/20',
  print_done: 'text-cyan-400 bg-cyan-600/20',
  office_sale: 'text-emerald-400 bg-emerald-600/20',
  low_stock: 'text-red-400 bg-red-600/20',
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "A l'instant";
  const min = Math.floor(sec / 60);
  if (min < 60) return `Il y a ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `Il y a ${hr} h`;
  const days = Math.floor(hr / 24);
  return `Il y a ${days} j`;
}

export function NotificationBell({ userRole, userId }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [bellAnim, setBellAnim] = useState(false);
  const prevCountRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playSound = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // AudioContext not available
    }
  }, []);

  const isManager = userRole === 'manager' || userRole === 'admin';

  const fetchNotifications = useCallback(async () => {
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!isManager) {
        query = query.or(`target_user_id.eq.${userId},target_user_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      const list = isManager
        ? (data || [])
        : (data || []).filter((n: Notification) =>
            !n.target_user_id || n.target_user_id === userId
          );
      const newUnread = list.filter((n: Notification) => !n.read).length;
      if (newUnread > prevCountRef.current && prevCountRef.current !== 0) {
        playSound();
        setBellAnim(true);
        setTimeout(() => setBellAnim(false), 800);
      }
      prevCountRef.current = newUnread;
      setNotifications(list);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [playSound, isManager, userId]);

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel('notifications-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  async function markAllRead() {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', unread.map(n => n.id));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      prevCountRef.current = 0;
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  }

  async function deleteNotification(id: string) {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }

  async function clearAll() {
    try {
      await supabase.from('notifications').delete().in('id', notifications.map(n => n.id));
      setNotifications([]);
      prevCountRef.current = 0;
    } catch (err) {
      console.error('Error clearing notifications:', err);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) {
            setTimeout(() => markAllRead(), 1500);
          }
        }}
        className="relative p-2 rounded-lg hover:bg-slate-700 text-slate-300 transition-colors"
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 ${bellAnim ? 'animate-bounce text-cyan-400' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800/95">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-white text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-500 text-white px-1.5 rounded-full font-bold">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-green-400 transition-colors"
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                    title="Tout effacer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Bell className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">Aucune notification</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-700/50">
                  {notifications.map(notif => {
                    const Icon = NOTIF_ICON[notif.type] ?? Bell;
                    const colorClass = NOTIF_COLOR[notif.type] ?? NOTIF_COLOR.print_done;
                    return (
                      <div
                        key={notif.id}
                        className={`px-4 py-3 flex items-start gap-3 transition-colors hover:bg-slate-700/30 ${!notif.read ? 'bg-cyan-600/5' : ''}`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{notif.title}</p>
                          <p className="text-xs text-slate-400 line-clamp-2">{notif.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {notif.actor_name && (
                              <span className="text-[10px] text-slate-500">par {notif.actor_name}</span>
                            )}
                            <span className="text-[10px] text-slate-500">{timeAgo(notif.created_at)}</span>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-red-400 transition-colors shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export async function sendNotification(
  type: NotificationType,
  targetRole: UserRole | 'all',
  title: string,
  message: string,
  actorName: string,
  saleId?: string,
  targetUserId?: string
): Promise<void> {
  try {
    await supabase.from('notifications').insert({
      type,
      target_role: targetRole,
      target_user_id: targetUserId ?? null,
      title,
      message,
      actor_name: actorName,
      sale_id: saleId ?? null,
    });
  } catch (err) {
    console.error('Error sending notification:', err);
  }
}

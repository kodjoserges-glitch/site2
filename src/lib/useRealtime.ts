import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

/**
 * Subscribes to realtime changes on one or more tables and calls `onUpdate`
 * whenever an INSERT, UPDATE, or DELETE event fires. The callback is debounced
 * so a burst of changes triggers a single refetch.
 */
export function useRealtime(
  tables: string[],
  onUpdate: () => void,
  enabled = true
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(), 300);
    };

    const channel = supabase
      .channel(`realtime-${tables.join('-')}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tables[0] },
        debounced
      );

    for (let i = 1; i < tables.length; i++) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tables[i] },
        debounced
      );
    }

    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tables.join(',')]);
}

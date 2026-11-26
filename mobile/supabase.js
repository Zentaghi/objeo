import 'react-native-url-polyfill/auto';
import './crypto-polyfill';
import { secureStorage } from './secure-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// Same public client configuration as the existing Objeo web app.
export const url = 'https://cvsecsmaczyadidapuyi.supabase.co';
export const db = createClient(url, 'sb_publishable_btaX4jgtCGbB4piFnoiJfQ_JZkFMN2P', {
  auth: { storage: secureStorage, flowType:'pkce', autoRefreshToken: true, persistSession: true,
    detectSessionInUrl: false, lock: processLock },
});
export function bindRefresh() {
  // Remove obsolete plaintext session from the initial preview, without touching favorites.
  AsyncStorage.multiRemove(['sb-cvsecsmaczyadidapuyi-auth-token','sb-cvsecsmaczyadidapuyi-auth-token-code-verifier']).catch(()=>{});
  const update = state => state === 'active' ? db.auth.startAutoRefresh() : db.auth.stopAutoRefresh();
  update(AppState.currentState);
  const listener = AppState.addEventListener('change', update);
  return () => { listener.remove(); db.auth.stopAutoRefresh(); };
}
export function photoUrl(path) {
  return path ? db.storage.from('ad-photos').getPublicUrl(path).data.publicUrl : null;
}

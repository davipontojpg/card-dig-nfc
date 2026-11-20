import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { WorkspaceContext } from '../types/domain';

export const authService = {
  async getSession(): Promise<Session | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  async signInWithPassword(email: string, password: string): Promise<{ user: User; session: Session }> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw error;
    if (!data.user || !data.session) {
      throw new Error('Não foi possível iniciar a sessão. Verifique suas credenciais.');
    }
    return { user: data.user, session: data.session };
  },

  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async resetPasswordForEmail(email: string, redirectTo: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    });
    if (error) throw error;
  },

  async updatePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  async getMyWorkspaces(): Promise<WorkspaceContext> {
    const { data, error } = await supabase.rpc('get_my_workspaces');
    if (error) throw error;
    return data as unknown as WorkspaceContext;
  },
};


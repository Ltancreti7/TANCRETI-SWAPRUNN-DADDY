import { supabase, UserRole } from './supabase';

export async function signUp(email: string, password: string, role: UserRole) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role,
      },
    },
  });

  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  return user;
}

export async function getUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const metadataRole = user.user_metadata?.role as UserRole | undefined;
  if (metadataRole) return metadataRole;

  const { data: dealerAdmin, error: dealerError } = await supabase
    .from('dealer_admins')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (dealerError) console.error('Error checking dealer role:', dealerError);
  if (dealerAdmin) return 'dealer';

  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (salesError) console.error('Error checking sales role:', salesError);
  if (sales) return 'sales';

  const { data: driver, error: driverError } = await supabase
    .from('drivers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();
  if (driverError) console.error('Error checking driver role:', driverError);
  if (driver) return 'driver';

  return null;
}

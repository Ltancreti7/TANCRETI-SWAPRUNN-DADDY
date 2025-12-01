import { supabase, AdminInvitation, DealerAdmin } from './supabase';

export async function checkAndAcceptPendingInvitations(userEmail: string, _userId: string): Promise<{
  accepted: AdminInvitation[];
  errors: string[];
}> {
  const accepted: AdminInvitation[] = [];
  const errors: string[] = [];

  try {
    const { data: pendingInvitations, error: fetchError } = await supabase
      .from('admin_invitations')
      .select('*')
      .ilike('email', userEmail)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Failed to fetch invitations:', fetchError);
      errors.push(`Failed to fetch invitations: ${fetchError.message}`);
      return { accepted, errors };
    }

    if (!pendingInvitations || pendingInvitations.length === 0) {
      return { accepted, errors };
    }

    console.log(`Found ${pendingInvitations.length} pending invitation(s) for ${userEmail}`);

    for (const invitation of pendingInvitations) {
      try {
        console.log(`Processing invitation ${invitation.id} for role: ${invitation.role}`);

        const { data: result, error: acceptError } = await supabase
          .rpc('accept_admin_invitation', { invitation_token: invitation.token });

        if (acceptError) {
          console.error('Error accepting invitation:', acceptError);
          errors.push(`Failed to accept invitation: ${acceptError.message}`);
          continue;
        }

        if (result && result.success) {
          console.log('Invitation accepted successfully:', result);
          accepted.push(invitation);
        } else {
          console.warn('Invitation acceptance returned false:', result);
          if (result && result.error) {
            errors.push(result.error);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error processing invitation';
        console.error('Exception processing invitation:', err);
        errors.push(message);
      }
    }

    return { accepted, errors };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process invitations';
    console.error('Exception in checkAndAcceptPendingInvitations:', err);
    errors.push(message);
    return { accepted, errors };
  }
}

export async function getUserAdminRoles(userId: string): Promise<DealerAdmin[]> {
  try {
    const { data, error } = await supabase
      .from('dealer_admins')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Failed to fetch admin roles:', error);
      return [];
    }

    return data || [];
  } catch (err: unknown) {
    console.error('Error fetching admin roles:', err);
    return [];
  }
}

export async function getUserAdminRoleForDealer(userId: string, dealerId: string): Promise<DealerAdmin | null> {
  try {
    const { data, error } = await supabase
      .from('dealer_admins')
      .select('*')
      .eq('user_id', userId)
      .eq('dealer_id', dealerId)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch admin role:', error);
      return null;
    }

    return data;
  } catch (err: unknown) {
    console.error('Error fetching admin role:', err);
    return null;
  }
}

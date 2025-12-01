import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function useDriverRating() {
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [pendingRating, setPendingRating] = useState<{
    driverId: string;
    driverName: string;
    dealerId: string;
    userId: string;
  } | null>(null);

  const promptForRating = (driverId: string, driverName: string, dealerId: string, userId: string) => {
    setPendingRating({ driverId, driverName, dealerId, userId });
    setIsRatingModalOpen(true);
  };

  const submitRating = async (rating: number) => {
    if (!pendingRating) return;

    const { driverId, dealerId, userId } = pendingRating;

    const { data: existingPref } = await supabase
      .from('driver_preferences')
      .select('*')
      .eq('user_id', userId)
      .eq('driver_id', driverId)
      .eq('dealer_id', dealerId)
      .maybeSingle();

    if (existingPref) {
      await supabase
        .from('driver_preferences')
        .update({
          preference_level: rating,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingPref.id);
    } else {
      await supabase
        .from('driver_preferences')
        .insert({
          user_id: userId,
          driver_id: driverId,
          dealer_id: dealerId,
          preference_level: rating,
          use_count: 1,
        });
    }

    setIsRatingModalOpen(false);
    setPendingRating(null);
  };

  const closeRatingModal = () => {
    setIsRatingModalOpen(false);
    setPendingRating(null);
  };

  return {
    isRatingModalOpen,
    pendingRating,
    promptForRating,
    submitRating,
    closeRatingModal,
  };
}
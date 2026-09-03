-- Booking placed without a currently-valid vaccine certificate for the
-- stay, after the customer was warned and chose to proceed anyway.
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_VACCINATION';

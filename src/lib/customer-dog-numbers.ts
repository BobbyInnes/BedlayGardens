export function formatCustomerNumber(customerNumber: number): string {
  return `CUST-${String(customerNumber).padStart(5, "0")}`
}

export function formatDogNumber(dogNumber: number): string {
  return `DOG-${String(dogNumber).padStart(5, "0")}`
}

// Deliberately a different style ("Booking 001") from CUST-/DOG- above —
// matches the exact format requested for the booking-confirmation email's
// "Booking Ref" line, not the customer/dog reference convention.
export function formatBookingNumber(bookingNumber: number): string {
  return `Booking ${String(bookingNumber).padStart(3, "0")}`
}

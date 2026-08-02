export function formatCustomerNumber(customerNumber: number): string {
  return `CUST-${String(customerNumber).padStart(5, "0")}`
}

export function formatDogNumber(dogNumber: number): string {
  return `DOG-${String(dogNumber).padStart(5, "0")}`
}

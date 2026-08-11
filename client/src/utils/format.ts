// Format currency in Ghana Cedis
export function formatCedis(amount: number): string {
  return `GH₵ ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

// Format datetime for display
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-GH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

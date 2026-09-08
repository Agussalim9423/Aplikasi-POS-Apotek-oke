/**
 * Opens a print window synchronously. This must be called directly from a
 * user click when the caller has asynchronous work to do before printing.
 */
export function openPrintWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    window.alert('Jendela cetak diblokir browser. Izinkan pop-up untuk situs ini lalu coba cetak kembali.');
    return null;
  }
  return printWindow;
}

/** Write HTML to an already-open print window and invoke the browser print dialog. */
export function printIntoWindow(printWindow: Window, html: string, onPrinted?: () => void): boolean {
  try {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    const requestPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } finally {
        onPrinted?.();
      }
    };
    if ('requestAnimationFrame' in window) window.requestAnimationFrame(requestPrint);
    else requestPrint();
    return true;
  } catch (error) {
    onPrinted?.();
    try { printWindow.close(); } catch { /* ignore */ }
    console.error('Print failed', error);
    return false;
  }
}

/** Print immediately when called directly from a button. */
export function printHtml(html: string, _fallbackDelay = 0, onPrinted?: () => void): boolean {
  const printWindow = openPrintWindow();
  if (!printWindow) return false;
  return printIntoWindow(printWindow, html, onPrinted);
}

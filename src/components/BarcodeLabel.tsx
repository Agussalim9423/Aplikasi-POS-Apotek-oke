import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer, X } from 'lucide-react';
import type { Medicine } from '@/lib/supabase';
import { formatCurrency } from '@/lib/supabase';

type Props = {
  medicine: Medicine;
  onClose: () => void;
};

const LABEL_WIDTH = 40; // mm
const LABEL_HEIGHT = 25; // mm

export default function BarcodeLabel({ medicine, onClose }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && medicine.barcode) {
      try {
        JsBarcode(svgRef.current, medicine.barcode, {
          format: 'CODE128',
          width: 2,
          height: 40,
          displayValue: true,
          fontSize: 10,
          margin: 4,
        });
      } catch { /* ignore */ }
    }
  }, [medicine.barcode]);

  function printLabels() {
    const svg = svgRef.current;
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const name = medicine.name;
    const price = formatCurrency(medicine.sell_price);
    const barcode = medicine.barcode ?? '';

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Label Barcode - ${name}</title>
    <style>
      @page { size: ${LABEL_WIDTH}mm ${LABEL_HEIGHT}mm; margin: 0; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${LABEL_WIDTH}mm; margin: 0; padding: 0; }
      .label {
        width: ${LABEL_WIDTH}mm;
        height: ${LABEL_HEIGHT}mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 1.5mm;
        page-break-after: always;
        font-family: 'Arial', sans-serif;
      }
      .name {
        font-size: 8px;
        font-weight: bold;
        text-align: center;
        line-height: 1.1;
        max-width: 36mm;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .price {
        font-size: 9px;
        font-weight: bold;
        color: #000;
        margin-top: 0.5mm;
      }
      .barcode-svg { margin-top: 0.5mm; }
      .barcode-svg svg { width: 34mm; height: 10mm; }
    </style></head><body>
    ${Array(1).fill(0).map(() => `
      <div class="label">
        <div class="name">${escapeHtml(name)}</div>
        <div class="price">${escapeHtml(price)}</div>
        <div class="barcode-svg">${svgData}</div>
        <div style="font-size:7px; color:#666;">${escapeHtml(barcode)}</div>
      </div>
    `).join('')}
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); return; }
    doc.open();
    doc.write(html);
    doc.close();

    const cleanup = () => { try { document.body.removeChild(iframe); } catch { /* */ } };
    iframe.onload = () => {
      const w = iframe.contentWindow;
      if (!w) { cleanup(); return; }
      w.focus();
      w.print();
      setTimeout(cleanup, 500);
    };
    setTimeout(() => {
      const w = iframe.contentWindow;
      if (!w) { cleanup(); return; }
      try { w.focus(); w.print(); } catch { /* */ }
      setTimeout(cleanup, 500);
    }, 400);
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Cetak Label Barcode</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {/* Preview */}
          <div className="flex flex-col items-center bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-sm font-bold text-gray-800 text-center">{medicine.name}</p>
            <p className="text-lg font-bold text-teal-600 mt-1">{formatCurrency(medicine.sell_price)}</p>
            <svg ref={svgRef} className="mt-2 max-w-full"></svg>
            <p className="text-xs text-gray-400 mt-1">{medicine.barcode ?? 'No barcode'}</p>
          </div>

          {!medicine.barcode && (
            <div className="bg-amber-50 text-amber-700 text-sm rounded-xl px-3 py-2.5">
              Obat ini belum memiliki barcode. Tambahkan barcode terlebih dahulu di form edit obat.
            </div>
          )}

          <button
            onClick={printLabels}
            disabled={!medicine.barcode}
            className="w-full bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Printer size={16} /> Cetak Label
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

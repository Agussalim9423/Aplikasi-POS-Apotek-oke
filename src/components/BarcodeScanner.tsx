import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, ScanLine, Keyboard, AlertCircle } from 'lucide-react';

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
};

export default function BarcodeScanner({ onScan, onClose, title = 'Scan Barcode' }: Props) {
  const [mode, setMode] = useState<'camera' | 'usb'>('camera');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = useRef(`qr-${Date.now()}`);
  const usbBufferRef = useRef('');
  const usbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      const scanner = new Html5Qrcode(containerId.current);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText: string) => {
          onScanRef.current(decodedText);
        },
        undefined
      );
      setCameraReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCameraError(`Tidak dapat mengakses kamera: ${msg}. Pastikan izin kamera diberikan.`);
    }
  }, []);

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }
    setCameraReady(false);
  }, []);

  useEffect(() => {
    if (mode === 'camera') startCamera();
    return () => { stopCamera(); };
  }, [mode, startCamera, stopCamera]);

  // USB scanner: acts as a keyboard, types characters fast then Enter
  useEffect(() => {
    if (mode !== 'usb') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (usbBufferRef.current.trim()) {
          onScanRef.current(usbBufferRef.current.trim());
          usbBufferRef.current = '';
        }
        return;
      }
      if (e.key.length === 1) {
        usbBufferRef.current += e.key;
        if (usbTimerRef.current) clearTimeout(usbTimerRef.current);
        usbTimerRef.current = setTimeout(() => { usbBufferRef.current = ''; }, 100);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mode]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
      setManualCode('');
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ScanLine size={20} className="text-teal-600" />
            <h3 className="font-bold text-gray-800">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setMode('camera')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'camera' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Camera size={16} /> Kamera HP
            </button>
            <button
              onClick={() => { setMode('usb'); stopCamera(); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'usb' ? 'bg-white text-teal-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Keyboard size={16} /> Scanner USB
            </button>
          </div>

          {/* Camera mode */}
          {mode === 'camera' && (
            <div>
              {cameraError && (
                <div className="flex items-start gap-2 bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2.5 mb-3">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{cameraError}</span>
                </div>
              )}
              <div id={containerId.current} className="w-full rounded-xl overflow-hidden bg-gray-900 aspect-video flex items-center justify-center">
                {!cameraReady && !cameraError && (
                  <div className="text-white/50 text-sm flex flex-col items-center gap-2">
                    <div className="animate-spin w-6 h-6 border-2 border-white/30 border-t-white rounded-full" />
                    <span>Memulai kamera...</span>
                  </div>
                )}
              </div>
              {cameraReady && (
                <p className="text-xs text-gray-400 text-center mt-2">Arahkan barcode ke kamera. Scan otomatis.</p>
              )}
            </div>
          )}

          {/* USB mode */}
          {mode === 'usb' && (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <Keyboard size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 font-medium">Siap menerima input scanner USB</p>
              <p className="text-xs text-gray-400 mt-1">Pindai barcode dengan scanner USB Anda. Kursor fokus di sini tidak diperlukan.</p>
            </div>
          )}

          {/* Manual input fallback */}
          <form onSubmit={handleManualSubmit} className="border-t border-gray-100 pt-4">
            <label className="text-xs text-gray-500 font-medium">Input Manual</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                placeholder="Ketik barcode manual..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              <button type="submit" className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                Cari
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  Camera,
  X,
  ScanLine,
  Keyboard,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

type Props = {
  onScan: (code: string) => void;
  onClose: () => void;
  title?: string;
};

export default function BarcodeScanner({
  onScan,
  onClose,
  title = 'Scan Barcode',
}: Props) {
  const [mode, setMode] = useState<'camera' | 'usb'>(
    'camera',
  );

  const [cameraReady, setCameraReady] =
    useState(false);

  const [cameraError, setCameraError] =
    useState<string | null>(null);

  const [manualCode, setManualCode] =
    useState('');

  const containerId = useRef(
    `barcode-scanner-${Math.random()
      .toString(36)
      .substring(2, 11)}`,
  );

  const scannerRef =
    useRef<Html5Qrcode | null>(null);

  const mountedRef = useRef(true);

  const startingRef = useRef(false);

  const scanningRef = useRef(false);

  const processingScanRef = useRef(false);

  const onScanRef = useRef(onScan);

  const usbBufferRef = useRef('');

  const usbTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );

  onScanRef.current = onScan;

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      scanningRef.current = false;

      if (mountedRef.current) {
        setCameraReady(false);
      }

      return;
    }

    scannerRef.current = null;

    try {
      if (scanningRef.current) {
        await scanner.stop();
      }
    } catch (error) {
      console.warn(
        'Gagal menghentikan scanner:',
        error,
      );
    }

    try {
      await scanner.clear();
    } catch (error) {
      console.warn(
        'Gagal membersihkan scanner:',
        error,
      );
    }

    scanningRef.current = false;
    startingRef.current = false;

    if (mountedRef.current) {
      setCameraReady(false);
    }
  }, []);

  const handleDetectedCode = useCallback(
    (code: string) => {
      const cleanCode = code.trim();

      if (!cleanCode) return;

      if (processingScanRef.current) return;

      processingScanRef.current = true;

      onScanRef.current(cleanCode);

      window.setTimeout(() => {
        processingScanRef.current = false;
      }, 1000);
    },
    [],
  );

  const startCamera = useCallback(async () => {
    if (startingRef.current) return;

    if (scanningRef.current) return;

    const element = document.getElementById(
      containerId.current,
    );

    if (!element) {
      return;
    }

    startingRef.current = true;

    if (mountedRef.current) {
      setCameraError(null);
      setCameraReady(false);
    }

    try {
      await stopCamera();

      if (!mountedRef.current) return;

      const scanner = new Html5Qrcode(
        containerId.current,
      );

      scannerRef.current = scanner;

      const scannerConfig = {
        fps: 10,
        qrbox: {
          width: 250,
          height: 150,
        },
        aspectRatio: 1.7778,
        disableFlip: false,
      };

      const onDecoded = (decodedText: string) => {
        handleDetectedCode(decodedText);
      };

      const onDecodeError = () => {
        // Error pembacaan barcode diabaikan karena scanner
        // terus mencoba membaca frame berikutnya.
      };

      try {
        // html5-qrcode yang digunakan project ini hanya menerima
        // facingMode sebagai string atau object dengan properti `exact`.
        // `ideal` menyebabkan error:
        // "'facingMode' should be string or object with exact as key."
        await scanner.start(
          {
            facingMode: {
              exact: 'environment',
            },
          },
          scannerConfig,
          onDecoded,
          onDecodeError,
        );
      } catch (environmentError) {
        // Sebagian laptop/webcam tidak mempunyai kamera belakang.
        // Coba kamera depan agar scanner tetap bisa digunakan.
        console.warn(
          'Kamera belakang tidak tersedia, mencoba kamera lain:',
          environmentError,
        );

        await scanner.start(
          {
            facingMode: 'user',
          },
          scannerConfig,
          onDecoded,
          onDecodeError,
        );
      }

      scanningRef.current = true;

      if (mountedRef.current) {
        setCameraReady(true);
        setCameraError(null);
      }
    } catch (error) {
      console.error(
        'Gagal memulai kamera:',
        error,
      );

      scanningRef.current = false;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      if (mountedRef.current) {
        setCameraError(
          `Kamera tidak dapat digunakan. ${message}`,
        );

        setCameraReady(false);
      }

      try {
        if (scannerRef.current) {
          await scannerRef.current.clear();
        }
      } catch {
        // ignore
      }

      scannerRef.current = null;
    } finally {
      startingRef.current = false;
    }
  }, [handleDetectedCode, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (usbTimerRef.current) {
        clearTimeout(usbTimerRef.current);
      }

      void stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (mode !== 'camera') {
      void stopCamera();

      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!cancelled) {
        void startCamera();
      }
    }, 150);

    return () => {
      cancelled = true;

      window.clearTimeout(timer);

      void stopCamera();
    };
  }, [
    mode,
    startCamera,
    stopCamera,
  ]);

  useEffect(() => {
    if (mode !== 'usb') return;

    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      const isTypingManually =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;

      if (isTypingManually) {
        return;
      }

      if (event.key === 'Enter') {
        const code =
          usbBufferRef.current.trim();

        if (code) {
          handleDetectedCode(code);
        }

        usbBufferRef.current = '';

        return;
      }

      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        usbBufferRef.current += event.key;

        if (usbTimerRef.current) {
          clearTimeout(
            usbTimerRef.current,
          );
        }

        usbTimerRef.current =
          setTimeout(() => {
            usbBufferRef.current = '';
          }, 300);
      }
    };

    window.addEventListener(
      'keydown',
      handler,
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handler,
      );

      if (usbTimerRef.current) {
        clearTimeout(
          usbTimerRef.current,
        );
      }

      usbBufferRef.current = '';
    };
  }, [
    mode,
    handleDetectedCode,
  ]);

  function handleManualSubmit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    const code = manualCode.trim();

    if (!code) return;

    handleDetectedCode(code);

    setManualCode('');
  }

  async function handleClose() {
    await stopCamera();

    onClose();
  }

  async function switchMode(
    nextMode: 'camera' | 'usb',
  ) {
    if (nextMode === mode) return;

    if (nextMode === 'usb') {
      await stopCamera();
    }

    setCameraError(null);
    setCameraReady(false);
    setMode(nextMode);
  }

  async function retryCamera() {
    await stopCamera();

    if (mountedRef.current) {
      setCameraError(null);
      setCameraReady(false);
    }

    window.setTimeout(() => {
      if (mountedRef.current) {
        void startCamera();
      }
    }, 150);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      onClick={() => {
        void handleClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ScanLine
              size={20}
              className="text-teal-600"
            />

            <h3 className="font-bold text-gray-800">
              {title}
            </h3>
          </div>

          <button
            type="button"
            onClick={() => {
              void handleClose();
            }}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            aria-label="Tutup scanner"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => {
                void switchMode(
                  'camera',
                );
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'camera'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Camera size={16} />
              Kamera
            </button>

            <button
              type="button"
              onClick={() => {
                void switchMode('usb');
              }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                mode === 'usb'
                  ? 'bg-white text-teal-600 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Keyboard size={16} />
              Scanner USB
            </button>
          </div>

          {mode === 'camera' && (
            <div>
              {cameraError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      size={18}
                      className="text-red-500 flex-shrink-0 mt-0.5"
                    />

                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-700">
                        Kamera tidak dapat digunakan
                      </p>

                      <p className="text-xs text-red-600 mt-1 break-words">
                        {cameraError}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void retryCamera();
                    }}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-sm font-semibold"
                  >
                    <RefreshCw size={15} />
                    Coba Lagi
                  </button>
                </div>
              )}

              <div className="relative w-full min-h-[230px] rounded-xl overflow-hidden bg-gray-900">
                <div
                  id={containerId.current}
                  className="w-full min-h-[230px]"
                />

                {!cameraReady &&
                  !cameraError && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70 pointer-events-none">
                      <div className="animate-spin w-7 h-7 border-2 border-white/30 border-t-white rounded-full" />

                      <span className="text-sm">
                        Memulai kamera...
                      </span>
                    </div>
                  )}
              </div>

              {cameraReady && (
                <p className="text-xs text-gray-400 text-center mt-2">
                  Arahkan barcode ke kamera.
                  Barcode akan terbaca otomatis.
                </p>
              )}
            </div>
          )}

          {mode === 'usb' && (
            <div className="bg-gray-50 rounded-xl p-6 text-center">
              <Keyboard
                size={32}
                className="mx-auto text-gray-400 mb-3"
              />

              <p className="text-sm text-gray-700 font-semibold">
                Scanner USB siap digunakan
              </p>

              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Klik scanner USB lalu pindai barcode.
                Scanner akan mengirim kode seperti
                keyboard dan otomatis diproses saat
                tombol Enter diterima.
              </p>
            </div>
          )}

          <form
            onSubmit={handleManualSubmit}
            className="border-t border-gray-100 pt-4"
          >
            <label className="text-xs text-gray-500 font-medium">
              Input Manual
            </label>

            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={manualCode}
                onChange={(event) =>
                  setManualCode(
                    event.target.value,
                  )
                }
                placeholder="Ketik barcode..."
                className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />

              <button
                type="submit"
                className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold"
              >
                Cari
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera } from "lucide-react";

export default function QrScanner({
  open,
  onClose,
  onScan,
}: {
  open: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    const id = "qr-scanner-region";
    const start = async () => {
      try {
        const cams = await Html5Qrcode.getCameras();
        if (!cams || cams.length === 0) {
          setError("No camera detected on this device. Use manual entry below.");
          return;
        }
        const scanner = new Html5Qrcode(id);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decoded) => {
            onScan(decoded.trim());
            scanner.stop().catch(() => {});
            scannerRef.current = null;
            onClose();
          },
          () => {}
        );
      } catch (e) {
        setError("Unable to access camera. You can type the code manually.");
      }
    };
    start();
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [open, onScan, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Scan Product QR</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
          <div id="qr-scanner-region" ref={ref} className="aspect-square w-full" />
        </div>
        {error && (
          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <Camera className="mr-1 inline" size={14} /> {error}
          </div>
        )}
        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase text-slate-500">
            Or enter SKU / QR code manually
          </label>
          <div className="flex gap-2">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="JANVI-NK-AZ-001"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
            <button
              onClick={() => {
                if (manual.trim()) {
                  onScan(manual.trim());
                  setManual("");
                  onClose();
                }
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Look up
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

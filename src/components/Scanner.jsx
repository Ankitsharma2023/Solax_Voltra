import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Camera scanner for the QR code / barcode on the inverter and WiFi dongle labels (SolaX "scan to add").
// Uses the browser's own BarcodeDetector where it exists (Android Chrome) and the zxing-wasm ponyfill elsewhere (iPhone).
const FORMATS = ['qr_code', 'code_128', 'code_39', 'data_matrix', 'ean_13'];

async function detector() {
  if ('BarcodeDetector' in window) {
    const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => []);
    const formats = FORMATS.filter((f) => supported.includes(f));
    if (formats.length) return new window.BarcodeDetector({ formats });
  }
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: FORMATS });
}

// Labels sometimes encode more than the number (e.g. "SN:H34…;PN:…"). Prefer a token of the expected length.
export function pickCode(text, length) {
  const tokens = String(text).toUpperCase().split(/[^A-Z0-9]+/).filter((t) => t.length >= 6);
  return tokens.find((t) => t.length === length) || tokens.sort((a, b) => b.length - a.length)[0] || String(text).trim().toUpperCase();
}

export function Scanner({ title, onResult, onClose }) {
  const video = useRef(null);
  const [error, setError] = useState(null);
  const done = useRef(onResult);
  done.current = onResult;

  useEffect(() => {
    let stream, timer, stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream;
        await video.current.play();
        const det = await detector();
        const tick = async () => {
          if (stopped) return;
          const codes = await det.detect(video.current).catch(() => []);
          if (codes[0]?.rawValue) { navigator.vibrate?.(60); done.current(codes[0].rawValue); return; }
          timer = setTimeout(tick, 200);
        };
        tick();
      } catch (e) {
        setError(e?.name === 'NotAllowedError' ? 'Camera permission was denied. Allow the camera for this site, or type the number.' : 'Could not open the camera on this device. Please type the number.');
      }
    })();
    return () => { stopped = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  return createPortal(
    <div className="scanner" role="dialog" aria-label={title}>
      <video ref={video} playsInline muted />
      <div className="scanner-frame"><span className="scanner-line" /></div>
      <div className="scanner-top">
        <button className="scanner-close" onClick={onClose} aria-label="Close">✕</button>
        <b>{title}</b>
      </div>
      <p className="scanner-hint">{error || 'Point the camera at the QR code or barcode on the label'}</p>
    </div>,
    document.body,
  );
}

// Input with a scan button, for the inverter SN and dongle registration no.
export function ScanInput({ value, onChange, length, scanTitle, ...props }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="scan-input">
      <input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} autoCapitalize="characters" {...props} />
      <button type="button" className="scan-btn" aria-label={`Scan ${scanTitle}`} onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16" />
        </svg>
      </button>
      {open && <Scanner title={`Scan ${scanTitle}`} onClose={() => setOpen(false)}
        onResult={(text) => { onChange(pickCode(text, length)); setOpen(false); }} />}
    </span>
  );
}

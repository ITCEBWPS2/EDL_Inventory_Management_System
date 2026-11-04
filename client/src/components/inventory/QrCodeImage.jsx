import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

const svgCache = new Map();

/**
 * High-definition vector QR code component for label printing and preview
 */
export const QrCodeImage = ({ value, size = 48, className = '' }) => {
  const [svgString, setSvgString] = useState(() => svgCache.get(value) || '');

  useEffect(() => {
    if (!value) {
      setSvgString('');
      return;
    }
    if (svgCache.has(value)) {
      setSvgString(svgCache.get(value));
      return;
    }
    let isCurrent = true;
    QRCode.toString(value, {
      type: 'svg',
      margin: 0,
      errorCorrectionLevel: 'M'
    })
      .then((svg) => {
        svgCache.set(value, svg);
        if (isCurrent) setSvgString(svg);
      })
      .catch((err) => {
        console.error('Failed to generate QR code SVG', err);
      });

    return () => {
      isCurrent = false;
    };
  }, [value]);

  if (!svgString) {
    return (
      <div
        className={`shrink-0 bg-slate/10 animate-pulse rounded ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    );
  }

  return (
    <div
      className={`shrink-0 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  );
};


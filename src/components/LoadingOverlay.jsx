import React from 'react';

export default function LoadingOverlay({ message }) {
  return (
    <div className="overlay">
      <div className="loader"></div>
      <div className="log">{message || 'Loading...'}</div>
    </div>
  );
}

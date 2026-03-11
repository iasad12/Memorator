import React from 'react';
import { useApp } from '../contexts/AppContext';

export default function Header() {
  const { state, dispatch } = useApp();

  return (
    <header className="app-header">
      <div className="header-left">
        <button
          className="btn-toggle-sidebar"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          title="Toggle Sidebar"
        >
          ☰
        </button>
        <h1 className="app-title" style={{ display: 'flex', alignItems: 'center' }}>
          Memorator <span className="app-version" style={{ marginLeft: '6px' }}>v1.0</span>
        </h1>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          className="btn btn-primary"
          onClick={() => dispatch({ type: 'SHOW_EBOOK_MODAL', payload: true })}
          disabled={Object.keys(state.chats).length === 0}
          title="Generate PDF Ebook"
        >
          📖 Ebook Creator
        </button>
        <button className="btn" onClick={() => dispatch({ type: 'RESET_VIEW' })}>
          Back to List
        </button>
      </div>
    </header>
  );
}

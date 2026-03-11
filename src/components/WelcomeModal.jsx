import React, { useState, useEffect } from 'react';

export default function WelcomeModal({ onComplete }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem('chatExporter_welcomeSeen');
    if (!hasSeen) {
      setIsOpen(true);
    } else if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  const handleClose = () => {
    localStorage.setItem('chatExporter_welcomeSeen', 'true');
    setIsOpen(false);
    if (onComplete) onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="ebook-modal-overlay">
      <div className="ebook-modal" style={{ maxWidth: '600px', padding: '2rem' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '0.5rem' }}>Welcome to Memorator</h2>
        <p style={{ textAlign: 'center', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>
          "In the memory of those who departed"
        </p>

        <p style={{ marginBottom: '1rem', lineHeight: '1.5', color: 'var(--text-main)' }}>
          This powerful tool allows you to safely parse, search, combine, and export your chat history into beautiful Ebooks or comprehensive text scripts directly entirely securely on your browser.
        </p>

        <h3 style={{ color: 'var(--accent-primary)', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', margin: '1.5rem 0 1rem 0' }}>How to Obtain Your Data</h3>
        
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '4px', color: 'white' }}>Meta Messenger:</strong>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Request your data download from Facebook Settings &gt; Download Profile Information. Ensure you select the JSON or HTML format for messages.</span>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <strong style={{ display: 'block', marginBottom: '4px', color: 'white' }}>WhatsApp:</strong>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Open a chat &gt; More Options &gt; Export Chat. You can upload the resulting `.txt` file or the entire `.zip` archive directly!</span>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
          <strong style={{ display: 'block', marginBottom: '4px', color: 'white' }}>SMS / Text Messages:</strong>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            To extract your SMS data from Android, we highly recommend using the free, open-source application <strong>SMS Import and Export</strong>. 
            <br/><br/>
            You can obtain it from F-Droid here: <a href="https://f-droid.org/packages/com.github.tmo1.sms_ie/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>com.github.tmo1.sms_ie</a>
          </span>
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2rem', marginBottom: '1.5rem', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          Ideated by <a href="https://asadimran.pages.dev/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>Asad Imran Shah</a>, Made with Antigravity
        </p>

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '0.8rem', fontSize: '1rem', fontWeight: 'bold' }} 
          onClick={handleClose}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}

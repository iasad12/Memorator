import React, { useEffect } from 'react';
import { useApp } from './contexts/AppContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ContentArea from './components/ContentArea';
import LoadingOverlay from './components/LoadingOverlay';
import EbookModal from './components/Ebook/EbookModal';
import WelcomeModal from './components/WelcomeModal';

export default function App() {
  const { state, dispatch } = useApp();

  // Recalculate stats when config changes
  useEffect(() => {
    if (state.messages.length > 0) {
      dispatch({ type: 'RECALCULATE' });
    }
  }, [state.myNames, state.excludeNames, state.aliasMap]);

  return (
    <>
      <Header />
      <main className="app-main">
        <div 
          className={`sidebar-overlay ${!state.sidebarCollapsed ? 'active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        />
        <Sidebar />
        <ContentArea />
      </main>
      {state.loading && <LoadingOverlay message={state.loadingMessage} />}
      {state.showEbookModal && <EbookModal />}
      <WelcomeModal />
    </>
  );
}

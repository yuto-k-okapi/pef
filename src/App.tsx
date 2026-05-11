import { useState } from 'react';
import { LibraryScreen } from './components/screens/LibraryScreen';
import { EditorScreen } from './components/screens/EditorScreen';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';

export default function App() {
  const [activePdfId, setActivePdfId] = useState<string | null>(null);

  return (
    <>
      {activePdfId ? (
        <EditorScreen
          pdfId={activePdfId}
          onBack={() => setActivePdfId(null)}
        />
      ) : (
        <LibraryScreen onOpen={setActivePdfId} />
      )}
      <DiagnosticsPanel />
    </>
  );
}

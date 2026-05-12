import { useState } from 'react';
import { LibraryScreen } from './components/screens/LibraryScreen';
import { EditorScreen } from './components/screens/EditorScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { DiagnosticsPanel } from './components/DiagnosticsPanel';
import { listPdfs, deletePdf } from './lib/idbStorage';

type Route =
  | { name: 'library' }
  | { name: 'editor'; pdfId: string }
  | { name: 'settings' };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'library' });

  async function handleClearAllPdfs() {
    const all = await listPdfs();
    for (const p of all) {
      await deletePdf(p.id);
    }
  }

  return (
    <>
      {route.name === 'editor' && (
        <EditorScreen
          pdfId={route.pdfId}
          onBack={() => setRoute({ name: 'library' })}
        />
      )}
      {route.name === 'library' && (
        <LibraryScreen
          onOpen={(id) => setRoute({ name: 'editor', pdfId: id })}
          onOpenSettings={() => setRoute({ name: 'settings' })}
        />
      )}
      {route.name === 'settings' && (
        <SettingsScreen
          onBack={() => setRoute({ name: 'library' })}
          onClearAllPdfs={handleClearAllPdfs}
        />
      )}
      <DiagnosticsPanel />
    </>
  );
}

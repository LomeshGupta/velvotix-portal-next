'use client';
import { useMemo, useState, createContext, useContext } from 'react';
import { CssBaseline, GlobalStyles, ThemeProvider, createTheme } from '@mui/material';
import PwaRegister from '@/components/PwaRegister';
const Mode = createContext<() => void>(() => {});
export const useToggleMode = () => useContext(Mode);
export default function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const theme = useMemo(() => createTheme({
    palette: { mode, primary: { main: '#1565c0' }, secondary: { main: '#ef6c00' }, background: mode === 'light' ? { default: '#f4f6fb', paper: '#fff' } : { default: '#0f1420', paper: '#171d2b' } },
    shape: { borderRadius: 12 }, typography: { fontFamily: '"Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif', button: { textTransform: 'none', fontWeight: 600 } },
    components: {
      MuiCard: { styleOverrides: { root: { boxShadow: '0 2px 12px rgba(21,101,192,.08)', border: 'none' } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTableCell: { styleOverrides: { head: { fontWeight: 700, background: mode === 'light' ? '#eef3fb' : '#1d2536' } } },
      MuiListItemButton: { styleOverrides: { root: { '&.Mui-selected': { background: 'rgba(21,101,192,.12)', color: '#1565c0', '& .MuiListItemIcon-root': { color: '#1565c0' } } } } },
    } }), [mode]);
  return <Mode.Provider value={() => setMode(m => (m === 'light' ? 'dark' : 'light'))}><ThemeProvider theme={theme}><CssBaseline />
    <GlobalStyles styles={{
      html: { WebkitTextSizeAdjust: '100%', WebkitTapHighlightColor: 'transparent' },
      body: { overscrollBehaviorY: 'none', paddingBottom: 'env(safe-area-inset-bottom, 0px)' },
      // Notch / status-bar clearance when installed (viewport-fit=cover)
      '.MuiAppBar-root': { paddingTop: 'env(safe-area-inset-top, 0px)' },
      '.MuiDrawer-paper': { paddingTop: 'env(safe-area-inset-top, 0px)' },
      // Comfortable touch targets on phones/tablets, and dialogs that fit small screens
      '@media (pointer: coarse)': { '.MuiButton-root, .MuiIconButton-root, .MuiTab-root': { minHeight: 44 }, '.MuiIconButton-root': { minWidth: 44 } },
      '@media (max-width:600px)': { '.MuiDialog-paper': { margin: '8px !important', width: 'calc(100% - 16px) !important', maxWidth: 'none !important', maxHeight: 'calc(100% - 16px) !important' } },
    }} />
    <PwaRegister />{children}</ThemeProvider></Mode.Provider>;
}

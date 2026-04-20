import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import Index from './pages/Index'
import AssetDetail from './pages/AssetDetail'
import Login from './pages/Login'
import Import from './pages/Import'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/asset/:id" element={<AssetDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/import" element={<Import />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
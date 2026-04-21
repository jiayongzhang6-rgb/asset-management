import { BrowserRouter, Route, Routes, useEffect, useNavigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import Index from './pages/Index'
import AssetDetail from './pages/AssetDetail'
import Login from './pages/Login'
import Import from './pages/Import'
import NotFound from './pages/NotFound'

function AppContent() {
  const navigate = useNavigate()
  
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const action = urlParams.get('action')
    const id = urlParams.get('id')
    
    if (action === 'edit' && id) {
      navigate(`/asset/${id}`)
    }
  }, [navigate])
  
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/asset/:id" element={<AssetDetail />} />
      <Route path="/login" element={<Login />} />
      <Route path="/import" element={<Import />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}
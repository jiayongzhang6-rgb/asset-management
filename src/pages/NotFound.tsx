import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md text-center">
        <div className="text-6xl font-bold text-gray-400 mb-4">404</div>
        <h2 className="text-2xl font-bold mb-2">页面未找到</h2>
        <p className="text-gray-600 mb-6">抱歉，您访问的页面不存在或已被删除。</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            返回首页
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            返回上一页
          </button>
        </div>
      </div>
    </div>
  )
}
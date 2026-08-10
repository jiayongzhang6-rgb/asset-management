import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../App'
import toast from 'react-hot-toast'
import {
  formatUserIdentifier,
  getAIValuationConfig,
  saveAIValuationConfig,
  clearAIValuationCache,
  estimateAssetValueWithAI,
  estimateAssetValue,
  formatHardwareSpec,
  type AIValuationConfig
} from '../lib/supabase'

export default function AiValuationSettings() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [config, setConfig] = useState<AIValuationConfig>(getAIValuationConfig())
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [showKey, setShowKey] = useState(false)

  // 示例设备用于测试
  const demoAsset = {
    brand: 'HP',
    model: 'EliteBook 630 G9',
    cpu: '12th Gen Intel(R) Core(TM) i5-1235U',
    ram: '16',
    storage: '512GB SSD',
    gpu: 'Intel(R) UHD Graphics',
    created_at: '2023-06-01T00:00:00Z'
  }

  useEffect(() => {
    setConfig(getAIValuationConfig())
  }, [])

  const handleSave = () => {
    if (!isAdmin) {
      toast.error('只有管理员可以修改配置')
      return
    }
    setSaving(true)
    try {
      saveAIValuationConfig(config)
      toast.success('AI 估值配置已保存')
    } catch (e: any) {
      toast.error(`保存失败: ${e?.message || e}`)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      // 临时保存当前配置（不关闭开关）
      const prev = getAIValuationConfig()
      saveAIValuationConfig({ ...config, enabled: true })

      const aiResult = await estimateAssetValueWithAI(demoAsset)
      const localResult = estimateAssetValue(demoAsset)
      setTestResult({ ai: aiResult, local: localResult, demo: demoAsset })

      // 恢复原 enabled 状态
      saveAIValuationConfig({ enabled: prev.enabled })
    } catch (e: any) {
      toast.error(`测试失败: ${e?.message || e}`)
    } finally {
      setTesting(false)
    }
  }

  const handleClearCache = () => {
    if (!window.confirm('确定要清除 AI 估值缓存吗？下次将重新调用 AI 获取最新行情。')) return
    clearAIValuationCache()
    toast.success('缓存已清除')
  }

  return (
    <div className="min-h-screen">
      <header className="gradient-header text-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
              title="返回首页"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">德泽智联IT资产管理系统</h1>
              <p className="text-xs text-white/70">AI 大模型估值配置</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/80 hidden sm:inline">{formatUserIdentifier(user?.email)}</span>
            {isAdmin && (
              <span className="badge bg-white/20 text-white">管理员</span>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6" style={{ minHeight: '80vh' }}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：配置表单 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 启用开关卡片 */}
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center text-white">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800">启用 AI 大模型估值</h2>
                    <p className="text-xs text-gray-500">打开后，系统将调用大模型获取更贴近真实二手行情的估值；失败时自动回退到本地算法。</p>
                  </div>
                </div>
                <label className="inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={`relative w-14 h-7 rounded-full transition-colors ${config.enabled ? 'bg-indigo-600' : 'bg-gray-300'} ${!isAdmin ? 'opacity-50' : ''}`}>
                    <div className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${config.enabled ? 'translate-x-7' : ''}`} />
                  </div>
                </label>
              </div>
              {config.enabled && !config.apiKey && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
                  ⚠️ 已启用 AI 估值，但未填写 API Key，将暂时使用本地算法。
                </div>
              )}
            </div>

            {/* API 配置卡片 */}
            <div className="card">
              <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                API 配置
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">API Base URL</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={config.baseUrl}
                    onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                    placeholder="https://api.openai.com/v1"
                    className="w-full font-mono text-sm"
                  />
                  <p className="text-xs text-gray-400 mt-1">兼容 OpenAI Chat Completions 格式，可填 DeepSeek / 通义 / 智谱 / Kimi 等兼容地址</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      disabled={!isAdmin}
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      placeholder="sk-xxxxxxxxxxxxxxxx"
                      className="w-full font-mono text-sm pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded"
                    >
                      {showKey ? '隐藏' : '显示'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">🔐 仅保存在当前浏览器本地 localStorage，不会上传到服务器。</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">模型名称</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    placeholder="gpt-4o-mini / deepseek-chat / qwen-plus"
                    className="w-full font-mono text-sm"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { label: 'GPT-4o-mini', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
                      { label: 'DeepSeek', base: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
                      { label: '通义千问', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
                      { label: '智谱清言', base: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' }
                    ].map(p => (
                      <button
                        key={p.label}
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => setConfig(prev => ({ ...prev, baseUrl: p.base, model: p.model }))}
                        className="text-xs px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100 disabled:opacity-50"
                      >
                        一键填{p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    缓存有效期：<span className="font-semibold text-indigo-600">{(config.cacheTTL / (60 * 60 * 1000)).toFixed(0)} 小时</span>
                  </label>
                  <input
                    type="range"
                    disabled={!isAdmin}
                    min={1}
                    max={24 * 7}
                    value={Math.round(config.cacheTTL / (60 * 60 * 1000))}
                    onChange={(e) => setConfig({ ...config, cacheTTL: Number(e.target.value) * 60 * 60 * 1000 })}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>1 小时</span>
                    <span>1 天</span>
                    <span>7 天</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={handleSave}
                  disabled={saving || !isAdmin}
                  className="btn btn-primary text-sm"
                >
                  {saving ? (<><div className="spinner !w-4 !h-4 !border-2" />保存中...</>) : ('💾 保存配置')}
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing || !config.enabled || !config.apiKey}
                  className="btn btn-secondary text-sm"
                >
                  {testing ? (<><div className="spinner !w-4 !h-4 !border-2" />估值中...</>) : ('🧪 测试单台估值')}
                </button>
                <button
                  onClick={handleClearCache}
                  className="btn btn-ghost text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  清除缓存
                </button>
                {!isAdmin && (
                  <span className="text-xs text-red-500 self-center">⚠️ 仅管理员可修改</span>
                )}
              </div>
            </div>

            {/* 测试结果卡片 */}
            {testResult && (
              <div className="card bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
                <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  测试结果 · 示例设备
                </h3>
                <div className="text-sm text-gray-600 mb-3 p-2 bg-white/50 rounded-lg font-mono text-xs">
                  配置: {formatHardwareSpec(testResult.demo)} · {testResult.demo.brand} {testResult.demo.model}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-white rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">本地估值（保底）</p>
                    <p className="text-sm text-gray-500">购入 <span className="font-semibold">¥{testResult.local.fixedValue.toLocaleString()}</span></p>
                    <p className="text-lg font-bold text-gray-700">当前 ¥{testResult.local.currentValue.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                    <p className="text-xs text-white/80 mb-1 flex items-center gap-1">
                      ✨ AI 估值
                      <span className="px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">
                        {testResult.ai.source === 'ai' ? 'AI' : '兜底'}
                      </span>
                    </p>
                    <p className="text-sm text-white/90">购入 <span className="font-semibold">¥{testResult.ai.fixedValue.toLocaleString()}</span></p>
                    <p className="text-xl font-bold">当前 ¥{testResult.ai.currentValue.toLocaleString()}</p>
                    {testResult.ai.reason && (
                      <p className="text-xs text-white/80 mt-1 truncate">💡 {testResult.ai.reason}</p>
                    )}
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">差异对比</p>
                    <p className="text-sm">
                      购入差价:
                      <span className={`ml-1 font-semibold ${testResult.ai.fixedValue !== testResult.local.fixedValue ? 'text-indigo-600' : 'text-gray-500'}`}>
                        {(testResult.ai.fixedValue - testResult.local.fixedValue) >= 0 ? '+' : ''}¥{(testResult.ai.fixedValue - testResult.local.fixedValue).toLocaleString()}
                      </span>
                    </p>
                    <p className="text-sm mt-1">
                      当前差价:
                      <span className={`ml-1 font-semibold ${testResult.ai.currentValue !== testResult.local.currentValue ? 'text-indigo-600' : 'text-gray-500'}`}>
                        {(testResult.ai.currentValue - testResult.local.currentValue) >= 0 ? '+' : ''}¥{(testResult.ai.currentValue - testResult.local.currentValue).toLocaleString()}
                      </span>
                    </p>
                    {testResult.ai.error && (
                      <p className="text-xs text-red-500 mt-2">⚠️ {testResult.ai.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：使用说明 */}
          <div className="space-y-6">
            <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
              <h3 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                使用说明
              </h3>
              <ol className="space-y-2.5 text-sm text-gray-600 list-decimal list-inside">
                <li>填入兼容 OpenAI 格式的 API 地址、Key、模型名。</li>
                <li>打开「启用 AI 估值」开关后保存。</li>
                <li>可先点击「测试单台估值」验证效果。</li>
                <li>回到首页/结算单点击「刷新AI估值」即可批量获取最新行情。</li>
              </ol>
            </div>

            <div className="card">
              <h3 className="text-base font-semibold text-gray-800 mb-3">🎯 功能说明</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>参考中国大陆当日闲鱼/转转等二手行情</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>兼容绝大多数 OpenAI 格式大模型服务商</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>自动缓存，相同配置 24h 内不重复消耗 token</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>API 调用/解析失败自动回退本地算法</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-green-500 font-bold">✓</span>
                  <span>首页 & 结算单支持双估值对比展示</span>
                </li>
              </ul>
            </div>

            <div className="card bg-yellow-50 border-yellow-200">
              <h3 className="text-base font-semibold text-yellow-800 mb-2">⚠️ 注意</h3>
              <ul className="space-y-1.5 text-xs text-yellow-700 list-disc list-inside">
                <li>AI 估值仅作参考，实际成交价以谈判为准。</li>
                <li>API Key 保存在本地浏览器，不会上传。</li>
                <li>批量估值会按并发=5 调用，注意额度消耗。</li>
                <li>若接口错误，请检查 Base URL / Key / 模型名是否正确。</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

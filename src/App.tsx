import React from 'react'

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-blue-600 text-white shadow">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold">IT资产管理系统</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm">test@example.com</span>
            <button className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100">
              批量导入
            </button>
            <button className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100">
              + 新增设备
            </button>
            <button className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100">
              <i className="fa fa-cog"></i> 设置
            </button>
            <button className="px-3 py-1 bg-white text-blue-600 rounded text-sm hover:bg-gray-100">
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <i className="fa fa-desktop text-blue-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">资产总数</p>
                <p className="text-2xl font-bold">10</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <i className="fa fa-check-circle text-green-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">使用中</p>
                <p className="text-2xl font-bold">8</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <i className="fa fa-clock-o text-yellow-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">闲置</p>
                <p className="text-2xl font-bold">2</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 rounded-lg">
                <i className="fa fa-trash text-red-600 text-xl"></i>
              </div>
              <div>
                <p className="text-sm text-gray-500">报废</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索资产编码、品牌、使用人..."
                  className="pl-10 pr-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">全部部门</option>
              </select>
              <select className="px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">全部状态</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">资产编码</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPU</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">内存</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">存储</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">显卡</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作系统</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部门</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">位置</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">品牌型号</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">PC-2026-04-001</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Intel i7-12700K</td>
                  <td className="px-4 py-3 text-sm text-gray-900">16GB</td>
                  <td className="px-4 py-3 text-sm text-gray-900">512GB SSD</td>
                  <td className="px-4 py-3 text-sm text-gray-900">RTX 3070</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Windows 11</td>
                  <td className="px-4 py-3 text-sm text-gray-900">技术部</td>
                  <td className="px-4 py-3 text-sm text-gray-900">张三</td>
                  <td className="px-4 py-3 text-sm text-gray-900">A101</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Dell XPS 13</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                      使用中
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <button className="text-blue-500 hover:underline">
                        编辑
                      </button>
                      <button className="text-red-500 hover:underline">
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
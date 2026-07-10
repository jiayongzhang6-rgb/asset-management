import React, { useState, useEffect } from 'react'
import { useAuth } from '../App'
import { supabase } from '../lib/supabase'
import { RentRecord } from '../lib/supabase'

export default function RentDetail() {
  const { user } = useAuth()
  const [rentRecords, setRentRecords] = useState<RentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [departmentFilter, setDepartmentFilter] = useState('all')
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  
  const fetchRentRecords = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('rent_records')
        .select('*')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
      
      if (departmentFilter !== 'all') {
        query = query.eq('department', departmentFilter)
      }
      
      const { data, error } = await query.order('department').order('asset_code')
      if (error) throw error
      setRentRecords(data || [])
    } catch (error) {
      console.error('Error fetching rent records:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const markAsPaid = async (recordId: number) => {
    if (!user?.role === 'admin') return
    try {
      const { error } = await supabase
        .from('rent_records')
        .update({ 
          status: 'paid',
          paid_date: new Date().toISOString()
        })
        .eq('id', recordId)
      if (error) throw error
      fetchRentRecords()
    } catch (error) {
      console.error('Error marking as paid:', error)
    }
  }
  
  const markAsUnpaid = async (recordId: number) => {
    if (!user?.role === 'admin') return
    try {
      const { error } = await supabase
        .from('rent_records')
        .update({ 
          status: 'unpaid',
          paid_date: null
        })
        .eq('id', recordId)
      if (error) throw error
      fetchRentRecords()
    } catch (error) {
      console.error('Error marking as unpaid:', error)
    }
  }
  
  const generateMonthlyRecords = async () => {
    if (!user?.role === 'admin') {
      alert('只有管理员可以生成月租记录')
      return
    }
    
    if (!confirm(`确定要生成 ${selectedYear}年${selectedMonth}月 的月租记录吗？`)) return
    
    try {
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select('id, asset_code, department, user_name, monthly_rent')
        .neq('monthly_rent', 0)
      
      if (assetsError) throw assetsError
      
      const { data: existingRecords, error: existingError } = await supabase
        .from('rent_records')
        .select('asset_code')
        .eq('year', selectedYear)
        .eq('month', selectedMonth)
      
      if (existingError) throw existingError
      
      const existingCodes = new Set((existingRecords || []).map(r => r.asset_code))
      const newRecords = assets
        .filter(a => !existingCodes.has(a.asset_code))
        .map(a => ({
          asset_code: a.asset_code,
          asset_id: a.id,
          department: a.department,
          user_name: a.user_name,
          monthly_rent: Number(a.monthly_rent),
          year: selectedYear,
          month: selectedMonth,
          status: 'unpaid' as const,
          paid_date: null
        }))
      
      if (newRecords.length > 0) {
        const { error: insertError } = await supabase
          .from('rent_records')
          .insert(newRecords)
        if (insertError) throw insertError
      }
      
      alert(`成功生成 ${newRecords.length} 条月租记录`)
      fetchRentRecords()
    } catch (error) {
      console.error('Error generating rent records:', error)
      alert('生成月租记录失败')
    }
  }
  
  const exportToCSV = () => {
    const headers = ['资产编码', '部门', '使用人', '月租费', '状态', '缴费日期']
    const csvContent = [
      headers.join(','),
      ...rentRecords.map(r => [
        r.asset_code,
        r.department || '',
        r.user_name || '',
        r.monthly_rent,
        r.status === 'paid' ? '已缴' : '未缴',
        r.paid_date ? new Date(r.paid_date).toLocaleDateString() : ''
      ].map(field => `"${field}"`).join(','))
    ].join('\n')
    
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `月租明细_${selectedYear}年${selectedMonth}月.csv`
    link.click()
  }
  
  useEffect(() => {
    fetchRentRecords()
  }, [selectedYear, selectedMonth, departmentFilter])
  
  const totalRent = rentRecords.reduce((sum, r) => sum + Number(r.monthly_rent), 0)
  const paidRent = rentRecords.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.monthly_rent), 0)
  const unpaidRent = totalRent - paidRent
  const departments = [...new Set(rentRecords.map(r => r.department))].filter(d => d)
  
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h1 className="text-2xl font-bold">月租费用明细</h1>
            <div className="flex flex-wrap gap-3">
              <select
                className="px-3 py-2 border rounded text-sm"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}年</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border rounded text-sm"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
              >
                {months.map(month => (
                  <option key={month} value={month}>{month}月</option>
                ))}
              </select>
              <select
                className="px-3 py-2 border rounded text-sm"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="all">全部部门</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {user?.role === 'admin' && (
                <button
                  onClick={generateMonthlyRecords}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  生成月租记录
                </button>
              )}
              <button
                onClick={exportToCSV}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                导出CSV
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">本月租金总额</p>
            <p className="text-2xl font-bold text-blue-600">¥{totalRent.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">已收取</p>
            <p className="text-2xl font-bold text-green-600">¥{paidRent.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-sm text-gray-600">待收取</p>
            <p className="text-2xl font-bold text-yellow-600">¥{unpaidRent.toFixed(2)}</p>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">资产编码</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">部门</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">使用人</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">月租费</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">缴费日期</th>
                  {user?.role === 'admin' && (
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                      加载中...
                    </td>
                  </tr>
                ) : rentRecords.length === 0 ? (
                  <tr>
                    <td colSpan={user?.role === 'admin' ? 7 : 6} className="px-4 py-8 text-center text-gray-500">
                      暂无月租记录
                    </td>
                  </tr>
                ) : (
                  rentRecords.map(record => (
                    <tr key={record.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{record.asset_code}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{record.department}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{record.user_name}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-blue-600">¥{record.monthly_rent}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {record.status === 'paid' ? '已缴' : '未缴'}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {record.paid_date ? new Date(record.paid_date).toLocaleDateString() : '-'}
                      </td>
                      {user?.role === 'admin' && (
                        <td className="px-4 py-3 whitespace-nowrap">
                          {record.status === 'unpaid' ? (
                            <button
                              onClick={() => markAsPaid(record.id)}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              标记已缴
                            </button>
                          ) : (
                            <button
                              onClick={() => markAsUnpaid(record.id)}
                              className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                            >
                              标记未缴
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
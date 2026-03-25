'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import type { ConversionPoint } from '@line-crm/shared'
import type { Tag } from '@line-crm/shared'
import Header from '@/components/layout/header'
import CcPromptButton from '@/components/cc-prompt-button'

interface ConversionReportItem {
  conversionPointId: string
  conversionPointName: string
  eventType: string
  totalCount: number
  totalValue: number
}

const ccPrompts = [
  {
    title: 'CV計測ポイント設定',
    prompt: `コンバージョン計測ポイントの設定をサポートしてください。
1. 主要なイベントタイプ（友だち追加、URLクリック、購入完了等）の説明
2. 各CVポイントに設定すべき金額の目安を提案
3. CVファネル全体の計測設計のベストプラクティス
手順を示してください。`,
  },
  {
    title: 'コンバージョン分析',
    prompt: `現在のコンバージョンデータを分析してください。
1. CVポイント別の発火回数と金額を集計
2. イベントタイプ別のCV率とトレンドを分析
3. CV率向上のための改善施策を提案
結果をレポートしてください。`,
  },
]

const WORKER_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'

function buildJsTag(token: string) {
  return `<script>(function(){fetch('${WORKER_URL}/cv/${token}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:location.href,ref:new URLSearchParams(location.search).get('ref')})}).catch(function(){});})();<\/script>`
}

function buildPixelTag(token: string) {
  return `<img src="${WORKER_URL}/cv/${token}?ref=" width="1" height="1" style="display:none" alt="">`
}

export default function ConversionsPage() {
  const [points, setPoints] = useState<ConversionPoint[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [report, setReport] = useState<ConversionReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [tagPointId, setTagPointId] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    eventType: '',
    value: '',
    tagIds: [] as string[],
    metaPixelId: '',
    metaAccessToken: '',
    metaEventName: '',
    metaTestEventCode: '',
    googleMeasurementId: '',
    googleApiSecret: '',
    googleEventName: '',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [pointsRes, reportRes, tagsRes] = await Promise.allSettled([
        api.conversions.points(),
        api.conversions.report(),
        api.tags.list(),
      ])
      if (pointsRes.status === 'fulfilled' && pointsRes.value.success) setPoints(pointsRes.value.data)
      if (reportRes.status === 'fulfilled' && reportRes.value.success) setReport(reportRes.value.data)
      if (tagsRes.status === 'fulfilled' && tagsRes.value.success) setTags(tagsRes.value.data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.eventType) return
    try {
      await api.conversions.createPoint({
        name: form.name,
        eventType: form.eventType,
        value: form.value ? Number(form.value) : null,
        tagIds: form.tagIds,
        metaPixelId: form.metaPixelId || null,
        metaAccessToken: form.metaAccessToken || null,
        metaEventName: form.metaEventName || null,
        metaTestEventCode: form.metaTestEventCode || null,
        googleMeasurementId: form.googleMeasurementId || null,
        googleApiSecret: form.googleApiSecret || null,
        googleEventName: form.googleEventName || null,
      })
      setForm({ name: '', eventType: '', value: '', tagIds: [], metaPixelId: '', metaAccessToken: '', metaEventName: '', metaTestEventCode: '', googleMeasurementId: '', googleApiSecret: '', googleEventName: '' })
      setShowCreate(false)
      load()
    } catch {}
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このCVポイントを削除しますか？')) return
    await api.conversions.deletePoint(id)
    load()
  }

  const eventTypes = [
    { value: 'friend_add', label: '友だち追加' },
    { value: 'rich_menu_tap', label: 'リッチメニュータップ' },
    { value: 'url_click', label: 'URLクリック' },
    { value: 'form_submit', label: 'フォーム送信' },
    { value: 'keyword_sent', label: 'キーワード送信' },
    { value: 'scenario_step', label: 'シナリオステップ到達' },
    { value: 'liff_view', label: 'LIFF閲覧' },
    { value: 'purchase', label: '購入完了' },
    { value: 'custom', label: 'カスタム' },
  ]

  return (
    <div>
      <Header
        title="コンバージョン計測"
        description="CVポイント定義 & レポート"
        action={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-4 py-2 min-h-[44px] rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#06C755' }}
          >
            {showCreate ? 'キャンセル' : '+ CVポイント作成'}
          </button>
        }
      />

      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CV名</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="購入完了"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">イベントタイプ</label>
              <select
                value={form.eventType}
                onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                required
              >
                <option value="">選択...</option>
                {eventTypes.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">金額 (任意)</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="0"
              />
            </div>
            {tags.length > 0 && (
              <div className="col-span-full">
                <label className="block text-sm font-medium text-gray-700 mb-2">CV 発火時に付与するタグ（複数選択可）</label>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => {
                    const selected = form.tagIds.includes(tag.id)
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setForm({
                          ...form,
                          tagIds: selected
                            ? form.tagIds.filter((id) => id !== tag.id)
                            : [...form.tagIds, tag.id],
                        })}
                        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${selected ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                        style={selected ? { backgroundColor: tag.color, borderColor: tag.color } : {}}
                      >
                        {tag.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="col-span-full mt-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-blue-600 text-white text-center leading-4 text-[10px] font-bold">f</span>
              Meta Conversions API（任意）
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pixel ID</label>
                <input
                  value={form.metaPixelId}
                  onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="123456789012345"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">アクセストークン</label>
                <input
                  type="password"
                  value={form.metaAccessToken}
                  onChange={(e) => setForm({ ...form, metaAccessToken: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="EAAxxxxxxxx..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Meta イベント名</label>
                <select
                  value={form.metaEventName}
                  onChange={(e) => setForm({ ...form, metaEventName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">選択...</option>
                  <option value="Purchase">Purchase（購入）</option>
                  <option value="Lead">Lead（リード）</option>
                  <option value="CompleteRegistration">CompleteRegistration（登録完了）</option>
                  <option value="InitiateCheckout">InitiateCheckout（チェックアウト開始）</option>
                  <option value="AddToCart">AddToCart（カートに追加）</option>
                  <option value="ViewContent">ViewContent（コンテンツ閲覧）</option>
                  <option value="Search">Search（検索）</option>
                  <option value="Contact">Contact（問い合わせ）</option>
                  <option value="Subscribe">Subscribe（購読）</option>
                  <option value="CustomEvent">CustomEvent（カスタム）</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">テストイベントコード（任意）</label>
                <input
                  value={form.metaTestEventCode}
                  onChange={(e) => setForm({ ...form, metaTestEventCode: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="TEST12345"
                />
              </div>
            </div>
          </div>

            <div className="col-span-full mt-2 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-white border border-gray-300 flex items-center justify-center text-[10px] font-bold text-blue-500">G</span>
              Google Analytics 4（任意）
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Measurement ID</label>
                <input
                  value={form.googleMeasurementId}
                  onChange={(e) => setForm({ ...form, googleMeasurementId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="G-XXXXXXXXXX"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
                <input
                  type="password"
                  value={form.googleApiSecret}
                  onChange={(e) => setForm({ ...form, googleApiSecret: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  placeholder="xxxxxxxxxxxxxxxxxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GA4 イベント名</label>
                <select
                  value={form.googleEventName}
                  onChange={(e) => setForm({ ...form, googleEventName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">選択...</option>
                  <option value="purchase">purchase（購入）</option>
                  <option value="generate_lead">generate_lead（リード獲得）</option>
                  <option value="sign_up">sign_up（登録）</option>
                  <option value="begin_checkout">begin_checkout（チェックアウト開始）</option>
                  <option value="add_to_cart">add_to_cart（カートに追加）</option>
                  <option value="view_item">view_item（商品閲覧）</option>
                  <option value="search">search（検索）</option>
                  <option value="contact">contact（問い合わせ）</option>
                  <option value="subscribe">subscribe（購読）</option>
                </select>
              </div>
            </div>
          </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-4 py-2 min-h-[44px] rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#06C755' }}
          >
            作成
          </button>
        </form>
      )}

      {/* Report Cards */}
      {report.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {report.map((r) => (
            <div key={r.conversionPointId} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700">{r.conversionPointName}</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{r.eventType}</span>
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-2xl font-bold text-gray-900">{r.totalCount}</p>
                  <p className="text-xs text-gray-400">CV数</p>
                </div>
                {r.totalValue > 0 && (
                  <div>
                    <p className="text-lg font-semibold text-green-600">{r.totalValue.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' })}</p>
                    <p className="text-xs text-gray-400">売上</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Points Table */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">読み込み中...</div>
      ) : points.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">CVポイントがまだありません</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">CV名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">イベントタイプ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">付与タグ</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">金額</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">作成日</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {points.map((point) => (
                <tr key={point.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{point.name}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{point.eventType}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {point.tagIds?.length > 0
                        ? point.tagIds.map((tid) => {
                            const t = tags.find((x) => x.id === tid)
                            return t ? (
                              <span key={tid} className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
                            ) : null
                          })
                        : <span className="text-xs text-gray-400">-</span>
                      }
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {point.value !== null ? `¥${point.value.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(point.createdAt).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3 text-right flex items-center justify-end gap-3">
                    {point.publicToken && (
                      <button
                        onClick={() => setTagPointId(point.id)}
                        className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                      >
                        タグ
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(point.id)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tag Code Modal */}
      {tagPointId && (() => {
        const p = points.find((x) => x.id === tagPointId)
        if (!p || !p.publicToken) return null
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl">
              <div className="flex items-center justify-between p-5 border-b border-gray-200">
                <div>
                  <h2 className="text-base font-semibold text-gray-900">タグ埋め込みコード</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{p.name} — CV発生ページのHTMLに貼り付けてください</p>
                </div>
                <button onClick={() => setTagPointId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-700">JS タグ（推奨）</p>
                    <span className="text-xs text-green-600 font-medium">ITP 回避 / Safari 対応</span>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">fetch でサーバー側に送信するため、iPhone / Safari の ITP・ブラウザ制限の影響を受けません。</p>
                  <div className="relative">
                    <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">{buildJsTag(p.publicToken)}</pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(buildJsTag(p.publicToken!))}
                      className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                    >コピー</button>
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-sm font-medium text-gray-700">ピクセルタグ（img 版）</p>
                    <span className="text-xs text-gray-400">JS 無効環境向け</span>
                  </div>
                  <div className="relative">
                    <pre className="bg-gray-900 text-green-400 text-xs rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-all">{buildPixelTag(p.publicToken)}</pre>
                    <button
                      onClick={() => navigator.clipboard.writeText(buildPixelTag(p.publicToken!))}
                      className="absolute top-2 right-2 text-xs bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded"
                    >コピー</button>
                  </div>
                </div>
                  <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                  LINE メッセージのリンクに <code className="bg-gray-200 px-1 rounded">?ref=xxx</code> パラメータを付けておくと、ページ訪問時に LINE ユーザーを特定し、設定したタグを自動付与します。ref がない場合は記録のみ行います。
                </p>
              </div>
            </div>
          </div>
        )
      })()}

      <CcPromptButton prompts={ccPrompts} />
    </div>
  )
}

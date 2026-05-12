import { useState } from 'react';
import {
  useSettingsStore,
  type ScribbleSensitivity,
} from '../../store/useSettingsStore';

interface Props {
  onBack: () => void;
  onClearAllPdfs: () => Promise<void>;
}

const SENSITIVITY_OPTIONS: {
  value: ScribbleSensitivity;
  label: string;
  desc: string;
}[] = [
  { value: 'off', label: 'オフ', desc: '自動消去しない' },
  {
    value: 'strict',
    label: '厳しい',
    desc: '明確なぐちゃぐちゃのみ（推奨）',
  },
  { value: 'normal', label: '標準', desc: 'バランス' },
  { value: 'loose', label: 'ゆるい', desc: '積極的に消去（誤判定多め）' },
];

function NumberSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  preview,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  preview?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <label className="w-16 text-sm">{label}</label>
      {preview}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1"
      />
      <span className="w-14 text-right tabular-nums text-sm text-gray-600">
        {value.toFixed(step < 1 ? 2 : 0)}
        {unit && <span className="ml-0.5 text-xs text-gray-400">{unit}</span>}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <h2 className="text-sm font-bold text-gray-700 mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function SettingsScreen({ onBack, onClearAllPdfs }: Props) {
  const s = useSettingsStore();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const swatch = (px: number) => (
    <span
      className="block bg-gray-700 rounded-full shrink-0"
      style={{ width: `${Math.max(4, px * 2.4)}px`, height: `${Math.max(4, px * 2.4)}px` }}
    />
  );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header
        className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 rounded bg-gray-100 text-sm"
        >
          ← 一覧
        </button>
        <h1 className="text-lg font-bold flex-1">設定</h1>
      </header>

      <div className="flex-1 overflow-auto px-4 py-4">
        <Section title="ペンの太さ（パレットの3種類）">
          <NumberSlider
            label="細"
            value={s.widthThin}
            min={0.8}
            max={2.4}
            step={0.1}
            unit="px"
            onChange={(v) => s.update({ widthThin: v })}
            preview={swatch(s.widthThin)}
          />
          <NumberSlider
            label="中"
            value={s.widthMed}
            min={1.6}
            max={4.0}
            step={0.1}
            unit="px"
            onChange={(v) => s.update({ widthMed: v })}
            preview={swatch(s.widthMed)}
          />
          <NumberSlider
            label="太"
            value={s.widthThick}
            min={3.0}
            max={8.0}
            step={0.1}
            unit="px"
            onChange={(v) => s.update({ widthThick: v })}
            preview={swatch(s.widthThick)}
          />
        </Section>

        <Section title="消しゴム">
          <NumberSlider
            label="半径"
            value={s.eraserRadius}
            min={3}
            max={15}
            step={1}
            unit="px"
            onChange={(v) => s.update({ eraserRadius: v })}
          />
        </Section>

        <Section title="鉛筆">
          <NumberSlider
            label="濃さ"
            value={s.pencilAlpha}
            min={0.2}
            max={1}
            step={0.05}
            onChange={(v) => s.update({ pencilAlpha: v })}
          />
        </Section>

        <Section title="ぐちゃぐちゃ消し">
          <p className="text-xs text-gray-500 mb-2">
            ペン入力をぐちゃぐちゃと往復させると、そのエリアの添削を自動消去します。
          </p>
          <div className="space-y-1">
            {SENSITIVITY_OPTIONS.map((opt) => {
              const active = s.scribbleSensitivity === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => s.update({ scribbleSensitivity: opt.value })}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left ${
                    active ? 'bg-blue-50 ring-2 ring-blue-500' : 'bg-gray-50'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                      active
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300'
                    }`}
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="データ">
          {confirmingClear ? (
            <div className="space-y-2">
              <p className="text-sm text-red-700">
                取り込んだすべてのPDFと添削を削除しますか？この操作は取り消せません。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await onClearAllPdfs();
                    setConfirmingClear(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm"
                >
                  すべて削除
                </button>
                <button
                  onClick={() => setConfirmingClear(false)}
                  className="px-4 py-2 rounded-lg bg-gray-200 text-sm"
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingClear(true)}
              className="px-4 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 text-sm"
            >
              すべてのPDFを削除
            </button>
          )}
          <div className="mt-3">
            <button
              onClick={() => s.reset()}
              className="px-4 py-2 rounded-lg bg-gray-100 text-sm"
            >
              設定を初期値に戻す
            </button>
          </div>
        </Section>

        <Section title="このアプリについて">
          <dl className="text-sm space-y-1.5">
            <div className="flex">
              <dt className="w-24 text-gray-500">バージョン</dt>
              <dd>0.1.0</dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">ソース</dt>
              <dd className="text-blue-600 break-all">
                github.com/yuto-k-okapi/pef
              </dd>
            </div>
            <div className="flex">
              <dt className="w-24 text-gray-500">技術</dt>
              <dd className="text-gray-600">
                Vite · React · PDF.js · pdf-lib · Tailwind
              </dd>
            </div>
          </dl>
        </Section>

        <Section title="使い方">
          <ul className="text-sm text-gray-700 space-y-2 list-disc pl-5">
            <li>PDFを取り込んだら、ツールバーでペン・鉛筆・消しゴムを切替</li>
            <li>2本指でピンチイン/アウト、2本指ドラッグでパン</li>
            <li>「+ メモ」で現在のページの直後に空白ページを挿入</li>
            <li>「書き出し」で添削済みPDFを共有/ダウンロード</li>
            <li>進捗タグ（未/中/完）で添削状況を管理</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

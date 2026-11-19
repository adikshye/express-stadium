import React, { useState } from 'react';
import { MonteCarloSummary, TrackedIssue } from '../lib/expressLogic';

export interface ThreatEntry {
  category: string;
  threat: string;
  mitigation: string;
  status: string;
}

export interface EvalRow {
  id: number;
  text: string;
  expected_category: string;
  ai_predicted: string;
  result: 'Pass' | 'Fail';
}

export interface ProjectArtifactsData {
  threatModel: {
    project_name: string;
    owner: string;
    component: string;
    stride_threats: ThreatEntry[];
  } | null;
  evals: {
    total: number;
    passCount: number;
    failCount: number;
    accuracyPct: number;
    rows: EvalRow[];
  };
  monteCarlo: MonteCarloSummary;
  latestAiReport: string;
  adr001: string;
  adr002: string;
  issues: TrackedIssue[];
  charts: {
    monteCarloPng: string;
    doraPng: string;
    executivePng: string;
  };
}

interface DevOpsHubViewProps {
  artifacts: ProjectArtifactsData | null;
}

type SubTab = 'dashboards' | 'security' | 'ai_evals' | 'issues';

export const DevOpsHubView: React.FC<DevOpsHubViewProps> = ({ artifacts }) => {
  const [subTab, setSubTab] = useState<SubTab>('dashboards');
  const [evalFilter, setEvalFilter] = useState<'all' | 'Pass' | 'Fail'>('all');

  if (!artifacts) {
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-10 text-center text-sm text-neutral-500">
        Загрузка проектных артефактов ЛЗ-6 — ЛЗ-15...
      </div>
    );
  }

  const filteredEvals =
    evalFilter === 'all'
      ? artifacts.evals.rows
      : artifacts.evals.rows.filter((r) => r.result === evalFilter);

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-neutral-950 tracking-tight">
            Артефакты управления проектом и DevOps
          </h1>
          <p className="text-sm text-neutral-600 mt-1">
            Сквозные результаты лабораторных работ ЛЗ-6 — ЛЗ-15: прогноз Монте-Карло, STRIDE, DORA, AI Evals и бэклог GitHub Projects.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Разделы проектных артефактов"
          className="inline-flex items-center gap-1 p-1 bg-neutral-200/70 rounded-lg shrink-0 self-start lg:self-auto"
        >
          {[
            { id: 'dashboards' as const, label: 'Дашборды' },
            { id: 'security' as const, label: 'STRIDE' },
            { id: 'ai_evals' as const, label: 'AI Evals' },
            { id: 'issues' as const, label: 'Issues и DoD' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={subTab === tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === tab.id
                  ? 'bg-white text-neutral-950 shadow-xs'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs text-neutral-500">Прогноз Монте-Карло (42 задачи)</div>
          <div className="font-mono text-xl font-extrabold text-neutral-950 mt-1.5 tabular-nums whitespace-nowrap">
            P50: {artifacts.monteCarlo.p50} / P85: {artifacts.monteCarlo.p85} нед.
          </div>
          <div className="text-xs text-neutral-500 mt-1">10 000 прогонов · ЛЗ-6</div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs text-neutral-500">Точность ИИ-классификатора</div>
          <div className="font-mono text-xl font-extrabold text-neutral-950 mt-1.5 tabular-nums whitespace-nowrap">
            {artifacts.evals.accuracyPct}% ({artifacts.evals.passCount}/{artifacts.evals.total})
          </div>
          <div className="text-xs text-neutral-500 mt-1">Целевой порог 85% · ЛЗ-12</div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs text-neutral-500">Факт / План TCO (FinOps)</div>
          <div className="font-mono text-xl font-extrabold text-neutral-950 mt-1.5 tabular-nums whitespace-nowrap">
            78 000 / 112 000 ₸
          </div>
          <div className="text-xs text-neutral-500 mt-1">Экономия 30.4% · ЛЗ-8, ЛЗ-14</div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <div className="text-xs text-neutral-500">Прогресс спринтов</div>
          <div className="font-mono text-xl font-extrabold text-neutral-950 mt-1.5 tabular-nums whitespace-nowrap">
            29 / 42 (69.0%)
          </div>
          <div className="text-xs text-neutral-500 mt-1">Cycle Time 2.1 дн. · ЛЗ-10, ЛЗ-14</div>
        </div>
      </div>

      {subTab === 'dashboards' && (
        <div className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-neutral-950">
                  Вероятностный прогноз сроков Монте-Карло (ЛЗ-6)
                </h2>
                <p className="text-xs text-neutral-500">
                  Файл: <code className="font-mono">docs/simulation/monte_carlo_histogram.png</code>
                </p>
              </div>
              <div className="font-mono text-xs text-neutral-600 tabular-nums">
                P50: {artifacts.monteCarlo.p50} апта · P70: {artifacts.monteCarlo.p70} апта · P85:{' '}
                {artifacts.monteCarlo.p85} апта · P95: {artifacts.monteCarlo.p95} апта
              </div>
            </div>
            <img
              src={artifacts.charts.monteCarloPng}
              alt="Гистограмма Монте-Карло прогноза сроков проекта Express"
              referrerPolicy="no-referrer"
              className="w-full max-w-4xl mx-auto rounded-lg border border-neutral-100"
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-bold text-neutral-950">
                DORA Metrics Dashboard (ЛЗ-10)
              </h2>
              <p className="text-xs text-neutral-500">
                Файл: <code className="font-mono">docs/dora_dashboard.png</code>
              </p>
              <img
                src={artifacts.charts.doraPng}
                alt="Дашборд метрик DORA проекта Express"
                referrerPolicy="no-referrer"
                className="w-full rounded-lg border border-neutral-100"
              />
            </section>

            <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-bold text-neutral-950">
                Executive Project Dashboard (ЛЗ-14)
              </h2>
              <p className="text-xs text-neutral-500">
                Файл: <code className="font-mono">docs/project_dashboard.png</code>
              </p>
              <img
                src={artifacts.charts.executivePng}
                alt="Executive Dashboard проекта Express"
                referrerPolicy="no-referrer"
                className="w-full rounded-lg border border-neutral-100"
              />
            </section>
          </div>
        </div>
      )}

      {subTab === 'security' && artifacts.threatModel && (
        <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h2 className="text-lg font-bold text-neutral-950">
              Модель угроз STRIDE ({artifacts.threatModel.component})
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Владелец: {artifacts.threatModel.owner} · Файл: <code className="font-mono">docs/security/threat-model.json</code>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
                  <th className="py-3 px-6 font-medium">Категория STRIDE</th>
                  <th className="py-3 px-4 font-medium">Угроза</th>
                  <th className="py-3 px-4 font-medium">Мера защиты (Mitigation)</th>
                  <th className="py-3 px-6 font-medium">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {artifacts.threatModel.stride_threats.map((row) => (
                  <tr key={row.category} className="hover:bg-neutral-50/70">
                    <td className="py-3 px-6 font-semibold text-neutral-950 whitespace-nowrap">
                      {row.category}
                    </td>
                    <td className="py-3 px-4 text-neutral-700">{row.threat}</td>
                    <td className="py-3 px-4 text-neutral-700">{row.mitigation}</td>
                    <td className="py-3 px-6 font-mono text-xs whitespace-nowrap">
                      <span
                        className={
                          row.status.startsWith('Implemented')
                            ? 'text-emerald-700 font-semibold'
                            : 'text-amber-700 font-semibold'
                        }
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {subTab === 'ai_evals' && (
        <div className="space-y-6">
          <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-3">
            <h2 className="text-lg font-bold text-neutral-950">
              ADR-002: Выбор архитектуры ИИ-классификатора (MADR)
            </h2>
            <p className="text-sm text-neutral-700 leading-relaxed">
              Выбран облачный API <code className="font-mono">gpt-4o-mini</code> с обязательной
              предварительной очисткой ПДн (модуль <code className="font-mono">EXP-28</code>) за
              <strong> $0.75/мес</strong> вместо локальной Llama 3 8B на GPU ($80/мес) и ручной
              разметки в Excel. Точность на эталонном датасете: <strong>{artifacts.evals.accuracyPct}%</strong>.
            </p>
          </section>

          <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-neutral-950">
                  Эталонный датасет AI Evals (30 записей)
                </h2>
                <p className="text-xs text-neutral-500">
                  Файл: <code className="font-mono">docs/ai/eval_dataset.csv</code> · Pass:{' '}
                  {artifacts.evals.passCount} · Fail: {artifacts.evals.failCount}
                </p>
              </div>

              <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
                {(['all', 'Pass', 'Fail'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setEvalFilter(f)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md cursor-pointer ${
                      evalFilter === f ? 'bg-white text-neutral-950 shadow-xs' : 'text-neutral-600'
                    }`}
                  >
                    {f === 'all' ? 'Все (30)' : f}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead className="sticky top-0 bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="py-2.5 px-4 font-medium">#</th>
                    <th className="py-2.5 px-4 font-medium">Текст отзыва</th>
                    <th className="py-2.5 px-4 font-medium">Ожидаемо</th>
                    <th className="py-2.5 px-4 font-medium">ИИ-прогноз</th>
                    <th className="py-2.5 px-4 font-medium">Итог</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredEvals.map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-50/70">
                      <td className="py-2.5 px-4 font-mono text-xs text-neutral-500 tabular-nums">
                        {row.id}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-neutral-800">{row.text}</td>
                      <td className="py-2.5 px-4 text-xs text-neutral-700 whitespace-nowrap">
                        {row.expected_category}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-neutral-700 whitespace-nowrap">
                        {row.ai_predicted}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs font-semibold whitespace-nowrap">
                        <span className={row.result === 'Pass' ? 'text-emerald-700' : 'text-red-700'}>
                          {row.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {subTab === 'issues' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-3">
              <h2 className="text-base font-bold text-neutral-950">
                Еженедельный статус-отчет ИИ-ассистента (ЛЗ-13)
              </h2>
              <pre className="text-xs font-mono text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg p-4 whitespace-pre-wrap leading-relaxed">
                {artifacts.latestAiReport}
              </pre>
            </section>

            <section className="bg-white border border-neutral-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-neutral-950">
                Правила готовности и завершенности (ЛЗ-9)
              </h2>
              <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
                <div>
                  <strong className="text-neutral-950">DoR (Definition of Ready):</strong> Задача
                  четко описана, оценена в Story Points, привязана к релизу и содержит критерии
                  приемки (Given-When-Then).
                </div>
                <div className="pt-3 border-t border-neutral-100">
                  <strong className="text-neutral-950">DoD (Definition of Done):</strong> Код
                  написан, покрыт автотестами (<code className="font-mono">pytest</code>), прошел
                  проверку безопасности Trivy, прошел Code Review и влит в ветку{' '}
                  <code className="font-mono">main</code>.
                </div>
              </div>
            </section>
          </div>

          <section className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-neutral-950">
                  Реестр задач GitHub Issues и Projects (ЛЗ-7 — ЛЗ-12)
                </h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Скрипт синхронизации: <code className="font-mono">scripts/sync_github_issues.sh</code>
                </p>
              </div>
              <span className="font-mono text-xs text-neutral-500 tabular-nums">
                Задач: {artifacts.issues.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
                    <th className="py-2.5 px-6 font-medium">Ключ</th>
                    <th className="py-2.5 px-4 font-medium">Задача</th>
                    <th className="py-2.5 px-4 font-medium">Роль / Ответственный</th>
                    <th className="py-2.5 px-4 font-medium">Релиз</th>
                    <th className="py-2.5 px-4 font-medium">Оценка</th>
                    <th className="py-2.5 px-6 font-medium">Колонка</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {artifacts.issues.map((issue) => (
                    <tr key={issue.key} className="hover:bg-neutral-50/70">
                      <td className="py-2.5 px-6 font-mono text-xs font-bold text-neutral-950 whitespace-nowrap">
                        {issue.key}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-neutral-800">{issue.title}</td>
                      <td className="py-2.5 px-4 text-xs text-neutral-600 whitespace-nowrap">
                        {issue.role}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-neutral-600 whitespace-nowrap">
                        {issue.release}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-neutral-700 whitespace-nowrap">
                        {issue.size}
                      </td>
                      <td className="py-2.5 px-6 text-xs font-semibold whitespace-nowrap">
                        <span
                          className={
                            issue.column === 'Done'
                              ? 'text-emerald-700'
                              : issue.column.startsWith('In Progress')
                                ? 'text-amber-700'
                                : 'text-neutral-600'
                          }
                        >
                          {issue.column}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

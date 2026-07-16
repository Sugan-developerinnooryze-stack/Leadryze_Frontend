import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import api from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function AnalyticsPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<{
    dailyLeads: { date: string; count: number }[];
    byChannel: Record<string, number>;
    conversionByStatus: Record<string, number>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId) return;
    api
      .get(`/api/v1/analytics/dashboard?tenantId=${user.tenantId}`)
      .then((r) => setData(r.data.data))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [user?.tenantId]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card h-64 bg-gray-100" />
          <div className="card h-64 bg-gray-100" />
        </div>
      </div>
    );
  }

  const dailyLeadsData = {
    labels: data?.dailyLeads?.map((d) => d.date) ?? [],
    datasets: [
      {
        label: 'Daily Leads',
        data: data?.dailyLeads?.map((d) => d.count) ?? [],
        backgroundColor: 'rgba(37, 99, 235, 0.7)',
        borderRadius: 4,
      },
    ],
  };

  const channelData = {
    labels: Object.keys(data?.byChannel ?? {}),
    datasets: [
      {
        data: Object.values(data?.byChannel ?? {}),
        backgroundColor: ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a'],
        borderWidth: 0,
      },
    ],
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Lead Volume</h2>
          {(data?.dailyLeads?.length ?? 0) === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">No data yet</p>
          ) : (
            <Bar
              data={dailyLeadsData}
              options={{ responsive: true, plugins: { legend: { display: false } } }}
            />
          )}
        </div>
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Leads by Channel</h2>
          {Object.keys(data?.byChannel ?? {}).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">No data yet</p>
          ) : (
            <div className="max-w-xs mx-auto">
              <Doughnut data={channelData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

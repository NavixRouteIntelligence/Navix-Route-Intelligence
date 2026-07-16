'use client';

import type {
  AccessInstructionView,
  CollectiveInsightView,
  LoadPlanView,
  ParkingPredictionView,
} from '@navix/contracts';
import { MapPin } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n/locale-provider';

import { AccessInstructionList } from './access-instruction-list';
import { CollectiveInsightCard } from './collective-insight-card';
import { LoadPlanList } from './load-plan-list';
import { ParkingBadge } from './parking-badge';

export interface DriverStopIntelligenceProps {
  /** Estacionamento previsto para a parada atual (route-forecast, ADR-0029). */
  parking?: ParkingPredictionView;
  /** Instruções de acesso da parada atual (ADR-0028). */
  access?: AccessInstructionView[];
  /** Insight coletivo do local da parada atual (ADR-0031). */
  insight?: CollectiveInsightView;
  /** Plano de carga da rota (ADR-0030). */
  loadPlan?: LoadPlanView;
  loading?: boolean;
}

/**
 * Painel de inteligência do motorista para a parada atual: reúne estacionamento,
 * acesso, inteligência coletiva (ADR-0028/0029/0031) e a organização da carga
 * da rota (ADR-0030) em cartões do Design System. Puramente apresentacional — a
 * página faz as consultas e passa os dados.
 */
export function DriverStopIntelligence({
  parking,
  access,
  insight,
  loadPlan,
  loading,
}: DriverStopIntelligenceProps) {
  const t = useT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            {t('stopIntel.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              {parking && (
                <div>
                  <ParkingBadge prediction={parking} />
                </div>
              )}
              {access && access.length > 0 && <AccessInstructionList instructions={access} />}
              {insight && <CollectiveInsightCard insight={insight} />}
              {!parking && !insight && (!access || access.length === 0) && (
                <p className="text-sm text-muted-foreground">{t('stopIntel.empty')}</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {loadPlan && loadPlan.placements.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <LoadPlanList plan={loadPlan} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
